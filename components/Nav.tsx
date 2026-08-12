"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconArrowsSplit,
  IconBrandGoogle,
  IconBrandMeta,
  IconChartAreaLine,
  IconChartPie,
  IconChevronDown,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMessageSearch,
  IconPhoto,
  IconSearch,
  IconShoppingCart,
  IconSparkles,
  IconSpeakerphone,
  IconTargetArrow,
  IconUsers,
  type TablerIcon,
} from "@tabler/icons-react";
import type { EscopoSlug } from "@/lib/config";

type Icone = TablerIcon;

/**
 * Item de navegação.
 *
 * O estado ativo é branco, não a cor da praça: pelo design system da casa o
 * cromo da interface é preto e branco, e cor de marca fica reservada ao
 * gráfico. A praça continua identificada pelo seletor no topo da lateral.
 */
function Item({
  href,
  children,
  icone: Ic,
}: {
  href: string;
  children: React.ReactNode;
  icone: Icone;
}) {
  const path = usePathname();
  const ativo = path === href;

  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-[0.42rem] text-[var(--fs-corpo)] font-medium leading-[1.3] transition-colors ${
        ativo
          ? "nav-ativo border border-[var(--ui-bdr)] bg-[var(--ui-bg)] text-[var(--ink)]"
          : "border border-transparent text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      }`}
    >
      <Ic size="0.875rem" stroke={1.8} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}

/**
 * Grupo de plataforma recolhível. Abre por padrão só quando a rota atual está
 * dentro dele — a lateral fica limpa, mas você sempre enxerga onde está. A
 * escolha manual sobrescreve isso e fica lembrada entre visitas.
 */
function Grupo({
  id,
  titulo,
  icone: Ic,
  estado,
  contemRotaAtiva,
  children,
}: {
  id: string;
  titulo: string;
  icone: Icone;
  /** Aviso curto ao lado do título — hoje só "indisponível". */
  estado?: string;
  contemRotaAtiva: boolean;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(contemRotaAtiva);

  useEffect(() => {
    const salvo = localStorage.getItem(`afropunk:grupo:${id}`);
    if (salvo !== null) setAberto(salvo === "1");
  }, [id]);

  // Navegar para uma rota do grupo abre o grupo, mesmo que estivesse recolhido.
  useEffect(() => {
    if (contemRotaAtiva) setAberto(true);
  }, [contemRotaAtiva]);

  const alternar = () => {
    setAberto((v) => {
      localStorage.setItem(`afropunk:grupo:${id}`, v ? "0" : "1");
      return !v;
    });
  };

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className="flex items-center gap-2 rounded-lg px-2.5 py-[0.42rem] text-left text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-2)]"
      >
        <Ic size="0.875rem" stroke={1.9} className="shrink-0" aria-hidden="true" />
        {/* Mesmo tamanho do item filho: "META ADS" aparecia MENOR que
            "Visão geral", que está um nível abaixo dela. A hierarquia agora vem
            da caixa alta, do tracking e da cor — não de encolher o pai. */}
        <span className="flex-1 text-[var(--fs-corpo)] font-semibold uppercase leading-[1.3] tracking-[0.08em] text-[var(--ink-muted)]">
          {titulo}
        </span>
        {estado && (
          <span
            className="shrink-0 text-[var(--fs-micro)] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--critical)" }}
          >
            {estado}
          </span>
        )}
        <IconChevronDown
          size="0.75rem"
          stroke={2.4}
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-200 ${aberto ? "" : "-rotate-90"}`}
        />
      </button>
      {aberto && <div className="flex flex-col gap-0.5 pl-1">{children}</div>}
    </div>
  );
}

/**
 * Navegação do dashboard: por PLATAFORMA, nunca por praça.
 * A praça é o escopo, escolhido na capa — para trocar, volta-se para lá.
 */
export function NavPlataformas({
  escopo,
  canaisGoogle,
  googleIndisponivel = false,
}: {
  escopo: EscopoSlug;
  /** Canais com campanha ativa; item sem dado não entra no menu. */
  canaisGoogle: string[];
  /** Leitura do Google falhou — mostra tudo, para a página exibir o motivo. */
  googleIndisponivel?: boolean;
}) {
  const base = `/${escopo}`;
  const path = usePathname();

  /*
   * Sem saber o que existe, mostra tudo: esconder itens por causa de uma falha
   * de leitura faria o dashboard mentir que a praça não roda o canal.
   */
  const temPesquisa = googleIndisponivel || canaisGoogle.includes("SEARCH");
  const temPmax = googleIndisponivel || canaisGoogle.includes("PERFORMANCE_MAX");
  const temGoogle = googleIndisponivel || canaisGoogle.length > 0;

  return (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-3.5">
      {/* Consolidado dos canais — fica fora de Meta e Google de propósito. */}
      <div className="flex flex-col gap-0.5">
        <Item href={base} icone={IconLayoutDashboard}>
          Overview
        </Item>
      </div>

      <Grupo
        id="meta"
        titulo="Meta Ads"
        icone={IconBrandMeta}
        contemRotaAtiva={path.startsWith(`${base}/meta`)}
      >
        <Item href={`${base}/meta`} icone={IconChartAreaLine}>
          Visão geral
        </Item>
        <Item href={`${base}/meta/resultados`} icone={IconTargetArrow}>
          Resultados
        </Item>
        <Item href={`${base}/meta/campanhas`} icone={IconSpeakerphone}>
          Campanhas
        </Item>
        <Item href={`${base}/meta/criativos`} icone={IconPhoto}>
          Criativos
        </Item>
        <Item href={`${base}/meta/publico`} icone={IconUsers}>
          Público
        </Item>
        <Item href={`${base}/meta/posicionamentos`} icone={IconLayoutGrid}>
          Posicionamentos
        </Item>
      </Grupo>

      {/* Recortes do Google, não os do Meta: aqui não há demografia (Pesquisa e
          PMax não expõem), e em troca há leilão, palavra-chave e termo buscado.
          O menu segue o que a praça tem no ar — Recife não roda Google e não
          ganha o grupo; Salvador não tem PMax e não ganha o item. */}
      {temGoogle && (
        <Grupo
          id="google"
          titulo="Google Ads"
          icone={IconBrandGoogle}
          estado={googleIndisponivel ? "indisponível" : undefined}
          contemRotaAtiva={path.startsWith(`${base}/google`)}
        >
          <Item href={`${base}/google`} icone={IconChartAreaLine}>
            Visão geral
          </Item>
          {temPesquisa && (
            <>
              <Item href={`${base}/google/pesquisa`} icone={IconSearch}>
                Pesquisa
              </Item>
              <Item href={`${base}/google/termos`} icone={IconMessageSearch}>
                Termos de busca
              </Item>
            </>
          )}
          {temPmax && (
            <Item href={`${base}/google/pmax`} icone={IconSparkles}>
              Performance Max
            </Item>
          )}
          <Item href={`${base}/google/segmentacao`} icone={IconLayoutGrid}>
            Segmentação
          </Item>
        </Grupo>
      )}
    </nav>
  );
}

/** Navegação do dashboard GA4 — fora do escopo de praça. */
export function NavAnalytics() {
  return (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-3.5">
      <div className="flex flex-col gap-0.5">
        <p className="px-2 pb-2 text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          Google Analytics
        </p>
        <Item href="/analytics" icone={IconChartPie}>
          Visão geral
        </Item>
        <Item href="/analytics/aquisicao" icone={IconArrowsSplit}>
          Aquisição
        </Item>
        <Item href="/analytics/vendas" icone={IconShoppingCart}>
          Vendas por evento
        </Item>
      </div>
    </nav>
  );
}
