import "server-only";
import { consultar, intervaloGA4, type Intervalo, type LinhaGA4 } from "./ga4";
import { PRACAS, type Bucket } from "./config";
import type { Periodo } from "./meta";

/**
 * Camada de dados do GA4 para o dashboard.
 *
 * O site é uma página só, com um checkout comum aos três eventos: sessões,
 * canais, dispositivos e funil não são separáveis por cidade. O único recorte
 * por praça vem dos itens de e-commerce (`itemName`).
 */

// -------------------------------------------------------------- por evento

/** Nome do item no GA4 → praça do dashboard. */
const ITEM_PARA_PRACA: { padrao: RegExp; slug: string }[] = [
  { padrao: /brasil/i, slug: "salvador" }, // "Festival AFROPUNK Brasil 2026"
  { padrao: /rio de janeiro/i, slug: "rio-de-janeiro" },
  { padrao: /recife/i, slug: "recife" },
];

export function pracaDoItem(itemName: string): Bucket | null {
  const m = ITEM_PARA_PRACA.find((x) => x.padrao.test(itemName));
  return m ? (PRACAS.find((p) => p.slug === m.slug) ?? null) : null;
}

// ------------------------------------------------------------------ tipos

export interface TotaisSite {
  sessoes: number;
  usuarios: number;
  novosUsuarios: number;
  visualizacoes: number;
  taxaEngajamento: number;
  duracaoMedia: number;
  transacoes: number;
  receita: number;
  adicoesCarrinho: number;
  checkouts: number;
  taxaConversao: number;
  ticketMedio: number;
}

export interface PontoDia {
  date: string;
  sessoes: number;
  transacoes: number;
  receita: number;
  [chave: string]: string | number;
}

export interface EtapaFunil {
  nome: string;
  valor: number;
}

export interface LinhaCanal {
  nome: string;
  sessoes: number;
  transacoes: number;
  receita: number;
  taxaConversao: number;
}

export interface EventoVendas {
  itemName: string;
  bucket: Bucket | null;
  receita: number;
  ingressos: number;
  ticketMedio: number;
  adicoesCarrinho: number;
  checkouts: number;
}

export interface TipoIngresso {
  categoria: string;
  itemName: string;
  bucket: Bucket | null;
  receita: number;
  ingressos: number;
}

/**
 * A GA4 Data API aceita no máximo 10 métricas por consulta, e são 12 —
 * por isso vão em dois blocos, somados depois.
 */
const METRICAS_A = [
  "sessions",
  "totalUsers",
  "newUsers",
  "screenPageViews",
  "engagementRate",
  "averageSessionDuration",
];
const METRICAS_B = [
  "transactions",
  "purchaseRevenue",
  "addToCarts",
  "checkouts",
  "sessionConversionRate",
  "averagePurchaseRevenue",
];
/** Totais do site, em dois blocos por causa do limite de métricas. */
async function carregarTotais(intervalo: Intervalo): Promise<TotaisSite> {
  const [a, b] = await Promise.all([
    consultar({ intervalo, metricas: METRICAS_A, limite: 1 }),
    consultar({ intervalo, metricas: METRICAS_B, limite: 1 }),
  ]);
  return montarTotais([
    ...(a[0]?.vals ?? METRICAS_A.map(() => 0)),
    ...(b[0]?.vals ?? METRICAS_B.map(() => 0)),
  ]);
}

function montarTotais(v: number[]): TotaisSite {
  const [
    sessoes,
    usuarios,
    novosUsuarios,
    visualizacoes,
    taxaEngajamento,
    duracaoMedia,
    transacoes,
    receita,
    adicoesCarrinho,
    checkouts,
    taxaConversao,
    ticketMedio,
  ] = v;
  return {
    sessoes,
    usuarios,
    novosUsuarios,
    visualizacoes,
    taxaEngajamento,
    duracaoMedia,
    transacoes,
    receita,
    adicoesCarrinho,
    checkouts,
    taxaConversao,
    ticketMedio,
  };
}

// -------------------------------------------------------------- consultas

export interface VisaoGeralGA4 {
  intervalo: Intervalo;
  totais: TotaisSite;
  serie: PontoDia[];
  funil: EtapaFunil[];
  primeiroDia: string | null;
  ultimoDia: string | null;
}

/** "20260807" → "2026-08-07", para o eixo de tempo dos gráficos. */
const paraISO = (d: string) =>
  d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d;

export async function carregarVisaoGeralGA4(periodo: Periodo): Promise<VisaoGeralGA4> {
  const intervalo = intervaloGA4(periodo);

  const [totais, dias] = await Promise.all([
    carregarTotais(intervalo),
    consultar({
      intervalo,
      dimensoes: ["date"],
      metricas: ["sessions", "transactions", "purchaseRevenue"],
      limite: 400,
    }),
  ]);

  const serie: PontoDia[] = dias
    .map((l) => ({
      date: paraISO(l.dims[0]),
      sessoes: l.vals[0],
      transacoes: l.vals[1],
      receita: l.vals[2],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Funil do site. `screenPageViews` fica de fora: visualização é entrega, não
  // etapa de compra — a mesma regra usada no funil do Meta.
  const funil: EtapaFunil[] = [
    { nome: "Sessões", valor: totais.sessoes },
    { nome: "Adições ao carrinho", valor: totais.adicoesCarrinho },
    { nome: "Checkouts iniciados", valor: totais.checkouts },
    { nome: "Compras", valor: totais.transacoes },
  ];

  return {
    intervalo,
    totais,
    serie,
    funil,
    primeiroDia: serie[0]?.date ?? null,
    ultimoDia: serie[serie.length - 1]?.date ?? null,
  };
}

export interface AquisicaoGA4 {
  intervalo: Intervalo;
  totais: TotaisSite;
  canais: LinhaCanal[];
  origens: LinhaCanal[];
  dispositivos: LinhaCanal[];
}

function paraCanal(l: LinhaGA4): LinhaCanal {
  const [sessoes, transacoes, receita] = l.vals;
  return {
    nome: l.dims[0],
    sessoes,
    transacoes,
    receita,
    taxaConversao: sessoes > 0 ? (transacoes / sessoes) * 100 : 0,
  };
}

export async function carregarAquisicaoGA4(periodo: Periodo): Promise<AquisicaoGA4> {
  const intervalo = intervaloGA4(periodo);
  const mets = ["sessions", "transactions", "purchaseRevenue"];

  const [totais, canais, origens, dispositivos] = await Promise.all([
    carregarTotais(intervalo),
    consultar({
      intervalo,
      dimensoes: ["sessionDefaultChannelGroup"],
      metricas: mets,
      ordenarPor: "sessions",
      limite: 12,
    }),
    consultar({
      intervalo,
      dimensoes: ["sessionSourceMedium"],
      metricas: mets,
      ordenarPor: "sessions",
      limite: 10,
    }),
    consultar({
      intervalo,
      dimensoes: ["deviceCategory"],
      metricas: mets,
      ordenarPor: "sessions",
      limite: 6,
    }),
  ]);

  // Métrica zerada não entra: linha de canal sem sessão é ruído.
  const comDado = (l: LinhaCanal) => l.sessoes > 0;

  return {
    intervalo,
    totais,
    canais: canais.map(paraCanal).filter(comDado),
    origens: origens.map(paraCanal).filter(comDado),
    dispositivos: dispositivos.map(paraCanal).filter(comDado),
  };
}

export interface VendasGA4 {
  intervalo: Intervalo;
  totais: TotaisSite;
  eventos: EventoVendas[];
  tipos: TipoIngresso[];
}

export async function carregarVendasGA4(periodo: Periodo): Promise<VendasGA4> {
  const intervalo = intervaloGA4(periodo);

  const [totais, itens, categorias] = await Promise.all([
    carregarTotais(intervalo),
    consultar({
      intervalo,
      dimensoes: ["itemName"],
      // `itemsViewed` não é rastreado nesta propriedade: volta sempre zero,
      // então o funil por evento começa no carrinho.
      metricas: ["itemRevenue", "itemsPurchased", "itemsAddedToCart", "itemsCheckedOut"],
      ordenarPor: "itemRevenue",
      limite: 20,
    }),
    consultar({
      intervalo,
      dimensoes: ["itemName", "itemCategory"],
      metricas: ["itemRevenue", "itemsPurchased"],
      ordenarPor: "itemRevenue",
      limite: 60,
    }),
  ]);

  const eventos: EventoVendas[] = itens
    .filter((l) => (l.vals[0] > 0 || l.vals[1] > 0) && pracaDoItem(l.dims[0]) !== null)
    .map((l) => ({
      itemName: l.dims[0],
      bucket: pracaDoItem(l.dims[0]),
      receita: l.vals[0],
      ingressos: l.vals[1],
      ticketMedio: l.vals[1] > 0 ? l.vals[0] / l.vals[1] : 0,
      adicoesCarrinho: l.vals[2],
      checkouts: l.vals[3],
    }));

  const tipos: TipoIngresso[] = categorias
    .filter((l) => l.vals[0] > 0)
    .map((l) => ({
      itemName: l.dims[0],
      categoria: l.dims[1].trim() || "(sem categoria)",
      bucket: pracaDoItem(l.dims[0]),
      receita: l.vals[0],
      ingressos: l.vals[1],
    }));

  return {
    intervalo,
    totais,
    eventos,
    tipos,
  };
}
