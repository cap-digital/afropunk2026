"use client";

import { useEffect, useMemo, useState } from "react";
import type { Criativo } from "@/lib/meta";
import { CartaoCriativo } from "./Criativos";
import { METRICAS, METRICA_POR_CHAVE, type ChaveMetrica } from "./metricasCriativo";

/** Múltiplo de 6 (colunas no desktop) para as páginas fecharem em linhas cheias. */
const POR_PAGINA = 12;

export function GradeCriativos({ criativos }: { criativos: Criativo[] }) {
  const [ordem, setOrdem] = useState<ChaveMetrica>("investimento");
  const [pagina, setPagina] = useState(1);

  const ordenados = useMemo(
    () => [...criativos].sort(METRICA_POR_CHAVE[ordem].comparar),
    [criativos, ordem],
  );

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));

  // Trocar a ordenação volta para a primeira página: continuar na página 4 de
  // uma lista reordenada mostraria itens sem relação com o que se pediu.
  useEffect(() => setPagina(1), [ordem]);

  const inicio = (pagina - 1) * POR_PAGINA;
  const daPagina = ordenados.slice(inicio, inicio + POR_PAGINA);

  return (
    <div className="flex h-full flex-col gap-3">
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
              className={`rounded-md border px-2 py-[5px] text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.1em] transition-colors ${
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

      <div className="max-h-[var(--h-tabela)] overflow-auto pr-1">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {daPagina.map((c, i) => (
            <CartaoCriativo
              key={c.adId}
              c={c}
              posicao={inicio + i + 1}
              metricaDestaque={ordem}
            />
          ))}
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] pt-2.5">
          <span className="text-[var(--fs-corpo)] text-[var(--ink-muted)]">
            <span className="tabular font-bold text-[var(--ink-2)]">
              {inicio + 1}–{Math.min(inicio + POR_PAGINA, ordenados.length)}
            </span>{" "}
            de <span className="tabular font-bold text-[var(--ink-2)]">{ordenados.length}</span>{" "}
            criativos
          </span>

          <div className="flex items-center gap-1.5">
            <BotaoPagina
              rotulo="Anterior"
              desabilitado={pagina === 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              ‹
            </BotaoPagina>

            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPagina(n)}
                aria-current={n === pagina ? "page" : undefined}
                className={`h-7 min-w-[1.75rem] rounded-md border px-1.5 text-[var(--fs-corpo)] font-semibold tabular transition-colors ${
                  n === pagina
                    ? "border-[var(--ink)] bg-[var(--ink)] text-black"
                    : "border-[var(--border-forte)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                }`}
              >
                {n}
              </button>
            ))}

            <BotaoPagina
              rotulo="Próxima"
              desabilitado={pagina === totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            >
              ›
            </BotaoPagina>
          </div>
        </div>
      )}
    </div>
  );
}

function BotaoPagina({
  children,
  rotulo,
  desabilitado,
  onClick,
}: {
  children: React.ReactNode;
  rotulo: string;
  desabilitado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-label={rotulo}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-forte)] text-[var(--fs-md)] font-bold leading-none text-[var(--ink-2)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-30 disabled:hover:border-[var(--border-forte)] disabled:hover:text-[var(--ink-2)]"
    >
      {children}
    </button>
  );
}
