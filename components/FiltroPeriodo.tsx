"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Filtro de período: data inicial e final.
 * O intervalo vive na URL (`?de=&ate=`), então é compartilhável e sobrevive ao
 * refresh. Sem intervalo, o dashboard usa todo o histórico.
 */
export function FiltroPeriodo() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const deUrl = sp.get("de") ?? "";
  const ateUrl = sp.get("ate") ?? "";
  const ativo = Boolean(deUrl && ateUrl);

  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(deUrl);
  const [ate, setAte] = useState(ateUrl);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDe(deUrl);
    setAte(ateUrl);
  }, [deUrl, ateUrl]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const aplicar = () => {
    if (!de || !ate) return;
    const q = new URLSearchParams(sp.toString());
    q.set("de", de);
    q.set("ate", ate);
    router.push(`${pathname}?${q.toString()}`);
    setAberto(false);
  };

  const limpar = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete("de");
    q.delete("ate");
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
    setAberto(false);
  };

  const br = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-[7px] text-[11.5px] font-bold uppercase tracking-[0.12em] transition-colors ${
          ativo
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
        <span className="hidden sm:inline">
          {ativo ? `${br(deUrl)} – ${br(ateUrl)}` : "Período"}
        </span>
      </button>

      {aberto && (
        <div className="painel absolute right-0 top-[calc(100%+8px)] z-50 w-[268px] p-3.5 shadow-2xl">
          <p className="rotulo pb-2.5">Intervalo</p>
          <div className="flex flex-col gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-[var(--ink-muted)]">De</span>
              <input
                type="date"
                value={de}
                max={ate || undefined}
                onChange={(e) => setDe(e.target.value)}
                className="rounded-lg border border-[var(--border-forte)] bg-[var(--surface-2)] px-2.5 py-2 text-[13.5px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-[var(--ink-muted)]">Até</span>
              <input
                type="date"
                value={ate}
                min={de || undefined}
                onChange={(e) => setAte(e.target.value)}
                className="rounded-lg border border-[var(--border-forte)] bg-[var(--surface-2)] px-2.5 py-2 text-[13.5px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
              />
            </label>
          </div>

          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={aplicar}
              disabled={!de || !ate}
              className="flex-1 rounded-lg bg-[var(--ink)] px-3 py-2 text-[11.5px] font-bold uppercase tracking-[0.12em] text-black transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={limpar}
              className="rounded-lg border border-[var(--border-forte)] px-3 py-2 text-[11.5px] font-bold uppercase tracking-[0.12em] text-[var(--ink-2)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              Tudo
            </button>
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
            Sem intervalo, o painel mostra todo o histórico das campanhas ativas.
          </p>
        </div>
      )}
    </div>
  );
}
