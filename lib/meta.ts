import "server-only";
import { bucketDaCampanha, type Bucket } from "./config";

const V = "v25.0";
const BASE = `https://graph.facebook.com/${V}`;
const ACT = process.env.META_AD_ACCOUNT_ID || "act_3814524035488574";

/** Revalidação do cache do Next, em segundos. */
export const REVALIDATE = 300;

function token(): string {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new MetaError("META_ACCESS_TOKEN ausente no .env.local", 0);
  return t;
}

export class MetaError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly type?: string,
    readonly fbtrace_id?: string,
  ) {
    super(message);
    this.name = "MetaError";
  }
}

/** Mensagem acionável por código de erro do Meta. */
export function explicarErroMeta(e: MetaError): string {
  switch (e.code) {
    case 190:
      return "Token inválido ou expirado. Gere um novo token e atualize o .env.local.";
    case 200:
    case 10:
      return "O token não tem permissão sobre esta conta de anúncios. Verifique se o usuário está atribuído à conta no Business Manager com acesso de leitura.";
    case 803:
      return "Conta de anúncios não encontrada ou fora do alcance deste token.";
    case 4:
    case 17:
    case 613:
      return "Limite de requisições da Marketing API atingido. Aguarde alguns minutos e recarregue.";
    default:
      return e.message;
  }
}

// ---------------------------------------------------------------- tipos crus

interface ErroGraph {
  message: string;
  code: number;
  type?: string;
  fbtrace_id?: string;
}

interface RespostaLista<T> {
  data?: T[];
  error?: ErroGraph;
  paging?: { next?: string };
}

interface AcaoBruta {
  action_type: string;
  value: string;
}

/**
 * Linha de insights. Os campos fixos são os que pedimos em CAMPOS_INSIGHTS;
 * a assinatura de índice cobre as chaves de breakdown (age, gender, region,
 * publisher_platform, ...), que variam conforme a query.
 */
export interface LinhaInsight {
  campaign_id?: string;
  campaign_name?: string;
  ad_id?: string;
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: AcaoBruta[];
  action_values?: AcaoBruta[];
  [chave: string]: unknown;
}

interface CampanhaBruta {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  lifetime_budget?: string;
  daily_budget?: string;
  start_time?: string;
  stop_time?: string;
}

interface AdBruto {
  id: string;
  name: string;
  effective_status: string;
  adset?: { id?: string; name?: string };
  creative?: {
    id?: string;
    thumbnail_url?: string;
    image_url?: string;
    instagram_permalink_url?: string;
    title?: string;
    body?: string;
  };
}

type Params = Record<string, string | number | undefined>;

function montarUrl(path: string, params: Params): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  return `${BASE}/${path}?${qs.toString()}`;
}

async function graph<T>(path: string, params: Params = {}): Promise<T> {
  const res = await fetch(montarUrl(path, params), {
    headers: { Authorization: `Bearer ${token()}` },
    next: { revalidate: REVALIDATE },
  });
  const json = (await res.json()) as T & { error?: ErroGraph };
  if (json?.error) {
    const e = json.error;
    throw new MetaError(e.message, e.code, e.type, e.fbtrace_id);
  }
  return json;
}

/** Segue paging.next até o fim (o next já traz credencial embutida). */
async function graphAll<T>(path: string, params: Params = {}): Promise<T[]> {
  let url: string | undefined = montarUrl(path, params);
  const out: T[] = [];
  let guarda = 0;
  while (url && guarda++ < 25) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token()}` },
      next: { revalidate: REVALIDATE },
    });
    const json = (await res.json()) as RespostaLista<T>;
    if (json?.error) {
      const e = json.error;
      throw new MetaError(e.message, e.code, e.type, e.fbtrace_id);
    }
    out.push(...(json.data ?? []));
    url = json.paging?.next;
  }
  return out;
}

// ---------------------------------------------------------------- tipos app

export interface Conta {
  id: string;
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number;
}

export interface Campanha extends CampanhaBruta {
  bucket: Bucket | null;
}

export interface Metricas {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  linkClicks: number;
  landingPageViews: number;
  purchases: number;
  purchaseValue: number;
  addToCart: number;
  initiateCheckout: number;
  postEngagement: number;
  /**
   * Recorte de conversão: só campanhas com objetivo de venda entram aqui.
   * ROAS e CPA saem destes campos — misturar o investimento em Alcance no
   * denominador afunda o ROAS e infla o CPA de uma campanha que nem foi feita
   * para vender.
   */
  spendConversao: number;
  purchasesConversao: number;
  receitaConversao: number;
  roas: number;
  cpa: number;
}

/** Objetivos que o dashboard trata como campanha de conversão. */
export const OBJETIVOS_CONVERSAO = new Set(["OUTCOME_SALES", "OUTCOME_LEADS"]);

export const ehObjetivoConversao = (objetivo?: string): boolean =>
  Boolean(objetivo && OBJETIVOS_CONVERSAO.has(objetivo));

export interface CampanhaComMetricas extends Campanha {
  m: Metricas;
}

export interface PontoDiario {
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  spendConversao: number;
  receitaConversao: number;
  /** Permite consumo direto pelos componentes de gráfico (PontoGrafico). */
  [chave: string]: string | number;
}

export interface LinhaBreakdown {
  chave: string;
  chave2?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
}

export interface Criativo {
  adId: string;
  adName: string;
  status: string;
  campanhaId: string;
  campanhaNome: string;
  /**
   * Conjunto de anúncios. O mesmo criativo costuma rodar em vários conjuntos
   * (públicos diferentes) com o mesmo nome de anúncio — sem isto os cards
   * ficam indistinguíveis na grade.
   */
  conjuntoId: string | null;
  conjuntoNome: string | null;
  objetivo: string;
  bucket: Bucket | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  titulo: string | null;
  corpo: string | null;
  m: Metricas;
}

// ---------------------------------------------------------------- helpers

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function acao(acoes: AcaoBruta[] | undefined, tipo: string): number {
  if (!acoes) return 0;
  return num(acoes.find((a) => a.action_type === tipo)?.value);
}

/** Converte uma linha bruta de insights nas métricas do dashboard. */
export function metricas(row: LinhaInsight): Metricas {
  const spend = num(row.spend);
  const purchases = acao(row.actions, "purchase");
  const purchaseValue = acao(row.action_values, "purchase");
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  return {
    spend,
    impressions,
    reach: num(row.reach),
    clicks,
    frequency: num(row.frequency),
    ctr: num(row.ctr),
    cpc: num(row.cpc),
    cpm: num(row.cpm),
    linkClicks: acao(row.actions, "link_click"),
    landingPageViews: acao(row.actions, "landing_page_view"),
    purchases,
    purchaseValue,
    addToCart: acao(row.actions, "add_to_cart"),
    initiateCheckout: acao(row.actions, "initiate_checkout"),
    postEngagement: acao(row.actions, "post_engagement"),
    // Sem o objetivo da campanha não dá para saber se isto é conversão;
    // quem sabe é `aplicarObjetivo`, chamado logo depois.
    spendConversao: 0,
    purchasesConversao: 0,
    receitaConversao: 0,
    roas: 0,
    cpa: 0,
  };
}

/** Marca o recorte de conversão de uma linha, à luz do objetivo da campanha. */
export function aplicarObjetivo(m: Metricas, objetivo?: string): Metricas {
  const conv = ehObjetivoConversao(objetivo);
  const spendConversao = conv ? m.spend : 0;
  const purchasesConversao = conv ? m.purchases : 0;
  const receitaConversao = conv ? m.purchaseValue : 0;
  return {
    ...m,
    spendConversao,
    purchasesConversao,
    receitaConversao,
    roas: spendConversao > 0 ? receitaConversao / spendConversao : 0,
    cpa: purchasesConversao > 0 ? spendConversao / purchasesConversao : 0,
  };
}

export const METRICAS_ZERO: Metricas = metricas({});

/** Soma métricas recalculando as derivadas — médias nunca são somadas. */
export function somar(lista: Metricas[]): Metricas {
  const t = lista.reduce<Metricas>(
    (a, m) => {
      a.spend += m.spend;
      a.impressions += m.impressions;
      a.reach += m.reach;
      a.clicks += m.clicks;
      a.linkClicks += m.linkClicks;
      a.landingPageViews += m.landingPageViews;
      a.purchases += m.purchases;
      a.purchaseValue += m.purchaseValue;
      a.addToCart += m.addToCart;
      a.initiateCheckout += m.initiateCheckout;
      a.postEngagement += m.postEngagement;
      a.spendConversao += m.spendConversao;
      a.purchasesConversao += m.purchasesConversao;
      a.receitaConversao += m.receitaConversao;
      return a;
    },
    { ...METRICAS_ZERO },
  );
  t.ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
  t.cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
  t.cpm = t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0;
  t.frequency = t.reach > 0 ? t.impressions / t.reach : 0;
  // ROAS e CPA sempre sobre o investimento de conversão, nunca sobre o total.
  t.roas = t.spendConversao > 0 ? t.receitaConversao / t.spendConversao : 0;
  t.cpa = t.purchasesConversao > 0 ? t.spendConversao / t.purchasesConversao : 0;
  return t;
}

const CAMPOS_INSIGHTS =
  "campaign_id,campaign_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,action_values";

/**
 * Período da consulta.
 *
 * `"maximum"` é o padrão: as campanhas ativas nasceram em 31/07 e 03/08/2026,
 * então um preset de 30 dias só somaria dias vazios e diluiria as médias.
 * Um intervalo explícito vira `time_range` na Marketing API.
 */
export type Periodo = "maximum" | { de: string; ate: string };

export const PERIODO_PADRAO: Periodo = "maximum";

/** Traduz o período nos parâmetros que a Graph API entende. */
function paramsDoPeriodo(p: Periodo): Params {
  return p === "maximum"
    ? { date_preset: "maximum" }
    : { time_range: JSON.stringify({ since: p.de, until: p.ate }) };
}

/** Chave estável para memoização/URL. */
export function chaveDoPeriodo(p: Periodo): string {
  return p === "maximum" ? "maximum" : `${p.de}_${p.ate}`;
}

// ---------------------------------------------------------------- queries

export async function getConta(): Promise<Conta> {
  return graph<Conta>(ACT, { fields: "name,currency,timezone_name,account_status" });
}

export async function getCampanhasAtivas(): Promise<Campanha[]> {
  const data = await graphAll<CampanhaBruta>(`${ACT}/campaigns`, {
    fields:
      "id,name,status,effective_status,objective,lifetime_budget,daily_budget,start_time,stop_time",
    effective_status: JSON.stringify(["ACTIVE"]),
    limit: 200,
  });
  return data.map((c) => ({ ...c, bucket: bucketDaCampanha(c.name) }));
}

function filtroCampanhas(ids: string[]): string {
  return JSON.stringify([{ field: "campaign.id", operator: "IN", value: ids }]);
}

export async function getInsightsPorCampanha(
  ids: string[],
  periodo: Periodo = "maximum",
): Promise<Map<string, Metricas>> {
  if (ids.length === 0) return new Map();
  const rows = await graphAll<LinhaInsight>(`${ACT}/insights`, {
    level: "campaign",
    fields: CAMPOS_INSIGHTS,
    ...paramsDoPeriodo(periodo),
    filtering: filtroCampanhas(ids),
    limit: 500,
  });
  const map = new Map<string, Metricas>();
  for (const r of rows) if (r.campaign_id) map.set(r.campaign_id, metricas(r));
  return map;
}

export async function getSerieDiaria(
  ids: string[],
  periodo: Periodo = "maximum",
): Promise<Map<string, PontoDiario[]>> {
  if (ids.length === 0) return new Map();
  const rows = await graphAll<LinhaInsight>(`${ACT}/insights`, {
    level: "campaign",
    fields: CAMPOS_INSIGHTS,
    ...paramsDoPeriodo(periodo),
    time_increment: 1,
    filtering: filtroCampanhas(ids),
    limit: 500,
  });
  const map = new Map<string, PontoDiario[]>();
  for (const r of rows) {
    if (!r.campaign_id || !r.date_start) continue;
    const m = metricas(r);
    const arr = map.get(r.campaign_id) ?? [];
    arr.push({
      date: r.date_start,
      spend: m.spend,
      impressions: m.impressions,
      reach: m.reach,
      clicks: m.clicks,
      purchases: m.purchases,
      purchaseValue: m.purchaseValue,
      spendConversao: 0,
      receitaConversao: 0,
    });
    map.set(r.campaign_id, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
  return map;
}

/** Breakdown genérico agrupado por campanha. */
export async function getBreakdown(
  ids: string[],
  breakdowns: string,
  periodo: Periodo = "maximum",
): Promise<Map<string, LinhaBreakdown[]>> {
  if (ids.length === 0) return new Map();
  const chaves = breakdowns.split(",");
  const rows = await graphAll<LinhaInsight>(`${ACT}/insights`, {
    level: "campaign",
    fields: "campaign_id,spend,impressions,reach,clicks",
    ...paramsDoPeriodo(periodo),
    breakdowns,
    filtering: filtroCampanhas(ids),
    limit: 500,
  });
  const map = new Map<string, LinhaBreakdown[]>();
  for (const r of rows) {
    if (!r.campaign_id) continue;
    const arr = map.get(r.campaign_id) ?? [];
    arr.push({
      chave: String(r[chaves[0]] ?? "unknown"),
      chave2: chaves[1] ? String(r[chaves[1]] ?? "unknown") : undefined,
      spend: num(r.spend),
      impressions: num(r.impressions),
      reach: num(r.reach),
      clicks: num(r.clicks),
    });
    map.set(r.campaign_id, arr);
  }
  return map;
}

export interface Conjunto {
  id: string;
  nome: string;
  campanhaId: string;
  bucket: Bucket | null;
  m: Metricas;
}

/** Insights no nível de conjunto de anúncios (adset). */
export async function getInsightsPorConjunto(
  campanhas: Campanha[],
  periodo: Periodo = "maximum",
): Promise<Conjunto[]> {
  if (campanhas.length === 0) return [];
  const porId = new Map(campanhas.map((c) => [c.id, c]));
  const rows = await graphAll<LinhaInsight>(`${ACT}/insights`, {
    level: "adset",
    fields: `adset_id,adset_name,${CAMPOS_INSIGHTS}`,
    ...paramsDoPeriodo(periodo),
    filtering: filtroCampanhas(campanhas.map((c) => c.id)),
    limit: 500,
  });
  return rows
    .filter((r) => typeof r.adset_id === "string")
    .map((r) => {
      const campanhaId = r.campaign_id ?? "";
      return {
        id: String(r.adset_id),
        nome: String(r.adset_name ?? "—"),
        campanhaId,
        bucket: porId.get(campanhaId)?.bucket ?? null,
        m: aplicarObjetivo(metricas(r), porId.get(campanhaId)?.objective),
      };
    });
}

export async function getCriativos(
  campanhas: Campanha[],
  periodo: Periodo = "maximum",
): Promise<Criativo[]> {
  const porCampanha = await Promise.all(
    campanhas.map(async (c) => {
      const [ads, insights] = await Promise.all([
        graphAll<AdBruto>(`${c.id}/ads`, {
          // `adset_name` não existe no nó do anúncio — só por expansão aninhada.
          fields:
            "id,name,effective_status,adset{id,name},creative{id,thumbnail_url,image_url,instagram_permalink_url,title,body}",
          limit: 100,
          thumbnail_width: 600,
          thumbnail_height: 600,
        }),
        graphAll<LinhaInsight>(`${c.id}/insights`, {
          level: "ad",
          fields: `ad_id,${CAMPOS_INSIGHTS}`,
          ...paramsDoPeriodo(periodo),
          limit: 200,
        }),
      ]);

      const mi = new Map<string, Metricas>();
      for (const r of insights) if (r.ad_id) mi.set(r.ad_id, aplicarObjetivo(metricas(r), c.objective));

      return ads.map<Criativo>((a) => ({
        adId: a.id,
        adName: a.name,
        status: a.effective_status,
        campanhaId: c.id,
        campanhaNome: c.name,
        conjuntoId: a.adset?.id ?? null,
        conjuntoNome: a.adset?.name ?? null,
        objetivo: c.objective,
        bucket: c.bucket,
        imageUrl: a.creative?.image_url ?? null,
        thumbnailUrl: a.creative?.thumbnail_url ?? null,
        permalink: a.creative?.instagram_permalink_url ?? null,
        titulo: a.creative?.title ?? null,
        corpo: a.creative?.body ?? null,
        m: mi.get(a.id) ?? METRICAS_ZERO,
      }));
    }),
  );
  return porCampanha.flat();
}

/** Junta séries diárias de várias campanhas somando por dia. */
export function fundirSeries(series: PontoDiario[][]): PontoDiario[] {
  const porDia = new Map<string, PontoDiario>();
  for (const s of series) {
    for (const p of s) {
      const cur = porDia.get(p.date);
      if (!cur) {
        porDia.set(p.date, { ...p });
      } else {
        cur.spend += p.spend;
        cur.impressions += p.impressions;
        cur.reach += p.reach;
        cur.clicks += p.clicks;
        cur.purchases += p.purchases;
        cur.purchaseValue += p.purchaseValue;
        cur.spendConversao += p.spendConversao;
        cur.receitaConversao += p.receitaConversao;
      }
    }
  }
  return [...porDia.values()].sort((a, b) => a.date.localeCompare(b.date));
}
