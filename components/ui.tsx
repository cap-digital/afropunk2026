import type { ReactNode } from "react";

/**
 * Faixa de seção — losango, rótulo em caixa alta e filete até a margem.
 * Serve para agrupar cartões em blocos nomeados e dar ritmo vertical à
 * página, no lugar de uma grade uniforme de caixas iguais.
 */
export function Secao({ children, cor }: { children: ReactNode; cor?: string }) {
  return (
    <div className="faixa-secao pt-0.5">
      <span
        aria-hidden="true"
        className="block h-[7px] w-[7px] shrink-0 rotate-45"
        style={{ background: cor ?? "var(--ink-muted)" }}
      />
      <h2 className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--ink-2)]">
        {children}
      </h2>
    </div>
  );
}

export function Cartao({
  children,
  className = "",
  titulo,
  sub,
  acao,
  cor,
}: {
  children: ReactNode;
  className?: string;
  titulo?: string;
  sub?: string;
  acao?: ReactNode;
  cor?: string;
}) {
  return (
    <section className={`cartao flex flex-col overflow-hidden ${className}`}>
      {(titulo || acao) && (
        <header className="cartao-cabecalho flex shrink-0 items-start justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            {cor && (
              <span
                aria-hidden="true"
                className="mt-[3px] block h-[6px] w-[6px] shrink-0 rotate-45"
                style={{ background: cor }}
              />
            )}
            <div className="min-w-0">
              {titulo && (
                <h3 className="truncate text-[13.5px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
                  {titulo}
                </h3>
              )}
              {sub && (
                <p className="mt-0.5 truncate text-[11.5px] leading-tight text-[var(--ink-muted)]">
                  {sub}
                </p>
              )}
            </div>
          </div>
          {acao && <div className="shrink-0">{acao}</div>}
        </header>
      )}
      <div className="min-h-0 flex-1 px-4 pb-4 pt-3.5">{children}</div>
    </section>
  );
}

/**
 * Stat tile: valor + rótulo + contexto.
 * Números grandes usam figuras proporcionais; `tabular` fica para colunas.
 */
export function Stat({
  rotulo,
  valor,
  sub,
  cor,
  tamanho = "md",
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  cor?: string;
  tamanho?: "sm" | "md" | "lg";
}) {
  const t = { sm: "text-[19px]", md: "text-[25px]", lg: "text-[34px]" }[tamanho];
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex items-center gap-1.5">
        {cor && (
          <span
            aria-hidden="true"
            className="block h-2 w-2 shrink-0 rotate-45"
            style={{ background: cor }}
          />
        )}
        <span className="rotulo truncate">{rotulo}</span>
      </div>
      <div className={`mt-1 font-bold leading-none tracking-[-0.02em] text-[var(--ink)] ${t}`}>
        {valor}
      </div>
      {sub && (
        <div className="mt-1 truncate text-[12px] leading-tight text-[var(--ink-muted)]">
          {sub}
        </div>
      )}
    </div>
  );
}

/** Hero: o número que a página lidera. Separado por um filete vertical. */
export function Hero({
  rotulo,
  valor,
  sub,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col justify-center border-r border-[var(--border)] pr-5">
      <span className="rotulo">{rotulo}</span>
      <div className="mt-1.5 whitespace-nowrap text-[30px] font-black leading-none tracking-[-0.035em] text-[var(--ink)] xl:text-[36px]">
        {valor}
      </div>
      {sub && <div className="mt-1.5 truncate text-[11.5px] text-[var(--ink-2)]">{sub}</div>}
    </div>
  );
}

export function Etiqueta({
  children,
  cor,
  variante = "solida",
}: {
  children: ReactNode;
  cor?: string;
  variante?: "solida" | "contorno";
}) {
  if (variante === "contorno") {
    return (
      <span
        className="inline-flex items-center border px-1.5 py-[2px] text-[11px] font-bold uppercase tracking-[0.12em]"
        style={{ borderColor: cor ?? "var(--border-forte)", color: cor ?? "var(--ink-2)" }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-1.5 py-[2px] text-[11px] font-bold uppercase tracking-[0.12em] text-black"
      style={{ background: cor ?? "var(--ink)" }}
    >
      {children}
    </span>
  );
}

/** Ponto de status com ícone + rótulo — cor nunca carrega o significado sozinha. */
export function StatusAtivo({ ativo }: { ativo: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]">
      <span
        aria-hidden="true"
        className="block h-1.5 w-1.5 rotate-45"
        style={{ background: ativo ? "var(--good)" : "var(--ink-muted)" }}
      />
      <span style={{ color: ativo ? "var(--good)" : "var(--ink-muted)" }}>
        {ativo ? "Ativa" : "Sem veiculação"}
      </span>
    </span>
  );
}

/** Estado vazio — usado por Salvador enquanto não há campanha ativa. */
export function Vazio({
  titulo,
  descricao,
  cor,
}: {
  titulo: string;
  descricao: string;
  cor?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
      <span className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-2 w-2 rotate-45"
            style={{ background: cor ?? "var(--ink-muted)", opacity: 0.35 + i * 0.25 }}
          />
        ))}
      </span>
      <p className="marca text-[17px] text-[var(--ink-2)]">{titulo}</p>
      <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-[var(--ink-muted)]">
        {descricao}
      </p>
    </div>
  );
}
