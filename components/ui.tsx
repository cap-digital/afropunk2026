import type { ReactNode } from "react";
import { IconInbox, IconPointFilled, type TablerIcon } from "@tabler/icons-react";

/**
 * Primitivas de interface.
 *
 * Regra do design system da casa: o cromo é preto e branco. Nenhuma primitiva
 * daqui aceita cor de marca — cor de praça só aparece dentro do gráfico e na
 * legenda que aponta para ele. Status (bom/alerta/crítico) é exceção, porque
 * ali a cor carrega significado próprio e vem sempre acompanhada de rótulo.
 */

/** Tipo do ícone Tabler — os componentes são forwardRef, não função simples. */
export type Icone = TablerIcon;

/**
 * Faixa de seção — ícone, rótulo em caixa alta e filete até a margem.
 * Agrupa cartões em blocos nomeados e dá ritmo vertical à página.
 */
export function Secao({ children, icone: Ic = IconPointFilled }: { children: ReactNode; icone?: Icone }) {
  return (
    <div className="faixa-secao pt-0.5">
      <Ic size={13} stroke={2} className="shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
      <h2 className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-2)]">
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
  icone: Ic,
}: {
  children: ReactNode;
  className?: string;
  titulo?: string;
  sub?: string;
  acao?: ReactNode;
  icone?: Icone;
}) {
  return (
    <section className={`cartao flex flex-col overflow-hidden ${className}`}>
      {(titulo || acao) && (
        <header
          className="cartao-cabecalho flex shrink-0 items-start justify-between gap-3"
          style={{ padding: "var(--esp-cartao-y) var(--esp-cartao-x)" }}
        >
          <div className="flex min-w-0 items-start gap-2">
            {Ic && (
              <Ic
                size={15}
                stroke={1.8}
                className="mt-[1px] shrink-0 text-[var(--ink-muted)]"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              {titulo && (
                <h3 className="truncate font-semibold leading-tight tracking-tight text-[var(--ink)]"
                  style={{ fontSize: "var(--fs-titulo-cartao)" }}>
                  {titulo}
                </h3>
              )}
              {sub && (
                <p className="mt-0.5 truncate leading-tight text-[var(--ink-muted)]"
                  style={{ fontSize: "var(--fs-sub-cartao)" }}>
                  {sub}
                </p>
              )}
            </div>
          </div>
          {acao && <div className="shrink-0">{acao}</div>}
        </header>
      )}
      <div
        className="min-h-0 flex-1"
        style={{
          padding: "var(--esp-cartao-y) var(--esp-cartao-x)",
        }}
      >
        {children}
      </div>
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
  icone: Ic,
  tamanho = "md",
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  icone?: Icone;
  tamanho?: "sm" | "md" | "lg";
}) {
  // Escala reduzida: a anterior foi calibrada em 1366 e estourava em 1280.
  /*
   * Fonte fluida e valor truncável. Eram duas causas somadas: em px fixo o
   * número não cedia quando a coluna estreitava, e sem `truncate` ele saía da
   * própria caixa e ia parar em cima do KPI seguinte.
   */
  const t = {
    sm: "var(--fs-kpi-sm)",
    md: "var(--fs-kpi)",
    lg: "var(--fs-kpi-lg)",
  }[tamanho];
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex items-center gap-1.5">
        {Ic && (
          <Ic size={13} stroke={1.9} className="shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
        )}
        <span className="rotulo truncate">{rotulo}</span>
      </div>
      <div
        className="mt-1 truncate font-bold leading-none tracking-[-0.02em] text-[var(--ink)]"
        style={{ fontSize: t }}
        title={valor}
      >
        {valor}
      </div>
      {sub && (
        <div
          className="mt-1 truncate leading-tight text-[var(--ink-muted)]"
          style={{ fontSize: "var(--fs-sub-cartao)" }}
          title={sub}
        >
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
    <div className="flex min-w-0 flex-col justify-center border-r border-[var(--border)] pr-4">
      <span className="rotulo">{rotulo}</span>
      <div
        className="mt-1.5 truncate font-bold leading-none tracking-[-0.03em] text-[var(--ink)]"
        style={{ fontSize: "var(--fs-hero)" }}
        title={valor}
      >
        {valor}
      </div>
      {sub && (
        <div
          className="mt-1.5 truncate text-[var(--ink-2)]"
          style={{ fontSize: "var(--fs-sub-cartao)" }}
          title={sub}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/**
 * Etiqueta. `tom` escolhe entre o acento neutro da interface e os status, que
 * se montam com a tríade tinta + fundo + borda da mesma família.
 */
export type TomEtiqueta = "neutro" | "bom" | "alerta" | "critico" | "apagado";

const TOM: Record<TomEtiqueta, { cor: string; bg: string; bdr: string }> = {
  neutro: { cor: "var(--ink)", bg: "var(--ui-bg)", bdr: "var(--ui-bdr)" },
  bom: { cor: "var(--good)", bg: "var(--good-bg)", bdr: "var(--good-bdr)" },
  alerta: { cor: "var(--warning)", bg: "var(--warning-bg)", bdr: "var(--warning-bdr)" },
  critico: { cor: "var(--critical)", bg: "var(--critical-bg)", bdr: "var(--critical-bdr)" },
  apagado: { cor: "var(--ink-muted)", bg: "transparent", bdr: "var(--border-forte)" },
};

export function Etiqueta({
  children,
  tom = "neutro",
  variante = "solida",
}: {
  children: ReactNode;
  tom?: TomEtiqueta;
  variante?: "solida" | "contorno";
}) {
  const t = TOM[tom];
  if (variante === "contorno") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-[2px] text-[9.5px] font-semibold uppercase tracking-[0.1em]"
        style={{ borderColor: t.bdr, background: t.bg, color: t.cor }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-[2px] text-[9.5px] font-semibold uppercase tracking-[0.1em] text-black"
      style={{ background: t.cor }}
    >
      {children}
    </span>
  );
}

/** Status com ícone + rótulo — cor nunca carrega o significado sozinha. */
export function StatusAtivo({ ativo }: { ativo: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
      <IconPointFilled
        size={12}
        aria-hidden="true"
        style={{ color: ativo ? "var(--good)" : "var(--ink-muted)" }}
      />
      <span style={{ color: ativo ? "var(--good)" : "var(--ink-muted)" }}>
        {ativo ? "Ativa" : "Sem veiculação"}
      </span>
    </span>
  );
}

/** Estado vazio — praça sem campanha no canal, recorte sem linha. */
export function Vazio({
  titulo,
  descricao,
  icone: Ic = IconInbox,
}: {
  titulo: string;
  descricao: string;
  icone?: Icone;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
      <Ic size={26} stroke={1.5} className="text-[var(--ink-muted)]" aria-hidden="true" />
      <p className="marca text-[15px] leading-[1.15] text-[var(--ink-2)]">{titulo}</p>
      <p className="max-w-[46ch] text-[11.5px] leading-relaxed text-[var(--ink-muted)]">
        {descricao}
      </p>
    </div>
  );
}

/**
 * Barra de meta/consumo. O gradiente é o único do sistema da casa e o único
 * lugar de cor não-status no cromo — vem do design system, não da praça.
 */
export function BarraMeta({
  valor,
  limite,
  rotulo,
  formatar,
}: {
  valor: number;
  limite: number;
  rotulo: string;
  formatar: (n: number) => string;
}) {
  const p = limite > 0 ? Math.min((valor / limite) * 100, 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="rotulo truncate">{rotulo}</span>
        <span className="tabular shrink-0 text-[12px] text-[var(--ink-2)]">
          {formatar(valor)}{" "}
          <span className="text-[var(--ink-muted)]">/ {formatar(limite)}</span>
        </span>
      </div>
      <div className="h-[9px] w-full overflow-hidden rounded-md bg-[var(--surface-3)]">
        <div
          className="h-full rounded-md transition-[width] duration-500"
          style={{
            width: `${p}%`,
            background: "linear-gradient(90deg, var(--meta-de), var(--meta-ate))",
          }}
        />
      </div>
      <span className="tabular text-[11px] text-[var(--ink-muted)]">
        {p.toFixed(1).replace(".", ",")}% consumido
      </span>
    </div>
  );
}
