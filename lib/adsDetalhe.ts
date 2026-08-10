import "server-only";
import { consultarAds, intervaloAds } from "./googleAds";
import {
  derivarAds,
  somarAds,
  METRICAS_ADS_ZERO,
  nomeCanal,
  type MetricasAds,
} from "./ads";
import { bucketDaCampanha, ESCOPO_TODAS, type Bucket, type EscopoSlug } from "./config";
export { CAMPO_ATIVO_LABEL } from "./config";
import type { Periodo } from "./meta";

/**
 * Recortes detalhados do Google Ads — palavras-chave, termos de busca, ativos
 * de Performance Max e segmentação.
 *
 * Cada função monta a sua própria consulta porque a API impõe combinações:
 * `geographic_view` não aceita filtro por `campaign.status` nem `ORDER BY`;
 * `asset_group_asset` recusa `performance_label` junto dos campos de conteúdo;
 * e a parcela de impressões só volta sem outros segmentos na mesma linha. Os
 * comentários marcam cada uma dessas restrições onde ela decide o formato.
 */

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const reais = (micros: unknown) => n(micros) / 1e6;

interface LinhaCrua {
  campaign?: { id?: string; name?: string; advertisingChannelType?: string };
  adGroup?: { name?: string };
  metrics?: Record<string, string | number>;
  segments?: Record<string, string | number>;
  adGroupCriterion?: {
    keyword?: { text?: string; matchType?: string };
    qualityInfo?: {
      qualityScore?: number;
      creativeQualityScore?: string;
      postClickQualityScore?: string;
      searchPredictedCtr?: string;
    };
  };
  searchTermView?: { searchTerm?: string; status?: string };
  adGroupAd?: {
    status?: string;
    adStrength?: string;
    ad?: {
      id?: string;
      type?: string;
      finalUrls?: string[];
      responsiveSearchAd?: {
        headlines?: { text?: string }[];
        descriptions?: { text?: string }[];
      };
    };
  };
  assetGroup?: { id?: string; name?: string; adStrength?: string; status?: string };
  assetGroupAsset?: { fieldType?: string };
  asset?: {
    id?: string;
    type?: string;
    textAsset?: { text?: string };
    imageAsset?: { fullSize?: { url?: string } };
  };
  geoTargetConstant?: { id?: string; name?: string; canonicalName?: string };
}

function metricasDe(m: Record<string, string | number> = {}): MetricasAds {
  return derivarAds({
    ...METRICAS_ADS_ZERO,
    custo: reais(m.cost_micros ?? m.costMicros),
    impressoes: n(m.impressions),
    cliques: n(m.clicks),
    conversoes: n(m.conversions),
    receita: n(m.conversions_value ?? m.conversionsValue),
  });
}

/** A linha pertence ao escopo? Vale a mesma regra de praça do resto do painel. */
function noEscopo(nome: string | undefined, escopo: EscopoSlug): Bucket | null | false {
  const b = bucketDaCampanha(nome ?? "");
  if (escopo === ESCOPO_TODAS) return b === null ? false : b;
  return b?.slug === escopo ? b : false;
}

const periodoGaql = (periodo: Periodo) => {
  const { de, ate } = intervaloAds(periodo);
  return `segments.date BETWEEN '${de}' AND '${ate}'`;
};

// ------------------------------------------------------------------ pesquisa

export interface PalavraChave {
  chave: string;
  texto: string;
  correspondencia: string;
  campanha: string;
  bucket: Bucket;
  /** 1 a 10; null quando o Google ainda não calculou (volume baixo). */
  qualidade: number | null;
  qualidadeAnuncio: string | null;
  qualidadeDestino: string | null;
  qualidadeCtrPrevisto: string | null;
  /** Fração do leilão em que o anúncio apareceu (0–1). */
  parcelaImpressoes: number;
  parcelaTopo: number;
  m: MetricasAds;
}

export interface AnuncioPesquisa {
  id: string;
  campanha: string;
  grupo: string;
  bucket: Bucket;
  forca: string;
  titulos: string[];
  descricoes: string[];
  url: string;
  m: MetricasAds;
}

export interface LeilaoCampanha {
  campanha: string;
  bucket: Bucket;
  canal: string;
  parcela: number;
  perdidoOrcamento: number;
  perdidoRanking: number;
  topo: number;
  absolutoTopo: number;
}

export interface DadosPesquisa {
  ativo: boolean;
  total: MetricasAds;
  palavras: PalavraChave[];
  anuncios: AnuncioPesquisa[];
  leilao: LeilaoCampanha[];
}

export const CORRESPONDENCIA_LABEL: Record<string, string> = {
  EXACT: "Exata",
  PHRASE: "Frase",
  BROAD: "Ampla",
  NEAR_EXACT: "Quase exata",
  NEAR_PHRASE: "Quase frase",
};

export const QUALIDADE_LABEL: Record<string, string> = {
  ABOVE_AVERAGE: "Acima da média",
  AVERAGE: "Média",
  BELOW_AVERAGE: "Abaixo da média",
};

export const FORCA_LABEL: Record<string, string> = {
  EXCELLENT: "Excelente",
  GOOD: "Boa",
  AVERAGE: "Média",
  POOR: "Ruim",
  PENDING: "Em análise",
  NO_ADS: "Sem anúncios",
  UNKNOWN: "—",
};

export async function carregarPesquisa(
  escopo: EscopoSlug,
  periodo: Periodo,
): Promise<DadosPesquisa> {
  const P = periodoGaql(periodo);

  const [kw, ads, share] = await Promise.all([
    consultarAds(`
      SELECT campaign.name, ad_group.name,
             ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
             ad_group_criterion.quality_info.quality_score,
             ad_group_criterion.quality_info.creative_quality_score,
             ad_group_criterion.quality_info.post_click_quality_score,
             ad_group_criterion.quality_info.search_predicted_ctr,
             metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value,
             metrics.search_impression_share, metrics.search_top_impression_share
      FROM keyword_view
      WHERE ${P} AND campaign.status = 'ENABLED' AND metrics.impressions > 0
    `) as Promise<LinhaCrua[]>,
    consultarAds(`
      SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.status,
             ad_group_ad.ad_strength, ad_group_ad.ad.final_urls,
             ad_group_ad.ad.responsive_search_ad.headlines,
             ad_group_ad.ad.responsive_search_ad.descriptions,
             metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value
      FROM ad_group_ad
      WHERE ${P} AND campaign.status = 'ENABLED'
    `) as Promise<LinhaCrua[]>,
    // A parcela de impressões só volta quando nenhuma outra métrica de leilão
    // divide a linha — daí a consulta isolada, sem segmentos.
    consultarAds(`
      SELECT campaign.name, campaign.advertising_channel_type,
             metrics.search_impression_share,
             metrics.search_budget_lost_impression_share,
             metrics.search_rank_lost_impression_share,
             metrics.top_impression_percentage,
             metrics.absolute_top_impression_percentage
      FROM campaign WHERE ${P} AND campaign.status = 'ENABLED'
    `) as Promise<LinhaCrua[]>,
  ]);

  /**
   * A mesma palavra aparece uma vez por grupo de anúncios. Somar por texto +
   * correspondência evita a tabela repetir "afropunk salvador" três vezes com
   * fatias do mesmo investimento.
   */
  const porChave = new Map<string, PalavraChave>();
  for (const r of kw) {
    const bucket = noEscopo(r.campaign?.name, escopo);
    if (!bucket) continue;
    const texto = r.adGroupCriterion?.keyword?.text ?? "";
    const corr = r.adGroupCriterion?.keyword?.matchType ?? "";
    if (!texto) continue;
    // A praça entra na chave pelo mesmo motivo dos termos: sem ela o losango
    // de cor mostraria a praça da primeira linha que a API devolvesse.
    const chave = `${texto}|${corr}|${bucket.slug}`;
    const m = metricasDe(r.metrics);
    const q = r.adGroupCriterion?.qualityInfo;
    const atual = porChave.get(chave);
    if (!atual) {
      porChave.set(chave, {
        chave,
        texto,
        correspondencia: corr,
        campanha: r.campaign?.name ?? "",
        bucket,
        qualidade: q?.qualityScore ?? null,
        qualidadeAnuncio: q?.creativeQualityScore ?? null,
        qualidadeDestino: q?.postClickQualityScore ?? null,
        qualidadeCtrPrevisto: q?.searchPredictedCtr ?? null,
        parcelaImpressoes: n(r.metrics?.searchImpressionShare),
        parcelaTopo: n(r.metrics?.searchTopImpressionShare),
        m,
      });
      continue;
    }
    // Parcela de impressões é razão: a média ponderada por impressão é o único
    // agregado honesto; somar daria valores acima de 100%.
    const impTotal = atual.m.impressoes + m.impressoes;
    atual.parcelaImpressoes =
      impTotal > 0
        ? (atual.parcelaImpressoes * atual.m.impressoes +
            n(r.metrics?.searchImpressionShare) * m.impressoes) /
          impTotal
        : 0;
    atual.parcelaTopo =
      impTotal > 0
        ? (atual.parcelaTopo * atual.m.impressoes +
            n(r.metrics?.searchTopImpressionShare) * m.impressoes) /
          impTotal
        : 0;
    atual.m = somarAds([atual.m, m]);
    atual.qualidade = atual.qualidade ?? q?.qualityScore ?? null;
  }

  const palavras = [...porChave.values()].sort((a, b) => b.m.custo - a.m.custo);

  const anuncios: AnuncioPesquisa[] = [];
  for (const r of ads) {
    const bucket = noEscopo(r.campaign?.name, escopo);
    if (!bucket) continue;
    const ad = r.adGroupAd?.ad;
    // Anúncios removidos continuam na resposta com métricas zeradas.
    if (!ad?.responsiveSearchAd || r.adGroupAd?.status === "REMOVED") continue;
    anuncios.push({
      id: ad.id ?? "",
      campanha: r.campaign?.name ?? "",
      grupo: r.adGroup?.name ?? "",
      bucket,
      forca: r.adGroupAd?.adStrength ?? "UNKNOWN",
      titulos: (ad.responsiveSearchAd.headlines ?? []).map((h) => h.text ?? "").filter(Boolean),
      descricoes: (ad.responsiveSearchAd.descriptions ?? [])
        .map((d) => d.text ?? "")
        .filter(Boolean),
      url: ad.finalUrls?.[0] ?? "",
      m: metricasDe(r.metrics),
    });
  }
  anuncios.sort((a, b) => b.m.custo - a.m.custo);

  const leilao: LeilaoCampanha[] = [];
  for (const r of share) {
    const bucket = noEscopo(r.campaign?.name, escopo);
    if (!bucket) continue;
    leilao.push({
      campanha: r.campaign?.name ?? "",
      bucket,
      canal: r.campaign?.advertisingChannelType ?? "",
      parcela: n(r.metrics?.searchImpressionShare),
      perdidoOrcamento: n(r.metrics?.searchBudgetLostImpressionShare),
      perdidoRanking: n(r.metrics?.searchRankLostImpressionShare),
      topo: n(r.metrics?.topImpressionPercentage),
      absolutoTopo: n(r.metrics?.absoluteTopImpressionPercentage),
    });
  }

  return {
    ativo: palavras.length > 0 || anuncios.length > 0,
    total: palavras.length ? somarAds(palavras.map((p) => p.m)) : METRICAS_ADS_ZERO,
    palavras,
    anuncios,
    leilao,
  };
}

// ------------------------------------------------------------------- termos

export interface TermoBusca {
  /** `termo|praça` — o mesmo texto comprado por duas praças são duas linhas. */
  chave: string;
  termo: string;
  status: string;
  correspondencia: string;
  campanha: string;
  bucket: Bucket;
  m: MetricasAds;
}

/**
 * Tipo de busca, lido do texto que a pessoa digitou.
 *
 * A ordem é a proximidade da compra: quem escreve "ingresso" está mais perto de
 * comprar do que quem escreve só o nome do festival. É o único recorte que esta
 * página consegue dar e a tabela não — ela lista termo a termo, isto agrupa por
 * intenção e mostra qual tipo de busca devolve mais por real.
 */
export type TipoBusca = "compra" | "marcaPraca" | "marca" | "outros";

export interface FatiaTipoBusca {
  tipo: TipoBusca;
  nome: string;
  descricao: string;
  termos: number;
  m: MetricasAds;
}

const PALAVRAS_COMPRA = /\b(ingress|comprar|compra|valor|pre[çc]o|quanto custa|onde comprar)/i;

export function tipoDaBusca(termo: string): TipoBusca {
  const t = termo.toLowerCase();
  // Intenção de compra vence: "afropunk salvador ingressos" é compra, não marca.
  if (PALAVRAS_COMPRA.test(t)) return "compra";
  const temMarca = t.includes("afropunk") || t.includes("afro punk");
  const temPraca = /\b(salvador|rio de janeiro|\brj\b|recife|\bssa\b)/i.test(t);
  if (temMarca && temPraca) return "marcaPraca";
  if (temMarca) return "marca";
  return "outros";
}

export const TIPO_BUSCA: { tipo: TipoBusca; nome: string; descricao: string }[] = [
  { tipo: "compra", nome: "Intenção de compra", descricao: "cita ingresso, preço ou onde comprar" },
  { tipo: "marcaPraca", nome: "Marca + praça", descricao: "nome do festival com a cidade" },
  { tipo: "marca", nome: "Marca", descricao: "só o nome do festival" },
  { tipo: "outros", nome: "Outros", descricao: "artista do line-up e buscas soltas" },
];

export interface DadosTermos {
  ativo: boolean;
  total: MetricasAds;
  termos: TermoBusca[];
  /** Termos que ainda não viraram palavra-chave — a fila de oportunidades. */
  naoAdicionados: TermoBusca[];
  /** Termos cuja praça no texto não bate com a praça da campanha. */
  cruzados: TermoBusca[];
}

export const STATUS_TERMO_LABEL: Record<string, string> = {
  ADDED: "Já é palavra-chave",
  EXCLUDED: "Negativada",
  ADDED_EXCLUDED: "Adicionada e negativada",
  NONE: "Ainda não adicionada",
  UNKNOWN: "—",
};

export async function carregarTermos(
  escopo: EscopoSlug,
  periodo: Periodo,
): Promise<DadosTermos> {
  const linhas = (await consultarAds(`
    SELECT campaign.name, search_term_view.search_term, search_term_view.status,
           segments.search_term_match_type,
           metrics.impressions, metrics.clicks, metrics.cost_micros,
           metrics.conversions, metrics.conversions_value
    FROM search_term_view
    WHERE ${periodoGaql(periodo)} AND campaign.status = 'ENABLED'
  `)) as LinhaCrua[];

  /**
   * A chave inclui a praça de propósito. Agrupar só pelo texto juntava o gasto
   * do Rio com o de Salvador na mesma linha e a praça exibida virava a da
   * primeira linha que a API devolvesse — com a ordem instável, o mesmo termo
   * ora aparecia como cruzado, ora não. Grupos de anúncios da mesma praça
   * continuam somando, que é a repetição que não informa nada.
   */
  const porTermo = new Map<string, TermoBusca>();
  for (const r of linhas) {
    const bucket = noEscopo(r.campaign?.name, escopo);
    if (!bucket) continue;
    const termo = r.searchTermView?.searchTerm ?? "";
    if (!termo) continue;
    const chave = `${termo}|${bucket.slug}`;
    const atual = porTermo.get(chave);
    const m = metricasDe(r.metrics);
    if (!atual) {
      porTermo.set(chave, {
        chave,
        termo,
        status: r.searchTermView?.status ?? "UNKNOWN",
        correspondencia: String(r.segments?.searchTermMatchType ?? ""),
        campanha: r.campaign?.name ?? "",
        bucket,
        m,
      });
      continue;
    }
    atual.m = somarAds([atual.m, m]);
    if (atual.status === "NONE" && r.searchTermView?.status === "ADDED") atual.status = "ADDED";
  }

  const termos = [...porTermo.values()].sort((a, b) => b.m.custo - a.m.custo);

  /**
   * Termo "cruzado": o texto cita uma praça diferente da campanha que pagou por
   * ele. Com correspondência ampla isso acontece — e é dinheiro de uma praça
   * comprando busca de outra, que só aparece se for apontado.
   */
  const cruzados = termos.filter((t) => {
    const doTermo = bucketDaCampanha(t.termo.toUpperCase());
    return doTermo !== null && doTermo.slug !== t.bucket.slug;
  });

  return {
    ativo: termos.length > 0,
    total: termos.length ? somarAds(termos.map((t) => t.m)) : METRICAS_ADS_ZERO,
    termos,
    naoAdicionados: termos.filter((t) => t.status === "NONE"),
    cruzados,
  };
}

// --------------------------------------------------------------------- pmax

export interface AtivoPmax {
  id: string;
  campo: string;
  tipo: string;
  texto: string | null;
  imagemUrl: string | null;
  /**
   * Desempenho da peça. Atenção ao somar: no PMax a métrica é do anúncio que
   * INCLUIU o ativo, e o Google monta cada anúncio combinando várias peças.
   * A mesma impressão conta para o título, a imagem e o logo que apareceram
   * juntos — por isso a soma dos ativos passa do total da campanha.
   */
  m: MetricasAds;
}

export interface GrupoAtivos {
  id: string;
  nome: string;
  campanha: string;
  bucket: Bucket;
  forca: string;
  m: MetricasAds;
}

export interface DadosPmax {
  ativo: boolean;
  total: MetricasAds;
  grupos: GrupoAtivos[];
  imagens: AtivoPmax[];
  titulos: AtivoPmax[];
  descricoes: AtivoPmax[];
  outros: AtivoPmax[];
}


export async function carregarPmax(escopo: EscopoSlug, periodo: Periodo): Promise<DadosPmax> {
  const [gruposCrus, ativosCrus] = await Promise.all([
    consultarAds(`
      SELECT campaign.name, asset_group.id, asset_group.name, asset_group.status,
             asset_group.ad_strength,
             metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value
      FROM asset_group WHERE ${periodoGaql(periodo)} AND campaign.status = 'ENABLED'
    `) as Promise<LinhaCrua[]>,
    /*
     * Conteúdo E desempenho da peça na mesma consulta. `performance_label` é
     * que não entra junto — mas as métricas entram, desde que haja filtro de
     * data, e são elas que respondem qual peça está puxando o resultado.
     */
    consultarAds(`
      SELECT campaign.name, asset_group.name, asset_group_asset.field_type,
             asset.id, asset.type, asset.text_asset.text, asset.image_asset.full_size.url,
             metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value
      FROM asset_group_asset
      WHERE ${periodoGaql(periodo)} AND campaign.status = 'ENABLED'
    `) as Promise<LinhaCrua[]>,
  ]);

  const grupos: GrupoAtivos[] = [];
  for (const r of gruposCrus) {
    const bucket = noEscopo(r.campaign?.name, escopo);
    if (!bucket) continue;
    grupos.push({
      id: r.assetGroup?.id ?? "",
      nome: r.assetGroup?.name ?? "—",
      campanha: r.campaign?.name ?? "",
      bucket,
      forca: r.assetGroup?.adStrength ?? "UNKNOWN",
      m: metricasDe(r.metrics),
    });
  }

  const vistos = new Set<string>();
  const imagens: AtivoPmax[] = [];
  const titulos: AtivoPmax[] = [];
  const descricoes: AtivoPmax[] = [];
  const outros: AtivoPmax[] = [];

  for (const r of ativosCrus) {
    const bucket = noEscopo(r.campaign?.name, escopo);
    if (!bucket) continue;
    const campo = r.assetGroupAsset?.fieldType ?? "";
    const id = r.asset?.id ?? "";
    const chave = `${id}|${campo}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const ativo: AtivoPmax = {
      id,
      campo,
      tipo: r.asset?.type ?? "",
      texto: r.asset?.textAsset?.text ?? null,
      imagemUrl: r.asset?.imageAsset?.fullSize?.url ?? null,
      m: metricasDe(r.metrics),
    };
    /*
     * Logo fica fora da galeria ranqueada. Ele entra em TODO anúncio montado
     * pelo Google, então acumula o resultado inteiro da campanha e apareceria
     * sempre em primeiro — sem que isso diga nada sobre escolha de criativo.
     * Vai para `outros`, junto de nome do negócio e chamada para ação.
     */
    const ehLogo = campo === "LOGO" || campo === "LANDSCAPE_LOGO";
    if (ativo.imagemUrl && !ehLogo) imagens.push(ativo);
    else if (campo === "HEADLINE" || campo === "LONG_HEADLINE") titulos.push(ativo);
    else if (campo === "DESCRIPTION") descricoes.push(ativo);
    else outros.push(ativo);
  }

  /*
   * Ordena por resultado, não por tipo: quem abre a página quer ver primeiro a
   * peça que está puxando venda. Empate cai no volume de impressão, para que
   * peça sem entrega não suba à frente de peça testada.
   */
  const porResultado = (a: AtivoPmax, b: AtivoPmax) =>
    b.m.receita - a.m.receita ||
    b.m.conversoes - a.m.conversoes ||
    b.m.impressoes - a.m.impressoes;
  imagens.sort(porResultado);
  titulos.sort(porResultado);
  descricoes.sort(porResultado);

  return {
    ativo: grupos.length > 0,
    total: grupos.length ? somarAds(grupos.map((g) => g.m)) : METRICAS_ADS_ZERO,
    grupos,
    imagens,
    titulos,
    descricoes,
    outros,
  };
}

// -------------------------------------------------------------- segmentação

export interface FatiaNomeada {
  nome: string;
  m: MetricasAds;
}

export interface CelulaHoraDia {
  dia: number;
  hora: number;
  custo: number;
  cliques: number;
  impressoes: number;
  conversoes: number;
}

export interface DadosSegmentacao {
  ativo: boolean;
  total: MetricasAds;
  dispositivos: FatiaNomeada[];
  cidades: FatiaNomeada[];
  horaDia: CelulaHoraDia[];
  porHora: FatiaNomeada[];
  porDia: FatiaNomeada[];
}

export const DISPOSITIVO_ADS_LABEL: Record<string, string> = {
  MOBILE: "Celular",
  DESKTOP: "Computador",
  TABLET: "Tablet",
  CONNECTED_TV: "TV conectada",
  OTHER: "Outros",
};

const DIAS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
export const DIA_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Nomes de cidade ficam em `geo_target_constant`, resolvido em lote e em cache. */
const cacheGeo = new Map<string, string>();

async function nomesDeCidade(recursos: string[]): Promise<Map<string, string>> {
  const faltando = recursos.filter((r) => !cacheGeo.has(r));
  if (faltando.length) {
    // A API limita o tamanho da cláusula IN; lotes de 200 dão folga.
    for (let i = 0; i < faltando.length; i += 200) {
      const lote = faltando.slice(i, i + 200);
      const linhas = (await consultarAds(`
        SELECT geo_target_constant.id, geo_target_constant.name,
               geo_target_constant.canonical_name
        FROM geo_target_constant
        WHERE geo_target_constant.resource_name IN (${lote.map((r) => `'${r}'`).join(",")})
      `)) as LinhaCrua[];
      for (const l of linhas) {
        const id = l.geoTargetConstant?.id;
        if (id) cacheGeo.set(`geoTargetConstants/${id}`, l.geoTargetConstant?.name ?? id);
      }
      for (const r of lote) if (!cacheGeo.has(r)) cacheGeo.set(r, "Não identificada");
    }
  }
  return new Map(recursos.map((r) => [r, cacheGeo.get(r) ?? "Não identificada"]));
}

export async function carregarSegmentacao(
  escopo: EscopoSlug,
  periodo: Periodo,
): Promise<DadosSegmentacao> {
  const P = periodoGaql(periodo);

  const [disp, horas, geo] = await Promise.all([
    consultarAds(`
      SELECT campaign.name, segments.device, metrics.impressions, metrics.clicks,
             metrics.cost_micros, metrics.conversions, metrics.conversions_value
      FROM campaign WHERE ${P} AND campaign.status = 'ENABLED'
    `) as Promise<LinhaCrua[]>,
    consultarAds(`
      SELECT campaign.name, segments.day_of_week, segments.hour,
             metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign WHERE ${P} AND campaign.status = 'ENABLED'
    `) as Promise<LinhaCrua[]>,
    // `geographic_view` não aceita `campaign.status` no WHERE nem `ORDER BY`;
    // o filtro de campanha ativa é feito aqui, pelo nome.
    consultarAds(`
      SELECT campaign.name, segments.geo_target_city, metrics.impressions, metrics.clicks,
             metrics.cost_micros, metrics.conversions, metrics.conversions_value
      FROM geographic_view WHERE ${P}
    `) as Promise<LinhaCrua[]>,
  ]);

  const agrupar = (linhas: LinhaCrua[], chave: (r: LinhaCrua) => string | null) => {
    const mapa = new Map<string, MetricasAds[]>();
    for (const r of linhas) {
      if (!noEscopo(r.campaign?.name, escopo)) continue;
      const k = chave(r);
      if (!k) continue;
      const lista = mapa.get(k) ?? [];
      lista.push(metricasDe(r.metrics));
      mapa.set(k, lista);
    }
    return mapa;
  };

  const mDisp = agrupar(disp, (r) => String(r.segments?.device ?? "") || null);
  const dispositivos: FatiaNomeada[] = [...mDisp.entries()]
    .map(([k, v]) => ({ nome: DISPOSITIVO_ADS_LABEL[k] ?? k, m: somarAds(v) }))
    .sort((a, b) => b.m.custo - a.m.custo);

  // Só campanhas ativas entram; as pausadas ainda aparecem no geographic_view.
  const geoNoEscopo = geo.filter((r) => noEscopo(r.campaign?.name, escopo));
  const recursos = [
    ...new Set(
      geoNoEscopo.map((r) => String(r.segments?.geoTargetCity ?? "")).filter(Boolean),
    ),
  ];
  const nomes = await nomesDeCidade(recursos);
  const mGeo = agrupar(geoNoEscopo, (r) => {
    const rec = String(r.segments?.geoTargetCity ?? "");
    return rec ? (nomes.get(rec) ?? rec) : null;
  });
  const cidades: FatiaNomeada[] = [...mGeo.entries()]
    .map(([k, v]) => ({ nome: k, m: somarAds(v) }))
    .filter((c) => c.m.impressoes > 0)
    .sort((a, b) => b.m.custo - a.m.custo);

  const grade = new Map<string, CelulaHoraDia>();
  for (const r of horas) {
    if (!noEscopo(r.campaign?.name, escopo)) continue;
    const dia = DIAS.indexOf(String(r.segments?.dayOfWeek ?? ""));
    const hora = n(r.segments?.hour);
    if (dia < 0) continue;
    const k = `${dia}|${hora}`;
    const c = grade.get(k) ?? { dia, hora, custo: 0, cliques: 0, impressoes: 0, conversoes: 0 };
    c.custo += reais(r.metrics?.cost_micros ?? r.metrics?.costMicros);
    c.cliques += n(r.metrics?.clicks);
    c.impressoes += n(r.metrics?.impressions);
    c.conversoes += n(r.metrics?.conversions);
    grade.set(k, c);
  }
  const horaDia = [...grade.values()];

  const mHora = agrupar(horas, (r) => String(n(r.segments?.hour)));
  const porHora: FatiaNomeada[] = Array.from({ length: 24 }, (_, h) => ({
    nome: `${String(h).padStart(2, "0")}h`,
    m: somarAds(mHora.get(String(h)) ?? [METRICAS_ADS_ZERO]),
  }));

  const mDia = agrupar(horas, (r) => String(r.segments?.dayOfWeek ?? "") || null);
  const porDia: FatiaNomeada[] = DIAS.map((d, i) => ({
    nome: DIA_LABEL[i],
    m: somarAds(mDia.get(d) ?? [METRICAS_ADS_ZERO]),
  }));

  return {
    ativo: dispositivos.length > 0,
    total: dispositivos.length ? somarAds(dispositivos.map((d) => d.m)) : METRICAS_ADS_ZERO,
    dispositivos,
    cidades,
    horaDia,
    porHora,
    porDia,
  };
}

export { nomeCanal };
