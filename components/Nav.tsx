"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { EscopoSlug } from "@/lib/config";

function Item({
  href,
  children,
  cor,
  desabilitado = false,
}: {
  href: string;
  children: React.ReactNode;
  cor: string;
  desabilitado?: boolean;
}) {
  const path = usePathname();
  const ativo = path === href;

  if (desabilitado) {
    return (
      <span className="flex cursor-not-allowed items-center rounded-lg py-[9px] pl-3 text-[13px] font-bold text-[var(--ink-muted)] opacity-40">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      style={ativo ? { color: cor } : undefined}
      className={`flex items-center rounded-lg py-[9px] pl-3 text-[13px] font-bold transition-colors ${
        ativo
          ? "nav-ativo bg-[var(--surface-2)]"
          : "text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      }`}
    >
      <span className={ativo ? "text-[var(--ink)]" : undefined}>{children}</span>
    </Link>
  );
}

function Seta({ aberto }: { aberto: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${aberto ? "" : "-rotate-90"}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
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
  estado,
  contemRotaAtiva,
  children,
}: {
  id: string;
  titulo: string;
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
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-2)]"
      >
        <Seta aberto={aberto} />
        <span className="rotulo flex-1">{titulo}</span>
        {estado && (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{estado}</span>
        )}
      </button>
      {aberto && <div className="flex flex-col gap-0.5">{children}</div>}
    </div>
  );
}

/**
 * Navegação do dashboard: por PLATAFORMA, nunca por praça.
 * A praça é o escopo, escolhido na capa — para trocar, volta-se para lá.
 */
export function NavPlataformas({ escopo, cor }: { escopo: EscopoSlug; cor: string }) {
  const base = `/${escopo}`;
  const path = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 py-4">
      {/* Consolidado dos canais — fica fora de Meta e Google de propósito. */}
      <div className="flex flex-col gap-0.5">
        <Item href={base} cor={cor}>
          Overview
        </Item>
      </div>

      <Grupo id="meta" titulo="Meta Ads" contemRotaAtiva={path.startsWith(`${base}/meta`)}>
        <Item href={`${base}/meta`} cor={cor}>
          Visão geral
        </Item>
        <Item href={`${base}/meta/resultados`} cor={cor}>
          Resultados
        </Item>
        <Item href={`${base}/meta/campanhas`} cor={cor}>
          Campanhas
        </Item>
        <Item href={`${base}/meta/criativos`} cor={cor}>
          Criativos
        </Item>
        <Item href={`${base}/meta/publico`} cor={cor}>
          Público
        </Item>
        <Item href={`${base}/meta/posicionamentos`} cor={cor}>
          Posicionamentos
        </Item>
      </Grupo>

      <Grupo
        id="google"
        titulo="Google Ads"
        estado="off"
        contemRotaAtiva={path.startsWith(`${base}/google`)}
      >
        <Item href={`${base}/google`} cor={cor}>
          Visão geral
        </Item>
        <Item href="#" cor={cor} desabilitado>
          Resultados
        </Item>
        <Item href="#" cor={cor} desabilitado>
          Campanhas
        </Item>
        <Item href="#" cor={cor} desabilitado>
          Criativos
        </Item>
        <Item href="#" cor={cor} desabilitado>
          Público
        </Item>
      </Grupo>
    </nav>
  );
}

/** Navegação do dashboard GA4 — fora do escopo de praça. */
export function NavAnalytics({ cor }: { cor: string }) {
  return (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 py-4">
      <div className="flex flex-col gap-0.5">
        <p className="rotulo px-2 pb-2">Google Analytics</p>
        <Item href="/analytics" cor={cor}>
          Visão geral
        </Item>
        <Item href="/analytics/aquisicao" cor={cor}>
          Aquisição
        </Item>
        <Item href="/analytics/vendas" cor={cor}>
          Vendas por evento
        </Item>
      </div>
    </nav>
  );
}
