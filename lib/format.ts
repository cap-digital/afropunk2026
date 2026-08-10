const nfBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const nfBRLCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const nfInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nfCompact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const nfDec = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nfBRL0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const brl = (n: number) => nfBRL.format(n || 0);

/**
 * Moeda para espaços estreitos (card de criativo): sem centavos, e compacto
 * só a partir de 10 mil. Com centavos o valor estoura a coluna e trunca.
 */
export const brlCurto = (n: number) =>
  Math.abs(n || 0) >= 10000 ? nfBRLCompact.format(n || 0) : nfBRL0.format(n || 0);
export const brlCompact = (n: number) => nfBRLCompact.format(n || 0);
export const int = (n: number) => nfInt.format(n || 0);
export const compact = (n: number) => nfCompact.format(n || 0);
export const dec = (n: number) => nfDec.format(n || 0);
export const pct = (n: number, casas = 2) =>
  `${(n || 0).toFixed(casas).replace(".", ",")}%`;

/**
 * Conversões do Google Ads. A API devolve valor fracionário quando a conversão
 * é rateada entre cliques (22,198341), mas a maioria vem inteira — mostrar
 * "68,00" onde são 68 vendas só polui. Decimal só quando existe de verdade.
 */
export const conv = (n: number) =>
  Number.isInteger(n || 0) ? nfInt.format(n || 0) : nfDec.format(n || 0);

/** "2026-08-03" → "03/08" */
export function diaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** "2026-08-03" → "03 ago" */
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function diaMesCurto(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d} ${MESES[Number(m) - 1]}`;
}

/** Dias entre hoje e uma data ISO (positivo = futuro). */
export function diasAte(iso: string, hoje = new Date()): number {
  const alvo = new Date(`${iso}T12:00:00-03:00`);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86_400_000);
}
