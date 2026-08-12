"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { IconArrowsLeftRight, IconChartBar, IconMapPin } from "@tabler/icons-react";
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
  googleIndisponivel,
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
  /** A leitura do Google falhou: mostrar o grupo com aviso, não escondê-lo. */
  googleIndisponivel?: boolean;
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
        <div className="relative flex h-[60px] shrink-0 items-center justify-center border-b border-[var(--border)] px-3">
          <Marca tamanho="sm" href="/" />
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="absolute right-3 text-[var(--fs-kpi)] leading-none text-[var(--ink-muted)] lg:hidden"
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
                title="Trocar de praça"
                aria-label="Trocar de praça"
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
                <span className="marca min-w-0 flex-1 truncate text-[var(--fs-corpo-2)] leading-[1.2] text-[var(--ink)]">
                  {escopo ? nomeDoEscopo(escopo) : ""}
                </span>
                {/* Ícone no lugar da palavra "trocar": ela ocupava ~50px dos
                    236px da lateral, e o nome da praça — que é a informação —
                    ficava com 79px para 118px de texto. O rótulo continua no
                    `title` e no `aria-label` do link. */}
                <IconArrowsLeftRight
                  size={14}
                  stroke={1.9}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--ink-muted)] transition-colors group-hover:text-[var(--ink)]"
                />
              </Link>
            </>
          )}
        </div>

        {navegacao ??
          (escopo ? (
            <NavPlataformas
              escopo={escopo}
              canaisGoogle={canaisGoogle ?? []}
              googleIndisponivel={googleIndisponivel ?? false}
            />
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

      {/* `relative` aqui e não no <main>: a marca d'água sangra para fora da
          caixa de propósito, e dentro de um container rolável essa sangria
          conta como conteúdo — era o que criava barra horizontal e vertical
          numa página que cabia inteira. Fora do scroller, o
          `overflow-hidden` do shell apara e nada rola. */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-3 lg:gap-4">
        {/* Camada de recorte própria: a marca d'água sangra para fora da caixa
            de propósito e, sendo absoluta, essa sangria entra na altura do
            conteúdo do pai — 105px fantasma em toda página. Confinada aqui,
            ela continua sangrando visualmente sem inflar nada. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
        >
          <span className="marca-dagua text-[15rem]">{uf}</span>
        </span>
        <header className="painel flex min-h-[56px] shrink-0 flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 lg:h-[56px] lg:flex-nowrap lg:px-5 lg:py-0">
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
              <h1 className="marca truncate text-[var(--fs-md)] leading-[1.2] lg:text-[var(--fs-kpi)]">{titulo}</h1>
              {sub && (
                <div className="mt-1.5 truncate text-[var(--fs-micro)] uppercase tracking-[0.08em] leading-none text-[var(--ink-muted)]">
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

        {/* `overflow-y-auto`, não `hidden`: quando o conteúdo não cabe — e em
            1280×720 ele não cabe — cortar em silêncio some com metade do
            cartão sem avisar ninguém. Rolar é a única falha honesta, e é o que
            o design system da casa faz na área de conteúdo. */}
        {/* `overflow-x-hidden`: nada deve rolar na horizontal, nunca. O eixo
            vertical rola só como rede de segurança — se tudo couber, e é o
            caso hoje, nenhuma barra aparece. */}
        <main className="relative z-[1] min-h-0 flex-1 lg:overflow-y-auto lg:overflow-x-hidden">
          <div className="lg:h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
