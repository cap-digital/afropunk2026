import type { Periodo } from "./meta";

export type ParamsBusca = { [k: string]: string | string[] | undefined };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const primeiro = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/**
 * Lê `?de=YYYY-MM-DD&ate=YYYY-MM-DD` da URL.
 * Datas inválidas ou incompletas caem no padrão (`maximum`), que é o histórico
 * inteiro — as campanhas são novas, então é o recorte mais útil.
 */
export function periodoDeParams(sp?: ParamsBusca): Periodo {
  const de = primeiro(sp?.de);
  const ate = primeiro(sp?.ate);
  if (!de || !ate || !ISO.test(de) || !ISO.test(ate)) return "maximum";
  // Tolera o usuário inverter as pontas.
  return de <= ate ? { de, ate } : { de: ate, ate: de };
}

/** Rótulo legível do período ativo, para o cabeçalho. */
export function rotuloPeriodo(p: Periodo): string {
  if (p === "maximum") return "Todo o período";
  const br = (iso: string) => iso.split("-").reverse().join("/");
  return `${br(p.de)} – ${br(p.ate)}`;
}
