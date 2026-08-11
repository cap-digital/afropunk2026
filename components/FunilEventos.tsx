"use client";

import { useState } from "react";
import { FunilTrapezio } from "./charts";
import { brl, dec, int, pct } from "@/lib/format";

export interface EventoFunil {
  itemName: string;
  nome: string;
  cor: string;
  adicoesCarrinho: number;
  checkouts: number;
  ingressos: number;
  receita: number;
}

/**
 * Funil de venda por evento, com escolha da praça.
 *
 * Começa no carrinho: `itemsViewed` não é rastreado nesta propriedade do GA4,
 * então não há etapa de visualização do item.
 */
export function FunilEventos({ eventos }: { eventos: EventoFunil[] }) {
  const [ativo, setAtivo] = useState(0);
  const e = eventos[ativo];

  if (!e) {
    return (
      <p className="pt-8 text-center text-[12px] text-[var(--ink-muted)]">
        Nenhum evento com venda registrada neste recorte.
      </p>
    );
  }

  // Etapa zerada fica fora — linha vazia não informa nada.
  const etapas = [
    { nome: "Adicionados ao carrinho", valor: e.adicoesCarrinho },
    { nome: "Checkout iniciado", valor: e.checkouts },
    { nome: "Comprados", valor: e.ingressos },
  ].filter((x) => x.valor > 0);

  const conversao = e.adicoesCarrinho > 0 ? (e.ingressos / e.adicoesCarrinho) * 100 : 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {eventos.map((x, i) => {
          const selecionado = i === ativo;
          return (
            <button
              key={x.itemName}
              type="button"
              onClick={() => setAtivo(i)}
              aria-pressed={selecionado}
              className="flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors"
              style={
                selecionado
                  ? { borderColor: x.cor, background: x.cor, color: "#0b0b0b" }
                  : { borderColor: "var(--border-forte)", color: "var(--ink-2)" }
              }
            >
              {!selecionado && (
                <span
                  aria-hidden="true"
                  className="block h-2 w-2 rotate-45"
                  style={{ background: x.cor }}
                />
              )}
              {x.nome}
            </button>
          );
        })}
      </div>

      {/* `mt-3` sobre o gap da coluna: dobra a folga entre os botões de praça
          e o topo do funil, sem afetar o espaço até a legenda. */}
      <div className="mt-3 shrink-0">
        <FunilTrapezio etapas={etapas} cor={e.cor} />
      </div>

      {/* Legenda embaixo: nomeia as etapas e completa o espaço que a forma
          compacta deixou livre. `justify-center` com gap fixo em vez de
          `justify-evenly`: distribuir na altura toda afastava demais as linhas. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
        {etapas.map((x, i) => {
          const anterior = i > 0 ? etapas[i - 1].valor : null;
          const taxa = anterior && anterior > 0 ? (x.valor / anterior) * 100 : null;
          const doTopo = etapas[0].valor > 0 ? (x.valor / etapas[0].valor) * 100 : 0;
          return (
            <div key={x.nome} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="block h-2.5 w-2.5 shrink-0 rotate-45"
                style={{ background: e.cor, opacity: 1 - i * 0.16 }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ink-2)]">
                {x.nome}
              </span>
              <span className="tabular shrink-0 text-[13px] font-bold text-[var(--ink)]">
                {int(x.valor)}
              </span>
              <span className="tabular w-[62px] shrink-0 text-right text-[12px] text-[var(--ink-muted)]">
                {taxa !== null ? `${dec(taxa)}%` : `${dec(doTopo)}%`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] pt-2.5">
        <span className="text-[11.5px] text-[var(--ink-muted)]">
          Do carrinho à compra:{" "}
          <span className="tabular font-bold" style={{ color: e.cor }}>
            {pct(conversao, 1)}
          </span>
        </span>
        <span className="tabular text-[11.5px] text-[var(--ink-muted)]">
          {int(e.ingressos)} ingressos ·{" "}
          <span className="font-bold text-[var(--ink)]">{brl(e.receita)}</span>
        </span>
      </div>
    </div>
  );
}
