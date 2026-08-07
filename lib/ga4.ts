import "server-only";
import crypto from "node:crypto";
import type { Periodo } from "./meta";

/**
 * Cliente da GA4 Data API.
 *
 * Autentica com a chave da conta de serviço (base64 no .env.local), montando
 * um JWT RS256 na mão — o `crypto` do Node basta e evita puxar o SDK do Google
 * só para duas chamadas.
 */

const PROPRIEDADE = process.env.GA4_PROPERTY_ID_AFROPUNK ?? "";
const ESCOPO = "https://www.googleapis.com/auth/analytics.readonly";

/**
 * Recorte padrão do dashboard GA4, quando não há filtro na URL.
 *
 * 30 dias em vez do histórico: a propriedade guarda a edição 2025 também
 * (~80% dos dados), e uma série de mais de um ano achata os picos recentes
 * e infla os totais. Quem quiser mais, muda no filtro de período.
 */
export const DIAS_PADRAO = 30;
export const ROTULO_PADRAO = "últimos 30 dias";

export const REVALIDATE_GA4 = 300;

export class GA4Error extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
    this.name = "GA4Error";
  }
}

export function explicarErroGA4(e: GA4Error): string {
  switch (e.code) {
    case 401:
    case 403:
      return "A conta de serviço não tem acesso a esta propriedade do GA4. Adicione o e-mail da service account como leitor na propriedade.";
    case 429:
      return "Limite de requisições da GA4 Data API atingido. Aguarde alguns minutos e recarregue.";
    case 400:
      return `Consulta rejeitada pelo GA4: ${e.message}`;
    default:
      return e.message;
  }
}

interface ContaServico {
  client_email: string;
  private_key: string;
}

function contaServico(): ContaServico {
  const b64 = process.env.GA4_SA_KEY_BASE64_AFROPUNK;
  if (!b64) throw new GA4Error("GA4_SA_KEY_BASE64_AFROPUNK ausente no .env.local", 0);
  if (!PROPRIEDADE) throw new GA4Error("GA4_PROPERTY_ID_AFROPUNK ausente no .env.local", 0);
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as ContaServico;
  if (!json.client_email || !json.private_key) {
    throw new GA4Error("Chave da conta de serviço sem client_email ou private_key", 0);
  }
  return json;
}

const base64url = (v: string | object): string =>
  Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

/** Token em cache no processo: vale 1h, e cada página faz várias consultas. */
let cache: { token: string; expiraEm: number } | null = null;

async function acessoToken(): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  if (cache && cache.expiraEm > agora + 60) return cache.token;

  const sa = contaServico();
  const cabecalho = base64url({ alg: "RS256", typ: "JWT" });
  const corpo = base64url({
    iss: sa.client_email,
    scope: ESCOPO,
    aud: "https://oauth2.googleapis.com/token",
    exp: agora + 3600,
    iat: agora,
  });
  const assinatura = crypto
    .createSign("RSA-SHA256")
    .update(`${cabecalho}.${corpo}`)
    .sign(sa.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecalho}.${corpo}.${assinatura}`,
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!json.access_token) {
    throw new GA4Error(json.error_description ?? json.error ?? "Falha ao obter token", res.status);
  }
  cache = { token: json.access_token, expiraEm: agora + (json.expires_in ?? 3600) };
  return json.access_token;
}

// ---------------------------------------------------------------- consulta

export interface Intervalo {
  startDate: string;
  endDate: string;
}

/** Traduz o período do dashboard no intervalo da GA4. */
export function intervaloGA4(periodo: Periodo): Intervalo {
  return periodo === "maximum"
    ? { startDate: `${DIAS_PADRAO}daysAgo`, endDate: "today" }
    : { startDate: periodo.de, endDate: periodo.ate };
}

interface FiltroString {
  fieldName: string;
  valor: string;
}

interface Consulta {
  intervalo: Intervalo;
  dimensoes?: string[];
  metricas: string[];
  ordenarPor?: string;
  crescente?: boolean;
  limite?: number;
  /** Filtro simples de igualdade numa dimensão. */
  filtro?: FiltroString;
}

interface RespostaGA4 {
  rows?: {
    dimensionValues?: { value?: string }[];
    metricValues?: { value?: string }[];
  }[];
  totals?: { metricValues?: { value?: string }[] }[];
  error?: { code: number; message: string };
}

export interface LinhaGA4 {
  dims: string[];
  vals: number[];
}

export async function consultar(c: Consulta): Promise<LinhaGA4[]> {
  const token = await acessoToken();
  const corpo: Record<string, unknown> = {
    dateRanges: [c.intervalo],
    metrics: c.metricas.map((name) => ({ name })),
    limit: c.limite ?? 50,
  };
  if (c.dimensoes?.length) corpo.dimensions = c.dimensoes.map((name) => ({ name }));
  if (c.ordenarPor) {
    corpo.orderBys = [{ metric: { metricName: c.ordenarPor }, desc: !c.crescente }];
  } else if (c.dimensoes?.length) {
    corpo.orderBys = [{ dimension: { dimensionName: c.dimensoes[0] } }];
  }
  if (c.filtro) {
    corpo.dimensionFilter = {
      filter: {
        fieldName: c.filtro.fieldName,
        stringFilter: { matchType: "EXACT", value: c.filtro.valor },
      },
    };
  }

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPRIEDADE}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      next: { revalidate: REVALIDATE_GA4 },
    },
  );
  const json = (await res.json()) as RespostaGA4;
  if (json.error) throw new GA4Error(json.error.message, json.error.code);

  return (json.rows ?? []).map((r) => ({
    dims: (r.dimensionValues ?? []).map((d) => d.value ?? ""),
    vals: (r.metricValues ?? []).map((m) => Number(m.value ?? 0) || 0),
  }));
}

/** Uma linha só de totais, sem dimensão. */
export async function totais(intervalo: Intervalo, metricas: string[]): Promise<number[]> {
  const linhas = await consultar({ intervalo, metricas, limite: 1 });
  return linhas[0]?.vals ?? metricas.map(() => 0);
}
