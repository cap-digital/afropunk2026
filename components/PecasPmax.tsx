/* eslint-disable @next/next/no-img-element -- ver nota na miniatura */
"use client";

import { useMemo, useState } from "react";
import { brlCurto, compact, conv, pct } from "@/lib/format";
// `import type` é apagado na compilação — é o que mantém o módulo
// `server-only` de adsDetalhe fora do pacote do cliente.
import type { AtivoPmax } from "@/lib/adsDetalhe";
import { CAMPO_ATIVO_LABEL } from "@/lib/config";

/**
 * Galeria de peças do Performance Max.
 *
 * Mesmo controle da grade de criativos do Meta — botões de ordenação e a
 * métrica escolhida em destaque no card — porque é a mesma pergunta em canais
 * diferentes, e trocar de aba não deveria trocar a gramática da tela.
 */

type ChavePeca = "receita" | "conversoes" | "impressoes" | "ctr";

interface MetricaPeca {
  chave: ChavePeca;
  rotulo: string;
  /** Rótulo curto, para caber ao lado dos outros números do card. */
  curto: string;
  valor: (a: AtivoPmax) => string;
  comparar: (a: AtivoPmax, b: AtivoPmax) => number;
}

const METRICAS: MetricaPeca[] = [
  {
    chave: "receita",
    rotulo: "Maior receita",
    curto: "Receita",
    valor: (a) => (a.m.receita > 0 ? brlCurto(a.m.receita) : "—"),
    // Empate cai em conversão e depois em entrega: peça sem impressão não sobe
    // à frente de peça testada só por ambas estarem zeradas.
    comparar: (a, b) =>
      b.m.receita - a.m.receita ||
      b.m.conversoes - a.m.conversoes ||
      b.m.impressoes - a.m.impressoes,
  },
  {
    chave: "conversoes",
    rotulo: "Mais conversões",
    curto: "Conv.",
    valor: (a) => (a.m.conversoes > 0 ? conv(a.m.conversoes) : "—"),
    comparar: (a, b) => b.m.conversoes - a.m.conversoes || b.m.receita - a.m.receita,
  },
  {
    chave: "impressoes",
    rotulo: "Mais entrega",
    curto: "Impr.",
    valor: (a) => (a.m.impressoes > 0 ? compact(a.m.impressoes) : "—"),
    comparar: (a, b) => b.m.impressoes - a.m.impressoes,
  },
  {
    chave: "ctr",
    rotulo: "Melhor CTR",
    curto: "CTR",
    valor: (a) => (a.m.impressoes > 0 ? pct(a.m.ctr, 1) : "—"),
    // Sem entrega, CTR não é comparável: 100% de 1 impressão não é resultado.
    comparar: (a, b) => b.m.ctr - a.m.ctr || b.m.impressoes - a.m.impressoes,
  },
];

const POR_CHAVE = Object.fromEntries(METRICAS.map((m) => [m.chave, m])) as Record<
  ChavePeca,
  MetricaPeca
>;

export function PecasPmax({ pecas }: { pecas: AtivoPmax[] }) {
  const [ordem, setOrdem] = useState<ChavePeca>("receita");

  const ordenadas = useMemo(
    () => [...pecas].sort(POR_CHAVE[ordem].comparar),
    [pecas, ordem],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rotulo mr-1">Ordenar por</span>
        {METRICAS.map((m) => {
          const ativo = m.chave === ordem;
          return (
            <button
              key={m.chave}
              type="button"
              onClick={() => setOrdem(m.chave)}
              aria-pressed={ativo}
              className={`rounded-md border px-2 py-[5px] text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.08em] transition-colors ${
                ativo
                  ? "border-[var(--ink)] bg-[var(--ink)] text-black"
                  : "border-[var(--border-forte)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
              }`}
            >
              {m.rotulo}
            </button>
          );
        })}
      </div>

      <div className="max-h-[var(--h-galeria)] overflow-auto pr-1">
        <div className="grid auto-rows-min grid-cols-2 gap-2.5 sm:grid-cols-3">
          {ordenadas.map((a, i) => (
            <CartaoPeca key={`${a.id}-${a.campo}`} a={a} posicao={i + 1} destaque={ordem} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Card da peça: preview, posição no ranking e a métrica escolhida em destaque. */
function CartaoPeca({
  a,
  posicao,
  destaque,
}: {
  a: AtivoPmax;
  posicao: number;
  destaque: ChavePeca;
}) {
  const principal = POR_CHAVE[destaque];
  /*
   * Duas secundárias, não três: no card de ~140px os três rótulos truncavam e
   * viravam "CONV… IMPR… CTR…". A que fica de fora vira o número grande assim
   * que a pessoa ordena por ela.
   */
  const secundarias = METRICAS.filter((m) => m.chave !== destaque).slice(0, 2);

  return (
    <figure className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
      <div className="relative aspect-square w-full overflow-hidden bg-black">
        {/* <img> e não next/image: as URLs do googlesyndication são assinadas
            e não passam pelo otimizador — mesmo motivo da galeria do Meta. */}
        <img
          src={a.imagemUrl ?? ""}
          alt={CAMPO_ATIVO_LABEL[a.campo] ?? a.campo}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span className="tabular absolute bottom-1.5 right-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-black/80 px-1 text-[var(--fs-rotulo)] font-semibold text-[var(--ink)]">
          {posicao}
        </span>
      </div>

      <figcaption className="flex flex-col gap-1.5 px-2.5 pb-2.5 pt-2">
        <span className="truncate text-[var(--fs-micro)] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          {CAMPO_ATIVO_LABEL[a.campo] ?? a.campo}
        </span>

        <div className="flex items-baseline justify-between gap-1.5">
          <span className="tabular truncate text-[var(--fs-md)] font-bold leading-none text-[var(--ink)]">
            {principal.valor(a)}
          </span>
          <span className="shrink-0 text-[var(--fs-micro)] uppercase tracking-[0.06em] text-[var(--ink-muted)]">
            {principal.curto}
          </span>
        </div>

        {/* As outras três continuam visíveis: a ordenação muda o destaque, não
            o que se pode conferir sem trocar de ordenação. */}
        <div className="tabular flex items-baseline justify-between gap-2 text-[var(--fs-rotulo)] text-[var(--ink-muted)]">
          {secundarias.map((m) => (
            <span key={m.chave} className="whitespace-nowrap">
              <span className="text-[var(--fs-micro)] uppercase tracking-[0.06em]">{m.curto} </span>
              <span className="text-[var(--ink-2)]">{m.valor(a)}</span>
            </span>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
