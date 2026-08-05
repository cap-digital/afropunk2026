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

// ------------------------------------------------------------ pré-definidos

/**
 * "Hoje" no fuso da conta de anúncios, não no do navegador. Quem abre o
 * dashboard de outro fuso veria um dia a mais ou a menos no recorte.
 */
const FORMATO_ISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const hojeNaConta = (): string => FORMATO_ISO.format(new Date());

/** Soma (ou subtrai) dias a uma data ISO, ao meio-dia UTC para escapar do horário de verão. */
export function somaDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export interface Predefinido {
  chave: string;
  rotulo: string;
  /** null = sem intervalo, ou seja, todo o histórico. */
  intervalo: () => { de: string; ate: string } | null;
}

export const PREDEFINIDOS: Predefinido[] = [
  {
    chave: "ontem",
    rotulo: "Ontem",
    // Um dia só: de e até na mesma data.
    intervalo: () => {
      const ontem = somaDias(hojeNaConta(), -1);
      return { de: ontem, ate: ontem };
    },
  },
  {
    chave: "7d",
    rotulo: "7 dias",
    intervalo: () => {
      const hoje = hojeNaConta();
      return { de: somaDias(hoje, -6), ate: hoje };
    },
  },
  {
    chave: "15d",
    rotulo: "15 dias",
    intervalo: () => {
      const hoje = hojeNaConta();
      return { de: somaDias(hoje, -14), ate: hoje };
    },
  },
  {
    chave: "30d",
    rotulo: "30 dias",
    intervalo: () => {
      const hoje = hojeNaConta();
      return { de: somaDias(hoje, -29), ate: hoje };
    },
  },
  {
    chave: "mes-passado",
    rotulo: "Mês passado",
    // Mês-calendário fechado — diferente de "30 dias", que é janela móvel.
    intervalo: () => {
      const [ano, mes] = hojeNaConta().split("-").map(Number);
      const anoAnt = mes === 1 ? ano - 1 : ano;
      const mesAnt = mes === 1 ? 12 : mes - 1;
      const ultimoDia = new Date(Date.UTC(anoAnt, mesAnt, 0)).getUTCDate();
      const mm = String(mesAnt).padStart(2, "0");
      return { de: `${anoAnt}-${mm}-01`, ate: `${anoAnt}-${mm}-${ultimoDia}` };
    },
  },
  {
    chave: "tudo",
    rotulo: "Todo o período",
    intervalo: () => null,
  },
];

/** Qual pré-definido corresponde ao intervalo atual, se algum. */
export function predefinidoAtivo(de: string, ate: string): string | null {
  if (!de || !ate) return "tudo";
  for (const p of PREDEFINIDOS) {
    const i = p.intervalo();
    if (i && i.de === de && i.ate === ate) return p.chave;
  }
  return null;
}
