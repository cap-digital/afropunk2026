"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { atualizarDados } from "@/app/actions";

/**
 * Força uma releitura da Marketing API.
 * As páginas são ISR (revalidate 300s); este botão invalida o cache e
 * recarrega, para quando o usuário quer o número de agora.
 */
export function BotaoAtualizar({ geradoEm }: { geradoEm: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [girando, setGirando] = useState(false);

  const atualizar = () => {
    setGirando(true);
    iniciar(async () => {
      await atualizarDados();
      router.refresh();
      // O refresh do servidor não tem callback; soltamos o estado no próximo tick.
      setTimeout(() => setGirando(false), 600);
    });
  };

  const ocupado = pendente || girando;

  return (
    <div className="flex items-center gap-2">
      {/*
        Carimbo de horário é rodapé, não botão: em `--fs-micro` sem caixa alta
        forçada ele informa sem disputar com o nome da página. Em caixa alta e
        no mesmo corpo dos botões, três blocos de cromo brigavam entre si na
        faixa e o título perdia para todos.
      */}
      <span className="hidden text-[var(--fs-micro)] uppercase tracking-[0.08em] text-[var(--ink-muted)] xl:inline">
        Dados de {geradoEm}
      </span>
      <button
        type="button"
        onClick={atualizar}
        disabled={ocupado}
        aria-label="Atualizar dados"
        className="group flex items-center gap-1.5 rounded-lg border border-[var(--border-forte)] px-2 py-[0.28rem] text-[var(--fs-micro)] font-semibold uppercase tracking-[0.06em] text-[var(--ink-2)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-50"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={ocupado ? "animate-spin" : "transition-transform group-hover:rotate-90"}
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        {ocupado ? "Atualizando" : "Atualizar"}
      </button>
    </div>
  );
}
