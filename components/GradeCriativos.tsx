"use client";

import { useMemo, useState } from "react";
import type { Criativo } from "@/lib/meta";
import { CartaoCriativo } from "./Criativos";
import { METRICAS, METRICA_POR_CHAVE, type ChaveMetrica } from "./metricasCriativo";

export function GradeCriativos({ criativos }: { criativos: Criativo[] }) {
  const [ordem, setOrdem] = useState<ChaveMetrica>("investimento");

  const ordenados = useMemo(
    () => [...criativos].sort(METRICA_POR_CHAVE[ordem].comparar),
    [criativos, ordem],
  );

  return (
    <div className="flex flex-col gap-3">
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
              className={`rounded-md border px-2 py-[5px] text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
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

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {ordenados.map((c, i) => (
          <CartaoCriativo key={c.adId} c={c} posicao={i + 1} metricaDestaque={ordem} />
        ))}
      </div>
    </div>
  );
}
