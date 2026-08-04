import "server-only";
import {
  BUCKETS,
  ESCOPO_TODAS,
  PRACA_POR_SLUG,
  PRACAS,
  type Bucket,
  type EscopoSlug,
  type Praca,
} from "./config";
import {
  aplicarObjetivo,
  ehObjetivoConversao,
  fundirSeries,
  getBreakdown,
  getCampanhasAtivas,
  getConta,
  getCriativos,
  getInsightsPorCampanha,
  getInsightsPorConjunto,
  getSerieDiaria,
  METRICAS_ZERO,
  somar,
  type CampanhaComMetricas,
  type Conjunto,
  type Conta,
  type Criativo,
  type LinhaBreakdown,
  type Metricas,
  type Periodo,
  type PontoDiario,
} from "./meta";

/** Um bucket (praça ou campanha nacional) com seus números dentro do escopo. */
export interface FatiaBucket {
  bucket: Bucket;
  campanhas: CampanhaComMetricas[];
  total: Metricas;
  serie: PontoDiario[];
  ativa: boolean;
}

export interface DadosEscopo {
  escopo: EscopoSlug;
  /** Guardado para que breakdowns e criativos usem o mesmo recorte. */
  periodo: Periodo;
  comparativo: boolean;
  /** null quando o escopo é "todas as praças". */
  praca: Praca | null;
  conta: Conta;
  campanhas: CampanhaComMetricas[];
  total: Metricas;
  serie: PontoDiario[];
  /** Sempre preenchido; no escopo de praça única tem um item só. */
  fatias: FatiaBucket[];
  ativo: boolean;
  primeiroDia: string | null;
  ultimoDia: string | null;
}

/**
 * Carrega as campanhas ATIVAS do escopo.
 *
 * Escopo de praça → só as campanhas com a tag daquela praça. A campanha
 * nacional ([TODAS AS PRACAS]) fica de fora porque o gasto dela não é
 * atribuível a uma praça no nível de campanha — ela aparece inteira no escopo
 * "todas as praças", e cada praça mostra a fatia regional dela à parte.
 */
export async function carregarEscopo(
  escopo: EscopoSlug,
  periodo: Periodo = "maximum",
): Promise<DadosEscopo> {
  // Comparação direta (e não via helper) para o TS estreitar EscopoSlug → PracaSlug.
  const praca = escopo === ESCOPO_TODAS ? null : PRACA_POR_SLUG[escopo];
  const comparativo = praca === null;

  const [conta, todas] = await Promise.all([getConta(), getCampanhasAtivas()]);
  const doEscopo = comparativo
    ? todas.filter((c) => c.bucket !== null)
    : todas.filter((c) => c.bucket?.slug === escopo);

  const ids = doEscopo.map((c) => c.id);
  const [insights, series] = await Promise.all([
    getInsightsPorCampanha(ids, periodo),
    getSerieDiaria(ids, periodo),
  ]);

  const campanhas: CampanhaComMetricas[] = doEscopo.map((c) => ({
    ...c,
    m: aplicarObjetivo(insights.get(c.id) ?? METRICAS_ZERO, c.objective),
  }));

  /**
   * Marca o recorte de conversão na série diária. Sem isto a evolução de ROAS
   * dividiria a receita do dia pelo gasto total do dia, incluindo Alcance.
   */
  const serieDaCampanha = (c: (typeof campanhas)[number]): PontoDiario[] => {
    const conv = ehObjetivoConversao(c.objective);
    return (series.get(c.id) ?? []).map((p) => ({
      ...p,
      spendConversao: conv ? p.spend : 0,
      receitaConversao: conv ? p.purchaseValue : 0,
    }));
  };

  const bucketsDoEscopo: Bucket[] = praca === null ? BUCKETS : [praca];
  const fatias: FatiaBucket[] = bucketsDoEscopo.map((b) => {
    const cs = campanhas.filter((c) => c.bucket?.slug === b.slug);
    return {
      bucket: b,
      campanhas: cs,
      total: cs.length ? somar(cs.map((c) => c.m)) : METRICAS_ZERO,
      serie: fundirSeries(cs.map(serieDaCampanha)),
      ativa: cs.length > 0,
    };
  });

  const dias = [...series.values()].flat().map((p) => p.date).sort();

  return {
    escopo,
    periodo,
    comparativo,
    praca,
    conta,
    campanhas,
    total: campanhas.length ? somar(campanhas.map((c) => c.m)) : METRICAS_ZERO,
    serie: fundirSeries(campanhas.map(serieDaCampanha)),
    fatias,
    ativo: campanhas.length > 0,
    primeiroDia: dias[0] ?? null,
    ultimoDia: dias[dias.length - 1] ?? null,
  };
}

export interface Breakdowns {
  plataformas: LinhaBreakdown[];
  posicionamentos: LinhaBreakdown[];
  idadeGenero: LinhaBreakdown[];
  regioes: LinhaBreakdown[];
  dispositivos: LinhaBreakdown[];
  /** Breakdowns por bucket, para os comparativos. */
  porBucket: Map<string, { idadeGenero: LinhaBreakdown[]; plataformas: LinhaBreakdown[] }>;
}

/** Agrupa linhas de breakdown somando por chave (e chave2 quando houver). */
export function agrupar(linhas: LinhaBreakdown[], usarChave2 = false): LinhaBreakdown[] {
  const map = new Map<string, LinhaBreakdown>();
  for (const l of linhas) {
    const k = usarChave2 ? `${l.chave}||${l.chave2}` : l.chave;
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...l });
    } else {
      cur.spend += l.spend;
      cur.impressions += l.impressions;
      cur.reach += l.reach;
      cur.clicks += l.clicks;
    }
  }
  return [...map.values()].sort((a, b) => b.impressions - a.impressions);
}

export async function carregarBreakdowns(d: DadosEscopo): Promise<Breakdowns> {
  const ids = d.campanhas.map((c) => c.id);
  const vazio: Breakdowns = {
    plataformas: [],
    posicionamentos: [],
    idadeGenero: [],
    regioes: [],
    dispositivos: [],
    porBucket: new Map(),
  };
  if (ids.length === 0) return vazio;

  const [plat, demo, reg, dev] = await Promise.all([
    getBreakdown(ids, "publisher_platform,platform_position", d.periodo),
    getBreakdown(ids, "age,gender", d.periodo),
    getBreakdown(ids, "region", d.periodo),
    getBreakdown(ids, "impression_device", d.periodo),
  ]);

  const flat = (m: Map<string, LinhaBreakdown[]>) => [...m.values()].flat();

  // Por bucket: junta as campanhas de cada praça/nacional.
  const porBucket = new Map<string, { idadeGenero: LinhaBreakdown[]; plataformas: LinhaBreakdown[] }>();
  for (const f of d.fatias) {
    const idsB = f.campanhas.map((c) => c.id);
    porBucket.set(f.bucket.slug, {
      idadeGenero: agrupar(idsB.flatMap((id) => demo.get(id) ?? []), true),
      plataformas: agrupar(idsB.flatMap((id) => plat.get(id) ?? [])),
    });
  }

  return {
    plataformas: agrupar(flat(plat)),
    posicionamentos: agrupar(flat(plat), true),
    idadeGenero: agrupar(flat(demo), true),
    regioes: agrupar(flat(reg)),
    dispositivos: agrupar(flat(dev)),
    porBucket,
  };
}

export async function carregarCriativos(d: DadosEscopo): Promise<Criativo[]> {
  if (d.campanhas.length === 0) return [];
  return getCriativos(d.campanhas, d.periodo);
}

export async function carregarConjuntos(d: DadosEscopo): Promise<Conjunto[]> {
  if (d.campanhas.length === 0) return [];
  return getInsightsPorConjunto(d.campanhas, d.periodo);
}

/**
 * Fatia regional da campanha nacional dentro de uma praça.
 * A campanha nacional entrega nas três praças; o breakdown por região é a
 * única forma de saber quanto dela caiu em cada uma.
 */
export interface FatiaNacional {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
}

export async function carregarFatiaNacional(
  praca: Praca,
  periodo: Periodo = "maximum",
): Promise<FatiaNacional | null> {
  const todas = await getCampanhasAtivas();
  const nacionais = todas.filter((c) => c.bucket?.slug === "nacional");
  if (nacionais.length === 0) return null;

  const porRegiao = await getBreakdown(nacionais.map((c) => c.id), "region", periodo);
  const linhas = agrupar([...porRegiao.values()].flat()).filter(
    (l) => l.chave === praca.regiao,
  );
  if (linhas.length === 0) return null;

  return linhas.reduce<FatiaNacional>(
    (a, l) => ({
      spend: a.spend + l.spend,
      impressions: a.impressions + l.impressions,
      reach: a.reach + l.reach,
      clicks: a.clicks + l.clicks,
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0 },
  );
}

export { PRACAS, ESCOPO_TODAS };
