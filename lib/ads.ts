import "server-only";
import { consultarAds, intervaloAds } from "./googleAds";
import {
  BUCKETS,
  bucketDaCampanha,
  ESCOPO_TODAS,
  PRACA_POR_SLUG,
  type Bucket,
  type EscopoSlug,
  type Praca,
} from "./config";
import type { Periodo } from "./meta";

/**
 * Camada de dados do Google Ads.
 *
 * A praça sai do nome da campanha, pelo mesmo mapeador do Meta: os nomes
 * seguem `[PESQUISA] [VENDAS] [AFROPUNK - RIO DE JANEIRO 2026]`, e as tags de
 * praça em lib/config.ts já cobrem "RIO DE JANEIRO" e "SALVADOR". Campanhas
 * de edições passadas (Belém, São Paulo, 2025/MA) não casam com nenhuma tag e
 * ficam de fora — além de já serem filtradas por `status = ENABLED`.
 */

export interface MetricasAds {
  custo: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  conversoes: number;
  receita: number;
  roas: number;
  cpa: number;
}

export const METRICAS_ADS_ZERO: MetricasAds = {
  custo: 0,
  impressoes: 0,
  cliques: 0,
  ctr: 0,
  cpc: 0,
  conversoes: 0,
  receita: 0,
  roas: 0,
  cpa: 0,
};

export interface CampanhaAds {
  id: string;
  nome: string;
  canal: string;
  orcamentoDiario: number;
  bucket: Bucket | null;
  m: MetricasAds;
}

export interface PontoDiaAds {
  date: string;
  custo: number;
  cliques: number;
  conversoes: number;
  receita: number;
  [chave: string]: string | number;
}

export interface FatiaAds {
  bucket: Bucket;
  campanhas: CampanhaAds[];
  total: MetricasAds;
  ativa: boolean;
}

/**
 * Recorte por canal de veiculação. Pesquisa e Performance Max são produtos
 * diferentes — intenção declarada contra descoberta automática — e entregam
 * CTR e ROAS de ordens distintas. Somar os dois num número só esconde
 * exatamente a decisão que o painel precisa sustentar (para onde vai a verba),
 * então o canal vem separado da camada de dados, não só como coluna de tabela.
 */
export interface FatiaCanalAds {
  canal: string;
  nome: string;
  campanhas: CampanhaAds[];
  total: MetricasAds;
}

export interface DadosAds {
  escopo: EscopoSlug;
  comparativo: boolean;
  praca: Praca | null;
  campanhas: CampanhaAds[];
  total: MetricasAds;
  serie: PontoDiaAds[];
  fatias: FatiaAds[];
  canais: FatiaCanalAds[];
  ativo: boolean;
  primeiroDia: string | null;
  ultimoDia: string | null;
}

/** Nomes de canal da API em rótulo legível. */
export const CANAL_LABEL: Record<string, string> = {
  SEARCH: "Pesquisa",
  PERFORMANCE_MAX: "Performance Max",
  DISPLAY: "Display",
  VIDEO: "Vídeo",
  DEMAND_GEN: "Demand Gen",
  SHOPPING: "Shopping",
  MULTI_CHANNEL: "Multicanal",
};

/** Ordem fixa de render dos canais — a cor de cada um não pode dançar. */
const ORDEM_CANAL = [
  "SEARCH",
  "PERFORMANCE_MAX",
  "DEMAND_GEN",
  "DISPLAY",
  "VIDEO",
  "SHOPPING",
  "MULTI_CHANNEL",
];

export const nomeCanal = (canal: string) => CANAL_LABEL[canal] ?? canal;

/**
 * Quais canais do Google existem neste escopo.
 *
 * Consulta própria, sem recorte de data nem métrica: é a mais barata possível e
 * a mais cacheável, porque a lateral a pede em toda página só para decidir o
 * que mostrar. Praça sem campanha no canal não ganha item de menu — em vez de
 * um link que leva a uma tela explicando que não há nada.
 */
export async function canaisDoEscopo(escopo: EscopoSlug): Promise<string[]> {
  const linhas = (await consultarAds(`
    SELECT campaign.name, campaign.advertising_channel_type
    FROM campaign WHERE campaign.status = 'ENABLED'
  `)) as LinhaCampanha[];

  const canais = new Set<string>();
  for (const r of linhas) {
    const bucket = bucketDaCampanha(r.campaign?.name ?? "");
    if (!bucket) continue;
    if (escopo !== ESCOPO_TODAS && bucket.slug !== escopo) continue;
    const canal = r.campaign?.advertisingChannelType;
    if (canal) canais.add(canal);
  }
  return [...canais];
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Custo vem em micros; CTR vem como fração. */
const reais = (micros: unknown) => n(micros) / 1e6;

export function derivarAds(m: MetricasAds): MetricasAds {
  return derivar(m);
}

function derivar(m: MetricasAds): MetricasAds {
  return {
    ...m,
    ctr: m.impressoes > 0 ? (m.cliques / m.impressoes) * 100 : 0,
    cpc: m.cliques > 0 ? m.custo / m.cliques : 0,
    roas: m.custo > 0 ? m.receita / m.custo : 0,
    cpa: m.conversoes > 0 ? m.custo / m.conversoes : 0,
  };
}

export function somarAds(lista: MetricasAds[]): MetricasAds {
  const t = lista.reduce<MetricasAds>(
    (a, m) => ({
      ...a,
      custo: a.custo + m.custo,
      impressoes: a.impressoes + m.impressoes,
      cliques: a.cliques + m.cliques,
      conversoes: a.conversoes + m.conversoes,
      receita: a.receita + m.receita,
    }),
    { ...METRICAS_ADS_ZERO },
  );
  return derivar(t);
}

// ------------------------------------------------------------------ tipos crus

interface LinhaCampanha {
  campaign?: { id?: string; name?: string; advertisingChannelType?: string };
  campaignBudget?: { amountMicros?: string };
  metrics?: Record<string, string | number>;
  segments?: { date?: string };
}

const PERIODO_GAQL = (de: string, ate: string) =>
  `segments.date BETWEEN '${de}' AND '${ate}'`;

/**
 * Carrega as campanhas ATIVAS do Google Ads no escopo pedido.
 * Escopo de praça → só as campanhas daquela praça; escopo "todas" → todas as
 * que casam com alguma praça.
 */
export async function carregarAds(
  escopo: EscopoSlug,
  periodo: Periodo,
): Promise<DadosAds> {
  const praca = escopo === ESCOPO_TODAS ? null : PRACA_POR_SLUG[escopo];
  const comparativo = praca === null;
  const { de, ate } = intervaloAds(periodo);

  const [linhas, dias] = await Promise.all([
    consultarAds(`
      SELECT campaign.id, campaign.name, campaign.advertising_channel_type,
             campaign_budget.amount_micros,
             metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE campaign.status = 'ENABLED' AND ${PERIODO_GAQL(de, ate)}
    `) as Promise<LinhaCampanha[]>,
    consultarAds(`
      SELECT segments.date, campaign.name,
             metrics.cost_micros, metrics.clicks,
             metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE campaign.status = 'ENABLED' AND ${PERIODO_GAQL(de, ate)}
      ORDER BY segments.date
    `) as Promise<LinhaCampanha[]>,
  ]);

  const todas: CampanhaAds[] = linhas.map((r) => {
    const m = r.metrics ?? {};
    return {
      id: String(r.campaign?.id ?? ""),
      nome: r.campaign?.name ?? "—",
      canal: r.campaign?.advertisingChannelType ?? "",
      orcamentoDiario: reais(r.campaignBudget?.amountMicros),
      bucket: bucketDaCampanha(r.campaign?.name ?? ""),
      m: derivar({
        ...METRICAS_ADS_ZERO,
        custo: reais(m.cost_micros ?? m.costMicros),
        impressoes: n(m.impressions),
        cliques: n(m.clicks),
        conversoes: n(m.conversions),
        receita: n(m.conversions_value ?? m.conversionsValue),
      }),
    };
  });

  // Só o que casa com alguma praça: campanhas de edições passadas ficam fora.
  const campanhas = comparativo
    ? todas.filter((c) => c.bucket !== null)
    : todas.filter((c) => c.bucket?.slug === escopo);
  const nomesNoEscopo = new Set(campanhas.map((c) => c.nome));

  const bucketsDoEscopo: Bucket[] = praca === null ? BUCKETS : [praca];
  const fatias: FatiaAds[] = bucketsDoEscopo.map((b) => {
    const cs = campanhas.filter((c) => c.bucket?.slug === b.slug);
    return {
      bucket: b,
      campanhas: cs,
      total: cs.length ? somarAds(cs.map((c) => c.m)) : METRICAS_ADS_ZERO,
      ativa: cs.length > 0,
    };
  });

  const posCanal = (c: string) => {
    const i = ORDEM_CANAL.indexOf(c);
    return i === -1 ? ORDEM_CANAL.length : i;
  };
  const canaisPresentes = [...new Set(campanhas.map((c) => c.canal))].sort(
    (a, b) => posCanal(a) - posCanal(b),
  );
  const canais: FatiaCanalAds[] = canaisPresentes.map((canal) => {
    const cs = campanhas.filter((c) => c.canal === canal);
    return { canal, nome: nomeCanal(canal), campanhas: cs, total: somarAds(cs.map((c) => c.m)) };
  });

  /**
   * Série diária agregada, restrita às campanhas do escopo. Além do total, cada
   * ponto carrega uma chave por canal (`custo_SEARCH`, `receita_SEARCH`…) e uma
   * por praça (`custo_salvador`…). O recorte por canal existe para não somar
   * Pesquisa com Performance Max numa linha só; o de praça, para a capa poder
   * montar a evolução consolidada de cada praça sem uma chamada extra à API.
   */
  const canalPorNome = new Map(campanhas.map((c) => [c.nome, c.canal] as const));
  const bucketPorNome = new Map(campanhas.map((c) => [c.nome, c.bucket?.slug] as const));
  const bucketsPresentes = [
    ...new Set(campanhas.map((c) => c.bucket?.slug).filter((s): s is string => Boolean(s))),
  ];
  const porDia = new Map<string, PontoDiaAds>();
  for (const r of dias) {
    const data = r.segments?.date;
    const nome = r.campaign?.name ?? "";
    if (!data || !nomesNoEscopo.has(nome)) continue;
    const m = r.metrics ?? {};
    const atual = porDia.get(data) ?? {
      date: data,
      custo: 0,
      cliques: 0,
      conversoes: 0,
      receita: 0,
      ...Object.fromEntries(
        [...canaisPresentes, ...bucketsPresentes].flatMap((c) => [
          [`custo_${c}`, 0],
          [`receita_${c}`, 0],
        ]),
      ),
    };
    const custo = reais(m.cost_micros ?? m.costMicros);
    const receita = n(m.conversions_value ?? m.conversionsValue);
    atual.custo += custo;
    atual.cliques += n(m.clicks);
    atual.conversoes += n(m.conversions);
    atual.receita += receita;
    for (const chave of [canalPorNome.get(nome), bucketPorNome.get(nome)]) {
      if (!chave) continue;
      atual[`custo_${chave}`] = ((atual[`custo_${chave}`] as number) ?? 0) + custo;
      atual[`receita_${chave}`] = ((atual[`receita_${chave}`] as number) ?? 0) + receita;
    }
    porDia.set(data, atual);
  }
  const serie = [...porDia.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    escopo,
    comparativo,
    praca,
    campanhas,
    total: campanhas.length ? somarAds(campanhas.map((c) => c.m)) : METRICAS_ADS_ZERO,
    serie,
    fatias,
    canais,
    ativo: campanhas.length > 0,
    primeiroDia: serie[0]?.date ?? null,
    ultimoDia: serie[serie.length - 1]?.date ?? null,
  };
}
