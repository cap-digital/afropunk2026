import type { ReactNode } from "react";
import { Moldura } from "./Moldura";
import { Etiqueta } from "./ui";
import { ESCOPO_TODAS, nomeDoEscopo, PRACA_POR_SLUG, type EscopoSlug } from "@/lib/config";
import { rotuloPeriodo } from "@/lib/periodo";
import type { Periodo } from "@/lib/meta";

const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function Shell({
  escopo,
  children,
  titulo,
  sub,
  acoes,
}: {
  escopo: EscopoSlug;
  children: ReactNode;
  titulo: string;
  sub?: ReactNode;
  acoes?: ReactNode;
}) {
  const praca = escopo === ESCOPO_TODAS ? null : PRACA_POR_SLUG[escopo];
  const cor = praca?.cor ?? "var(--todas)";
  // Renderizado no servidor: é o instante em que os dados foram lidos da API.
  const geradoEm = HORA.format(new Date());

  return (
    <Moldura
      escopo={escopo}
      cor={cor}
      uf={praca?.uf ?? "BR"}
      titulo={titulo}
      sub={sub}
      acoes={acoes}
      geradoEm={geradoEm}
    >
      {children}
    </Moldura>
  );
}

/** Contexto do escopo, mostrado sob o título. */
export function subtituloEscopo(
  escopo: EscopoSlug,
  extra?: string,
  periodo?: Periodo,
): string {
  const base =
    escopo === ESCOPO_TODAS
      ? "Rio · Recife · Salvador · Nacional"
      : `${PRACA_POR_SLUG[escopo].marca} · ${PRACA_POR_SLUG[escopo].local}`;
  const partes = [base];
  if (extra) partes.push(extra);
  if (periodo && periodo !== "maximum") partes.push(rotuloPeriodo(periodo));
  return partes.join(" · ");
}

/**
 * Página: no desktop é uma coluna de altura total — as linhas com `flex-1`
 * dividem o que sobra, então não fica espaço morto embaixo. No mobile vira
 * uma pilha que rola.
 */
export function Pagina({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3.5 lg:h-full">{children}</div>;
}

/** Linha que cresce para ocupar a altura restante (só no desktop). */
export function Linha({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`min-h-[320px] lg:min-h-0 lg:flex-1 ${className}`}>{children}</div>;
}

/** Faixa de erro da Marketing API — mostra o que fazer. */
export function ErroMeta({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div className="cartao flex flex-col gap-2 p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="block h-2.5 w-2.5 rotate-45"
          style={{ background: "var(--critical)" }}
        />
        <h2 className="marca text-[17px]">{titulo}</h2>
      </div>
      <p className="max-w-[80ch] text-[13.5px] leading-relaxed text-[var(--ink-2)]">{detalhe}</p>
    </div>
  );
}

export { Etiqueta, nomeDoEscopo };
