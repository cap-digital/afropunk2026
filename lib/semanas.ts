import { diaMesCurto } from "./format";
import type { PontoGrafico } from "@/components/charts";

/**
 * Agregação semanal das séries diárias.
 *
 * Semana calendário, de segunda a domingo. A série diária vem da API já
 * unificada entre canais e pode começar ou terminar no meio da semana — o
 * Google entrou depois do Meta, e o dia corrente é parcial. Por isso a semana
 * não presume sete dias: soma o que existe e o rótulo diz exatamente quais
 * dias entraram ("20–23 ago"), para que uma semana pela metade não se passe
 * por semana inteira.
 *
 * JS puro, sem biblioteca de data: a aritmética é em UTC sobre "AAAA-MM-DD",
 * então não há fuso para deslocar o dia.
 */

/** Segunda-feira da semana do dia `iso`, em ISO. */
export function inicioDaSemana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  // getUTCDay: 0 = domingo. Segunda é o dia zero da semana.
  const desloc = (data.getUTCDay() + 6) % 7;
  data.setUTCDate(data.getUTCDate() - desloc);
  return data.toISOString().slice(0, 10);
}

/** "2026-08-03"…"2026-08-09" → "03–09 ago"; meses diferentes → "29 jul – 04 ago". */
export function rotuloSemana(de: string, ate: string): string {
  if (de === ate) return diaMesCurto(de);
  const [, mDe, dDe] = de.split("-");
  const [, mAte] = ate.split("-");
  return mDe === mAte ? `${dDe}–${diaMesCurto(ate)}` : `${diaMesCurto(de)} – ${diaMesCurto(ate)}`;
}

export interface SerieSemanal {
  /** Um ponto por semana; `date` é a segunda-feira, que ordena e identifica. */
  pontos: PontoGrafico[];
  /** Rótulo por `date`, com os dias que de fato entraram na soma. */
  rotulos: Map<string, string>;
}

interface Semana {
  de: string;
  ate: string;
  soma: Record<string, number>;
}

/** Soma cada chave de `chaves` por semana calendário. Chaves não numéricas são ignoradas. */
export function agregarPorSemana(dados: PontoGrafico[], chaves: string[]): SerieSemanal {
  const semanas = new Map<string, Semana>();
  for (const p of dados) {
    const dia = typeof p.date === "string" ? p.date : "";
    if (!dia) continue;
    const inicio = inicioDaSemana(dia);
    let s = semanas.get(inicio);
    if (!s) {
      s = { de: dia, ate: dia, soma: Object.fromEntries(chaves.map((c) => [c, 0])) };
      semanas.set(inicio, s);
    }
    if (dia < s.de) s.de = dia;
    if (dia > s.ate) s.ate = dia;
    for (const c of chaves) {
      const v = Number(p[c]);
      if (Number.isFinite(v)) s.soma[c] += v;
    }
  }
  const ordenadas = [...semanas.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    pontos: ordenadas.map(([inicio, s]) => ({ date: inicio, ...s.soma })),
    rotulos: new Map(ordenadas.map(([inicio, s]) => [inicio, rotuloSemana(s.de, s.ate)])),
  };
}
