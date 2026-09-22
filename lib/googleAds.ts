import "server-only";
import { JWT } from "google-auth-library";
import {
  bucketDaCampanha,
  ESCOPO_TODAS,
  PISO_HISTORICO,
  type EscopoSlug,
} from "./config";
import type { Periodo } from "./meta";
import { hojeNaConta } from "./periodo";

/**
 * Cliente da Google Ads API por REST.
 *
 * Autentica com conta de serviço + Domain-Wide Delegation: o JWT leva
 * `subject` com o usuário impersonado, porque a Google Ads API não aceita a
 * própria service account como identidade — ela precisa agir em nome de um
 * usuário com acesso à conta.
 *
 * Sem SDK: a lib `google-ads-api` (Opteo) não suporta impersonation de conta
 * de serviço, então as chamadas vão direto ao endpoint REST.
 */

// v21 tem sunset em outubro/2026.
const VERSAO = process.env.GOOGLE_ADS_API_VERSION ?? "v25";
const BASE = `https://googleads.googleapis.com/${VERSAO}`;
const ESCOPO = "https://www.googleapis.com/auth/adwords";

export const REVALIDATE_ADS = 300;

/** Estrutura da conta: canais por praça. Muda de mês em mês, não de minuto. */
export const REVALIDATE_ESTRUTURA = 1800;

/**
 * Credencial ausente é erro de ambiente, não de dado. A mensagem diz onde
 * configurar porque o sintoma — dashboard sem Google — é idêntico ao de uma
 * praça que de fato não roda o canal, e sem isso o diagnóstico é adivinhação.
 */
const CREDENCIAL_AUSENTE = (nome: string) =>
  `${nome} não está definida. Em desenvolvimento ela vem do .env.local; ` +
  "na hospedagem precisa ser cadastrada nas variáveis de ambiente do projeto — " +
  "o .env.local não vai para o repositório.";

/** IDs vão sem hífen para a API. */
const soDigitos = (v?: string) => (v ?? "").replace(/\D/g, "");

export class GoogleAdsError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly detalhe?: string,
  ) {
    super(message);
    this.name = "GoogleAdsError";
  }
}

export function explicarErroAds(e: GoogleAdsError): string {
  switch (e.code) {
    case 401:
      return "Falha de autenticação. Verifique se a Domain-Wide Delegation está autorizada para o escopo de AdWords e se o usuário impersonado existe no domínio.";
    case 403:
      return "Acesso negado à conta de anúncios. Confirme se o usuário impersonado tem acesso à conta e se o developer token está aprovado para produção.";
    case 404:
      return "Conta não encontrada. Verifique GOOGLE_ADS_CUSTOMER_ID e GOOGLE_ADS_LOGIN_CUSTOMER_ID.";
    case 429:
      return "Limite de requisições da Google Ads API atingido. Aguarde alguns minutos.";
    case 0:
      return e.message;
    default:
      // Falha do lado do Google que sobreviveu às tentativas. A mensagem crua
      // vem em inglês e não diz o que fazer; aqui diz.
      if (ehTransitorio(e.code, e.detalhe)) {
        return "A Google Ads API respondeu com falha temporária nas três tentativas. Não é erro de configuração — use Atualizar em alguns instantes.";
      }
      return e.detalhe ? `${e.message} — ${e.detalhe}` : e.message;
  }
}

interface ContaServico {
  client_email: string;
  private_key: string;
}

function contaServico(): ContaServico {
  const b64 = process.env.GOOGLE_ADS_SA_KEY_BASE64;
  if (!b64) throw new GoogleAdsError(CREDENCIAL_AUSENTE("GOOGLE_ADS_SA_KEY_BASE64"), 0);

  let json: ContaServico;
  try {
    json = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as ContaServico;
  } catch {
    // Falha comum: a variável foi colada pela metade e o base64 vira binário.
    throw new GoogleAdsError(
      `GOOGLE_ADS_SA_KEY_BASE64 não decodifica em JSON (${b64.length} caracteres). ` +
        "O valor parece truncado — regere com `base64 -i chave.json | tr -d '\\n'` e cole inteiro.",
      0,
    );
  }
  if (!json.client_email || !json.private_key) {
    throw new GoogleAdsError("Chave sem client_email ou private_key", 0);
  }
  return json;
}

/** Token em cache no processo: vale 1h e cada página faz várias consultas. */
let cache: { token: string; expiraEm: number } | null = null;

export async function tokenAds(): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  if (cache && cache.expiraEm > agora + 60) return cache.token;

  const sa = contaServico();
  const usuario = process.env.GOOGLE_ADS_IMPERSONATED_USER;
  if (!usuario) throw new GoogleAdsError(CREDENCIAL_AUSENTE("GOOGLE_ADS_IMPERSONATED_USER"), 0);

  const cliente = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: [ESCOPO],
    subject: usuario, // Domain-Wide Delegation
  });

  try {
    const { access_token, expiry_date } = await cliente.authorize();
    if (!access_token) throw new GoogleAdsError("Token vazio", 401);
    cache = {
      token: access_token,
      expiraEm: expiry_date ? Math.floor(expiry_date / 1000) : agora + 3600,
    };
    return access_token;
  } catch (e) {
    if (e instanceof GoogleAdsError) throw e;
    throw new GoogleAdsError((e as Error).message, 401);
  }
}

// ---------------------------------------------------------------- consulta

interface RespostaBusca {
  results?: Record<string, unknown>[];
  error?: { code: number; message: string; status?: string };
}

/**
 * Falhas que valem nova tentativa: são do lado do Google, não da consulta.
 * `INTERNAL` aparece de forma esporádica na Google Ads API mesmo com a query
 * correta — a mesma consulta que falhou passa no instante seguinte.
 */
const STATUS_TRANSITORIO = new Set([
  "INTERNAL",
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
  "ABORTED",
  "RESOURCE_EXHAUSTED",
]);
const HTTP_TRANSITORIO = new Set([429, 500, 502, 503, 504]);

const ehTransitorio = (http: number, status?: string) =>
  HTTP_TRANSITORIO.has(http) || (status !== undefined && STATUS_TRANSITORIO.has(status));

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa GAQL em `search` (paginado) e devolve as linhas cruas.
 * `searchStream` devolveria tudo de uma vez, mas em JSON vem como array de
 * chunks — `search` com pageToken é mais simples de tipar.
 *
 * Com nova tentativa em falha transitória: sem isso, um `INTERNAL` de um
 * segundo derrubava a página inteira — e, como a rota é ISR, a tela de erro
 * ficava servida pelos cinco minutos seguintes. O blip vira meia hora de
 * dashboard quebrado para quem abrir depois.
 */
export async function consultarAds(
  gaql: string,
  /**
   * Janela de cache própria. O padrão serve a dado de desempenho, que muda o
   * tempo todo; consulta ESTRUTURAL — quais canais a praça tem — muda uma vez
   * por mês e não deveria custar uma ida à API a cada navegação.
   */
  revalidar: number = REVALIDATE_ADS,
): Promise<Record<string, unknown>[]> {
  const token = await tokenAds();
  const cliente = soDigitos(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const login = soDigitos(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (!cliente) throw new GoogleAdsError(CREDENCIAL_AUSENTE("GOOGLE_ADS_CUSTOMER_ID"), 0);

  const cabecalhos: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    "Content-Type": "application/json",
  };
  // Necessário quando a conta é acessada através de uma MCC.
  if (login) cabecalhos["login-customer-id"] = login;

  const linhas: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  let guarda = 0;

  do {
    const json = await buscarPagina(cliente, cabecalhos, gaql, pageToken, revalidar);
    linhas.push(...(json.results ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken && guarda++ < 20);

  return linhas;
}

/** Uma página da consulta, com até três tentativas em falha transitória. */
async function buscarPagina(
  cliente: string,
  cabecalhos: Record<string, string>,
  gaql: string,
  pageToken: string | undefined,
  revalidar: number,
): Promise<RespostaBusca & { nextPageToken?: string }> {
  const TENTATIVAS = 3;
  let ultimo: GoogleAdsError | null = null;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const res = await fetch(`${BASE}/customers/${cliente}/googleAds:search`, {
      method: "POST",
      headers: cabecalhos,
      // Sem `pageSize`: as versões recentes da API rejeitam o campo em
      // `search` com "Request contains an invalid argument".
      body: JSON.stringify({ query: gaql, pageToken }),
      // A resposta com erro não entra no cache de dados: guardá-la faria a
      // falha transitória sobreviver à própria tentativa seguinte.
      next: res0k(tentativa) ? { revalidate: revalidar } : undefined,
      cache: res0k(tentativa) ? undefined : "no-store",
    });

    const json = (await res.json()) as RespostaBusca & { nextPageToken?: string };
    const erro = json.error;

    if (!erro && res.ok) return json;

    const http = erro?.code ?? res.status;
    const status = erro?.status;
    ultimo = new GoogleAdsError(erro?.message ?? `HTTP ${res.status}`, http, status);

    if (!ehTransitorio(http, status) || tentativa === TENTATIVAS) throw ultimo;

    // Recuo progressivo curto: a falha típica dura menos de um segundo, e a
    // página inteira está esperando esta resposta.
    await espera(250 * 2 ** (tentativa - 1));
  }

  throw ultimo ?? new GoogleAdsError("Falha desconhecida na consulta", 0);
}

/** Só a primeira tentativa participa do cache de dados do Next. */
const res0k = (tentativa: number) => tentativa === 1;

/**
 * Campanhas que contam: no ar E pausadas.
 *
 * O Meta já vive assim desde que o Rio sumiu do painel no dia seguinte ao
 * evento (`getCampanhasAtivas`, em lib/meta.ts); o Google tinha ficado para
 * trás com `campaign.status = 'ENABLED'`, e o sintoma reapareceu em Recife:
 * a PMax foi pausada e levou junto todo o investimento dela — o Overview
 * mostrava só a Pesquisa, e o item "Performance Max" nem chegava à lateral,
 * porque `canaisDoEscopo` usava o mesmo filtro. Um painel de mídia é feito
 * para ser olhado DEPOIS que a campanha acaba: status de veiculação não pode
 * decidir se o dado existe; ele é rótulo na tela (`CampanhaAds.pausada`).
 *
 * O que segura a porta aberta é `bucketDaCampanha`, que exige a marca da
 * EDIÇÃO antes de olhar a tag de praça — sem isso entrariam as campanhas
 * pausadas de 2024/2025 que ainda vivem nesta conta. `REMOVED` fica de fora:
 * campanha excluída não é histórico.
 */
export const STATUS_CAMPANHA = "campaign.status IN ('ENABLED', 'PAUSED')";

/**
 * Primeiro dia que as campanhas do escopo podem ter entregue.
 *
 * `campaign.start_date` não precisa de recorte de data (não é segmento) e não
 * traz métrica: é a consulta mais barata da casa e muda uma vez por edição,
 * por isso vai no cache estrutural.
 *
 * O piso é a data de início da campanha mais antiga EM TELA, não do histórico
 * da conta: uma campanha configurada para começar antes de veicular só faz a
 * janela abrir cedo demais, e dias sem entrega não geram linha — o primeiro
 * dia exibido continua sendo o primeiro dia COM dado, que sai da série.
 */
export async function inicioDasCampanhasAds(
  escopo: EscopoSlug = ESCOPO_TODAS,
): Promise<string> {
  const linhas = (await consultarAds(
    `SELECT campaign.name, campaign.start_date
     FROM campaign WHERE ${STATUS_CAMPANHA}`,
    REVALIDATE_ESTRUTURA,
  )) as { campaign?: { name?: string; startDate?: string } }[];

  let inicio: string | null = null;
  for (const r of linhas) {
    const bucket = bucketDaCampanha(r.campaign?.name ?? "");
    if (!bucket) continue;
    if (escopo !== ESCOPO_TODAS && bucket.slug !== escopo) continue;
    const dia = r.campaign?.startDate;
    // ISO compara bem como texto — não vale construir Date para isto.
    if (dia && (inicio === null || dia < inicio)) inicio = dia;
  }
  return inicio ?? PISO_HISTORICO;
}

/**
 * Intervalo do dashboard no formato GAQL (`segments.date BETWEEN`).
 *
 * `"maximum"` é o "Todo o período" do seletor, e aqui ele já significou os
 * ÚLTIMOS 30 DIAS — o que fazia o Google entrar no painel pela metade sem
 * nada na tela dizendo isso: no Salvador, uma campanha de Pesquisa iniciada
 * antes da janela aparecia com R$ 5,3 mil onde o gerenciador mostrava R$ 8,0
 * mil, e o consolidado Meta + Google somava maçã (vida inteira, via
 * `date_preset=maximum`) com laranja (mês corrido).
 *
 * Agora a ponta de baixo vem das campanhas do escopo. Sem `escopo` — chamada
 * que não sabe de qual praça está falando — vale a edição inteira, que é o
 * mesmo número com uma janela mais larga: dia sem entrega não vira linha.
 *
 * O fim é hoje no fuso da conta, não em UTC: depois das 21h de Brasília o
 * `toISOString` já está no dia seguinte e a ponta pedia um dia que não existe.
 */
export async function intervaloAds(
  periodo: Periodo,
  escopo: EscopoSlug = ESCOPO_TODAS,
): Promise<{ de: string; ate: string }> {
  if (periodo === "maximum") {
    return { de: await inicioDasCampanhasAds(escopo), ate: hojeNaConta() };
  }
  return { de: periodo.de, ate: periodo.ate };
}
