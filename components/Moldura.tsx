"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { IconChartBar, IconMapPin } from "@tabler/icons-react";
import { Marca } from "./Marca";
import { NavPlataformas } from "./Nav";
import { BotaoAtualizar } from "./BotaoAtualizar";
import { FiltroPeriodo } from "./FiltroPeriodo";
import { nomeDoEscopo, type EscopoSlug } from "@/lib/config";

/**
 * Moldura do dashboard.
 * Desktop: sidebar e cabeçalho como painéis flutuantes; conteúdo em altura
 * total. Mobile: sidebar vira gaveta e a página rola normalmente.
 */
export function Moldura({
  escopo,
  uf,
  titulo,
  sub,
  acoes,
  geradoEm,
  navegacao,
  contexto,
  canaisGoogle,
  children,
}: {
  /** Ausente em páginas fora do escopo de praça, como o GA4. */
  escopo?: EscopoSlug;
  uf: string;
  titulo: string;
  sub?: ReactNode;
  acoes?: ReactNode;
  geradoEm: string;
  /** Substitui a navegação por plataforma. */
  navegacao?: ReactNode;
  /** Substitui o seletor de praça no topo da lateral. */
  contexto?: ReactNode;
  /** Canais do Google com campanha ativa — define o que a lateral mostra. */
  canaisGoogle?: string[];
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [colapsada, setColapsada] = useState(false);
  const path = usePathname();

  // Fecha a gaveta ao navegar.
  useEffect(() => setAberto(false), [path]);

  // Preferência de sidebar colapsada sobrevive ao reload.
  useEffect(() => {
    setColapsada(localStorage.getItem("afropunk:sidebar") === "colapsada");
  }, []);
  const alternarColapso = () => {
    setColapsada((v) => {
      localStorage.setItem("afropunk:sidebar", v ? "aberta" : "colapsada");
      return !v;
    });
  };

  return (
    <div className="flex min-h-screen w-full gap-4 bg-[var(--bg)] p-3 lg:h-screen lg:min-h-[640px] lg:overflow-hidden lg:p-4">
      {/* Fundo escuro por trás da gaveta */}
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setAberto(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`painel fixed inset-y-3 left-3 z-50 flex w-[248px] flex-col overflow-hidden transition-transform duration-200 lg:static lg:inset-auto lg:w-[236px] lg:translate-x-0 ${
          aberto ? "translate-x-0" : "-translate-x-[115%] lg:translate-x-0"
        } ${colapsada ? "lg:hidden" : ""}`}
      >
        <div className="relative flex h-[66px] shrink-0 items-center justify-center border-b border-[var(--border)] px-3">
          <Marca tamanho="sm" href="/" />
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="absolute right-3 text-[20px] leading-none text-[var(--ink-muted)] lg:hidden"
            aria-label="Fechar menu"
          >
            ×
          </button>
          <button
            type="button"
            onClick={alternarColapso}
            aria-label="Recolher menu"
            title="Recolher menu"
            className="absolute right-3 hidden text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] lg:block"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
        </div>

        <div className="shrink-0 border-b border-[var(--border)] px-3 py-3.5">
          {contexto ?? (
            <>
              <p className="rotulo px-1 pb-2">Praça</p>
              <Link
                href="/"
                className="group flex items-center gap-2 rounded-lg border border-[var(--border-forte)] bg-[var(--surface-2)] px-2.5 py-2.5 transition-colors hover:bg-[var(--surface-3)]"
              >
                <IconMapPin
                  size={15}
                  stroke={1.9}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--ink-muted)]"
                />
                {/* `leading-[1.2]`: `truncate` recorta o que passar da caixa da
                    linha, e em caixa alta o til do Ã e a cedilha do Ç saem dela
                    com entrelinha fechada — "PRAÇAS" perdia a cedilha. */}
                <span className="marca min-w-0 flex-1 truncate text-[14px] leading-[1.2] text-[var(--ink)]">
                  {escopo ? nomeDoEscopo(escopo) : ""}
                </span>
                <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)] transition-colors group-hover:text-[var(--ink)]">
                  trocar
                </span>
              </Link>
            </>
          )}
        </div>

        {navegacao ??
          (escopo ? (
            <NavPlataformas escopo={escopo} canaisGoogle={canaisGoogle ?? []} />
          ) : null)}

        {/* Assinatura: as duas marcas, com o mesmo filete que separa no rodapé
            da capa. Recortadas na caixa dos glifos, então batem em altura. */}
        <div className="flex shrink-0 items-center justify-center gap-2.5 border-t border-[var(--border)] px-4 py-3.5">
          <Image
            src="/capco.png"
            alt="CAP.CO"
            width={1752}
            height={536}
            className="h-[14px] w-auto opacity-85"
          />
          <span aria-hidden="true" className="h-3 w-px bg-[var(--border-forte)]" />
          <Image
            src="/graalhub-reverso.png"
            alt="GRAAL.hub"
            width={900}
            height={127}
            className="h-[14px] w-auto opacity-85"
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-4">
        <header className="painel flex min-h-[62px] shrink-0 flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 lg:h-[62px] lg:flex-nowrap lg:px-5 lg:py-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => (colapsada ? alternarColapso() : setAberto(true))}
              aria-label="Abrir menu"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-forte)] text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] ${
                colapsada ? "" : "lg:hidden"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <IconChartBar
              size={18}
              stroke={1.9}
              aria-hidden="true"
              className="hidden shrink-0 text-[var(--ink-muted)] lg:block"
            />
            <div className="min-w-0">
              {/* Mesma razão da praça na lateral: com `leading-none`, "SEGMENTAÇÃO"
                  e "VISÃO GERAL" perdiam o til dentro do `truncate`. */}
              <h1 className="marca truncate text-[18px] leading-[1.2] lg:text-[21px]">{titulo}</h1>
              {sub && (
                <div className="mt-1.5 truncate text-[10.5px] uppercase tracking-[0.1em] leading-none text-[var(--ink-muted)] lg:text-[11px]">
                  {sub}
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:gap-3">
            <span className="hidden lg:block">{acoes}</span>
            {/* useSearchParams exige fronteira de Suspense em página estática */}
            <Suspense
              fallback={
                <span className="h-[30px] w-[92px] rounded-lg border border-[var(--border-forte)]" />
              }
            >
              <FiltroPeriodo />
            </Suspense>
            <BotaoAtualizar geradoEm={geradoEm} />
          </div>
        </header>

        <main className="relative min-h-0 flex-1">
          <span aria-hidden="true" className="marca-dagua hidden text-[15rem] lg:block">
            {uf}
          </span>
          <div className="relative z-[1] lg:h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
