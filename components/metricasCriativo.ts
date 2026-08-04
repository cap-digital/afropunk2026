import type { Criativo } from "@/lib/meta";
import { brl, compact, dec, int, pct } from "@/lib/format";

export type ChaveMetrica =
  | "investimento"
  | "roas"
  | "ctr"
  | "compras"
  | "cpa"
  | "impressoes";

export interface Metrica {
  chave: ChaveMetrica;
  rotulo: string;
  /** Rótulo curto, para caber nas três colunas do card. */
  curto: string;
  valor: (c: Criativo) => string;
  /** Ordenação decrescente por padrão; CPA é o único "menor é melhor". */
  comparar: (a: Criativo, b: Criativo) => number;
  /** Verde quando o número é bom por si só (hoje, só ROAS ≥ 1). */
  bom?: (c: Criativo) => boolean;
}

const semCompra = Number.POSITIVE_INFINITY;

export const METRICAS: Metrica[] = [
  {
    chave: "investimento",
    rotulo: "Maior investimento",
    curto: "Invest.",
    valor: (c) => brl(c.m.spend),
    comparar: (a, b) => b.m.spend - a.m.spend,
  },
  {
    chave: "roas",
    rotulo: "Melhor ROAS",
    curto: "ROAS",
    valor: (c) => (c.m.roas > 0 ? `${dec(c.m.roas)}×` : "—"),
    // Sem receita vai para o fim: ROAS 0 é "não converteu", não "converteu mal".
    comparar: (a, b) => b.m.roas - a.m.roas || b.m.purchaseValue - a.m.purchaseValue,
    bom: (c) => c.m.roas >= 1,
  },
  {
    chave: "ctr",
    rotulo: "Melhor CTR",
    curto: "CTR",
    valor: (c) => pct(c.m.ctr, 1),
    comparar: (a, b) => b.m.ctr - a.m.ctr,
  },
  {
    chave: "compras",
    rotulo: "Mais compras",
    curto: "Compras",
    valor: (c) => int(c.m.purchases),
    comparar: (a, b) => b.m.purchases - a.m.purchases || b.m.purchaseValue - a.m.purchaseValue,
  },
  {
    chave: "cpa",
    rotulo: "Menor CPA",
    curto: "CPA",
    valor: (c) => (c.m.purchases > 0 ? brl(c.m.cpa) : "—"),
    // CPA 0 significa "nenhuma compra", não "custo zero".
    comparar: (a, b) =>
      (a.m.cpa > 0 ? a.m.cpa : semCompra) - (b.m.cpa > 0 ? b.m.cpa : semCompra),
  },
  {
    chave: "impressoes",
    rotulo: "Mais impressões",
    curto: "Impr.",
    valor: (c) => compact(c.m.impressions),
    comparar: (a, b) => b.m.impressions - a.m.impressions,
  },
];

export const METRICA_POR_CHAVE = Object.fromEntries(
  METRICAS.map((m) => [m.chave, m]),
) as Record<ChaveMetrica, Metrica>;

/** Métricas exibidas quando nenhuma ordenação específica está ativa. */
const PADRAO: ChaveMetrica[] = ["investimento", "roas", "ctr"];

/**
 * As três métricas do card. A ordenada vem sempre primeiro — se não estava
 * entre as padrão, ela desloca a última, porque o número pelo qual a grade
 * está ordenada precisa estar visível.
 */
export function metricasDoCard(destaque?: ChaveMetrica): Metrica[] {
  if (!destaque) return PADRAO.map((k) => METRICA_POR_CHAVE[k]);
  const resto = PADRAO.filter((k) => k !== destaque);
  return [destaque, ...resto].slice(0, 3).map((k) => METRICA_POR_CHAVE[k]);
}
