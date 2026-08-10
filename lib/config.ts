/**
 * Escopos e praças do AFROPUNK 2026.
 *
 * A praça é escolhida na capa e vira o ESCOPO do dashboard. Dentro do dash a
 * navegação é por plataforma (Meta / Google) — não há troca de praça pela
 * lateral; para trocar, volta-se para a capa.
 *
 * Cores da paleta validada (validate_palette.js, superfície #141413), na ordem
 * de render Rio → Recife → Salvador → Nacional: pior par adjacente ΔE 10,0 sob
 * deuteranopia, todas ≥ 3:1. Não reordene sem revalidar.
 */

export type PracaSlug = "rio-de-janeiro" | "recife" | "salvador";
export type EscopoSlug = PracaSlug | "todas-as-pracas";

/** Qualquer coisa que possa ser uma série/cor num gráfico comparativo. */
export interface Bucket {
  slug: string;
  nome: string;
  cor: string;
}

export interface Praca extends Bucket {
  slug: PracaSlug;
  uf: string;
  marca: "AFROPUNK EXPERIENCE" | "AFROPUNK BRASIL";
  data: string;
  dataISO: string;
  local: string;
  /** Tags no nome da campanha que identificam a praça. */
  tags: string[];
  /** Nome da região no breakdown do Meta, para atribuir a campanha nacional. */
  regiao: string;
}

export const PRACAS: Praca[] = [
  {
    slug: "rio-de-janeiro",
    nome: "Rio de Janeiro",
    uf: "RJ",
    marca: "AFROPUNK EXPERIENCE",
    data: "27 JUN",
    dataISO: "2026-06-27",
    local: "Terreirão do Samba",
    cor: "#7F73E0",
    tags: ["[RJ]", "RIO DE JANEIRO"],
    regiao: "Rio de Janeiro",
  },
  {
    slug: "recife",
    nome: "Recife",
    uf: "PE",
    marca: "AFROPUNK EXPERIENCE",
    data: "12 SET",
    dataISO: "2026-09-12",
    local: "UFPE",
    cor: "#1B9DB2",
    tags: ["[RECIFE]"],
    regiao: "Pernambuco",
  },
  {
    slug: "salvador",
    nome: "Salvador",
    uf: "BA",
    marca: "AFROPUNK BRASIL",
    data: "7 E 8 NOV",
    dataISO: "2026-11-07",
    local: "Pq. Exposições Salvador",
    cor: "#C08A12",
    tags: ["[SSA]", "SALVADOR"],
    regiao: "Bahia",
  },
];

/**
 * Bucket da campanha nacional ([TODAS AS PRACAS]). Não é uma praça — é uma
 * campanha que entrega nas três — mas precisa de identidade própria nos
 * comparativos, senão o investimento dela sumiria da conta.
 */
export const NACIONAL: Bucket = {
  slug: "nacional",
  nome: "Campanha Nacional",
  cor: "#D14A80",
};

const TAGS_NACIONAL = ["[TODAS AS PRACAS]", "[TODAS AS PRAÇAS]"];

export const PRACA_POR_SLUG = Object.fromEntries(
  PRACAS.map((p) => [p.slug, p]),
) as Record<PracaSlug, Praca>;

export const ESCOPO_TODAS = "todas-as-pracas" as const;

export const ESCOPOS: EscopoSlug[] = [...PRACAS.map((p) => p.slug), ESCOPO_TODAS];

export function ehEscopoValido(s: string): s is EscopoSlug {
  return (ESCOPOS as string[]).includes(s);
}

export function ehComparativo(escopo: EscopoSlug): boolean {
  return escopo === ESCOPO_TODAS;
}

/** Nome exibido no cabeçalho para qualquer escopo. */
export function nomeDoEscopo(escopo: EscopoSlug): string {
  return escopo === ESCOPO_TODAS ? "Todas as Praças" : PRACA_POR_SLUG[escopo].nome;
}

/** Ordem de render dos buckets nos comparativos (a ordem validada). */
export const BUCKETS: Bucket[] = [...PRACAS, NACIONAL];

/**
 * Descobre o bucket de uma campanha pelo nome.
 * "[CONVERSAO AFROPUNK - RECIFE 2026] … [RECIFE]" → recife
 * "[ALCANCE AFROPUNK 2026] … [TODAS AS PRACAS]"   → nacional
 */
export function bucketDaCampanha(nome: string): Bucket | null {
  const upper = nome.toUpperCase();
  // Nacional primeiro: é a tag mais específica.
  if (TAGS_NACIONAL.some((t) => upper.includes(t))) return NACIONAL;
  for (const p of PRACAS) {
    if (p.tags.some((t) => upper.includes(t))) return p;
  }
  return null;
}

/** A campanha pertence ao escopo? No escopo "todas", tudo pertence. */
export function campanhaNoEscopo(nome: string, escopo: EscopoSlug): boolean {
  if (escopo === ESCOPO_TODAS) return true;
  return bucketDaCampanha(nome)?.slug === escopo;
}

export const OBJETIVO_LABEL: Record<string, string> = {
  OUTCOME_SALES: "Conversão",
  OUTCOME_AWARENESS: "Alcance",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_LEADS: "Leads",
  OUTCOME_APP_PROMOTION: "App",
};

/** Nome curto da campanha: primeira tag, sem "AFROPUNK". */
export function nomeCurtoCampanha(nome: string): string {
  const partes = nome.match(/\[([^\]]+)\]/g);
  if (!partes || partes.length === 0) return nome;
  return partes[0].replace(/[[\]]/g, "").replace(/AFROPUNK\s*-?\s*/i, "").trim() || nome;
}

export const PLATAFORMA_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  audience_network: "Audience Network",
  messenger: "Messenger",
  threads: "Threads",
  unknown: "Outros",
};

export const POSICIONAMENTO_LABEL: Record<string, string> = {
  feed: "Feed",
  instagram_stories: "Stories",
  instagram_reels: "Reels",
  instagram_explore: "Explorar",
  instagram_explore_grid_home: "Explorar (grid)",
  facebook_reels: "Reels (FB)",
  instream_video: "Vídeo in-stream",
  video_feeds: "Feed de vídeo",
  right_hand_column: "Coluna direita",
  marketplace: "Marketplace",
  story: "Stories",
  search: "Busca",
  an_classic: "Audience Network",
  rewarded_video: "Vídeo premiado",
  profile_feed: "Feed de perfil",
  profile_reels: "Reels de perfil",
};

export const DISPOSITIVO_LABEL: Record<string, string> = {
  android_smartphone: "Android",
  iphone: "iPhone",
  ipad: "iPad",
  android_tablet: "Tablet Android",
  desktop: "Desktop",
  other: "Outros",
  unknown: "Não identificado",
};

/**
 * Campos de ativo do Performance Max. Fica aqui, junto dos outros dicionários,
 * porque a galeria é componente de cliente e `lib/adsDetalhe.ts` é `server-only`
 * — rótulo é dado de apresentação, não de acesso à API.
 * Nomes curtos: a legenda tem a largura de uma miniatura.
 */
export const CAMPO_ATIVO_LABEL: Record<string, string> = {
  HEADLINE: "Título",
  LONG_HEADLINE: "Título longo",
  DESCRIPTION: "Descrição",
  MARKETING_IMAGE: "Paisagem",
  SQUARE_MARKETING_IMAGE: "Quadrada",
  PORTRAIT_MARKETING_IMAGE: "Retrato",
  LOGO: "Logo",
  LANDSCAPE_LOGO: "Logo horizontal",
  BUSINESS_NAME: "Nome do negócio",
  YOUTUBE_VIDEO: "Vídeo",
  CALL_TO_ACTION_SELECTION: "Chamada para ação",
};
