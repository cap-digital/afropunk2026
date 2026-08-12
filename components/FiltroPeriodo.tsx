"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PREDEFINIDOS, predefinidoAtivo } from "@/lib/periodo";

/**
 * Filtro de período: atalhos pré-definidos + intervalo livre.
 * O recorte vive na URL (`?de=&ate=`), então é compartilhável e sobrevive ao
 * refresh. Sem intervalo, o dashboard usa todo o histórico.
 */
export function FiltroPeriodo() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const deUrl = sp.get("de") ?? "";
  const ateUrl = sp.get("ate") ?? "";
  const temIntervalo = Boolean(deUrl && ateUrl);

  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(deUrl);
  const [ate, setAte] = useState(ateUrl);
  const [ativo, setAtivo] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDe(deUrl);
    setAte(ateUrl);
    // Só no cliente: os pré-definidos dependem da data de hoje, e calcular
    // isso no servidor faria o HTML divergir do que o navegador renderiza.
    setAtivo(predefinidoAtivo(deUrl, ateUrl));
  }, [deUrl, ateUrl]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const navegar = (novoDe?: string, novoAte?: string) => {
    const q = new URLSearchParams(sp.toString());
    if (novoDe && novoAte) {
      q.set("de", novoDe);
      q.set("ate", novoAte);
    } else {
      q.delete("de");
      q.delete("ate");
    }
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
    // `push` sozinho pode ser atendido pelo Router Cache do cliente e a página
    // fica com os números do período anterior; o refresh força o servidor a
    // renderizar de novo com os novos searchParams.
    router.refresh();
    setAberto(false);
  };

  const br = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
  const rotuloBotao = ativo
    ? PREDEFINIDOS.find((p) => p.chave === ativo)?.rotulo
    : temIntervalo
      ? `${br(deUrl)} – ${br(ateUrl)}`
      : "Período";

  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-[7px] text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.12em] transition-colors ${
          temIntervalo
            ? "border-[var(--ink)] text-[var(--ink)]"
            : "border-[var(--border-forte)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
        }`}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span className="hidden sm:inline">{rotuloBotao}</span>
      </button>

      {aberto && (
        <div className="painel absolute right-0 top-[calc(100%+8px)] z-50 w-[17.25rem] p-3.5 shadow-2xl">
          <p className="rotulo pb-2.5">Atalhos</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PREDEFINIDOS.map((p) => {
              const selecionado = ativo === p.chave;
              return (
                <button
                  key={p.chave}
                  type="button"
                  onClick={() => {
                    const i = p.intervalo();
                    navegar(i?.de, i?.ate);
                  }}
                  aria-pressed={selecionado}
                  className={`rounded-md border px-2 py-[7px] text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.08em] transition-colors ${
                    p.chave === "tudo" || p.chave === "mes-passado" ? "col-span-2" : ""
                  } ${
                    selecionado
                      ? "border-[var(--ink)] bg-[var(--ink)] text-black"
                      : "border-[var(--border-forte)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                  }`}
                >
                  {p.rotulo}
                </button>
              );
            })}
          </div>

          <div className="my-3 h-px w-full bg-[var(--border)]" />

          <p className="rotulo pb-2.5">Intervalo livre</p>
          <div className="flex flex-col gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[var(--fs-corpo)] text-[var(--ink-muted)]">De</span>
              <input
                type="date"
                value={de}
                max={ate || undefined}
                onChange={(e) => setDe(e.target.value)}
                className="rounded-lg border border-[var(--border-forte)] bg-[var(--surface-2)] px-2.5 py-2 text-[var(--fs-corpo-2)] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[var(--fs-corpo)] text-[var(--ink-muted)]">Até</span>
              <input
                type="date"
                value={ate}
                min={de || undefined}
                onChange={(e) => setAte(e.target.value)}
                className="rounded-lg border border-[var(--border-forte)] bg-[var(--surface-2)] px-2.5 py-2 text-[var(--fs-corpo-2)] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => navegar(de, ate)}
            disabled={!de || !ate}
            className="mt-3 w-full rounded-lg bg-[var(--ink)] px-3 py-2 text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.12em] text-black transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            Aplicar intervalo
          </button>

          <p className="mt-2.5 text-[var(--fs-corpo)] leading-relaxed text-[var(--ink-muted)]">
            As campanhas ativas começaram em 31/07 — recortes anteriores a isso
            voltam vazios.
          </p>
        </div>
      )}
    </div>
  );
}
