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
 * Leitura: a frase que o cartão diria em voz alta.
 *
 * Ocupa a folga do cartão curto — aquele que existe ao lado de um gráfico e
 * sobrava vazio porque o irmão define a altura da linha. Em vez de esticar o
 * conteúdo ou aceitar o vão, o espaço vira a interpretação do próprio número.
 *
 * Três regras, e elas são o que separa isto de texto de enfeite:
 *
 *  1. Só afirma o que está NA MESMA CAIXA. Toda frase daqui é conferível
 *     olhando o gráfico ao lado — se precisar de um dado que não está na tela,
 *     não entra.
 *  2. É calculada no servidor, a partir dos números que a página já carregou.
 *     Sem chamada nova, sem modelo de linguagem, sem número que ninguém possa
 *     reproduzir.
 *  3. Diz o que mudou ou o que destoa, não o que o gráfico já mostra. "Instagram
 *     lidera" é legenda; "o Google entrou depois e já leva um terço da verba"
 *     é leitura.
 *
 * Quando o dado não sustenta uma frase — canal sem veiculação, série de um dia
 * só — quem chama passa `null` e o bloco não aparece. Silêncio é melhor que
 * uma observação vazia ocupando espaço.
 */
export function Leitura({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex shrink-0 gap-2 border-t border-[var(--border)] pt-3">
      <span
        aria-hidden="true"
        className="mt-[0.45em] block h-1.5 w-1.5 shrink-0 rotate-45 bg-[var(--ink-muted)]"
      />
      <p className="text-[var(--fs-corpo)] leading-relaxed text-[var(--ink-2)]">{children}</p>
    </div>
  );
}

/**
 * Corpo de cartão que carrega uma leitura: o conteúdo centraliza no espaço que
 * sobra e a leitura fica presa no rodapé. Sem isto, `justify-center` no pai
 * centralizaria os dois juntos e a folga voltaria a se abrir em cima.
 */
export function ComLeitura({
  children,
  leitura,
}: {
  children: ReactNode;
  /** `null` quando o dado não sustenta uma frase — o rodapé some junto. */
  leitura: ReactNode | null;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-5">{children}</div>
      {leitura && <Leitura>{leitura}</Leitura>}
    </div>
  );
}

/** Destaque de número dentro de uma leitura — tinta cheia, sem cor. */
export function Realce({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[var(--ink)]">{children}</strong>;
}

/**
 * Faixa de seção — ícone, rótulo em caixa alta e filete até a margem.
 * Agrupa cartões em blocos nomeados e dá ritmo vertical à página.
 */
export function Secao({ children, icone: Ic = IconPointFilled }: { children: ReactNode; icone?: Icone }) {
  return (
    <div className="faixa-secao pt-1">
      {/* Ícone à altura da letra, não maior que ela: em 0,8125rem o losango
          crescia acima da caixa do texto e a faixa lia como dois elementos
          soltos em vez de uma linha só. */}
      <Ic size="0.6rem" stroke={2} className="shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
      <h2 className="shrink-0 text-[var(--fs-rotulo)] font-semibold uppercase tracking-[0.16em] text-[var(--ink-2)]">
        {children}
      </h2>
    </div>
  );
}

/**
 * Cartão: cabeçalho opcional com filete e um corpo.
 *
 * A altura vem do CONTEÚDO, nunca da janela — só o gráfico traz altura própria
 * (`--h-grafico`), porque um SVG não tem altura natural. Tabela e galeria
 * trazem TETO (`--h-tabela`, `--h-galeria`) e rolam por dentro quando passam.
 *
 * Cartões lado a lado se igualam em altura pelo `stretch` da grade, e é o que
 * se quer — um par com as bases desencontradas fica torto. Quando um deles fica
 * com folga, a regra é UMA: o conteúdo se agrupa e centraliza (`h-full` +
 * `justify-center` + gap fixo). Nunca `justify-between`/`evenly`: distribuir na
 * altura toda afasta os itens a ponto de deixarem de ler como um bloco só, e é
 * assim que um funil de cinco etapas vira cinco medidores soltos.
 */
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
        /* Cabeçalho um pouco mais raso que o corpo: com o mesmo padding dos
           dois lados do filete, uma faixa de duas linhas de texto ficava tão
           alta quanto o gráfico que ela nomeia. */
        <header
          className="cartao-cabecalho flex shrink-0 items-start justify-between gap-3"
          style={{ padding: "calc(var(--esp-cartao-y) * 0.82) var(--esp-cartao-x)" }}
        >
          <div className="flex min-w-0 items-start gap-2">
            {Ic && (
              <Ic
                size="0.875rem"
                stroke={1.8}
                className="mt-[0.12em] shrink-0 text-[var(--ink-muted)]"
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
          <Ic size="0.8125rem" stroke={1.9} className="shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
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
  /*
   * Etiqueta é anotação, não manchete.
   *
   * Ela vinha com o mesmo peso de caixa de um título: `px-2 py-[2px]` e 0,1em
   * de tracking sobre um corpo de 6px inflam a pílula muito além do que a
   * palavra ocupa — "ATIVO" saía do tamanho de "META ADS", que é o nome do
   * canal. O que encolhe aqui é a CAIXA e o espacejamento, não a legibilidade:
   * o corpo do texto continua o mesmo, e `leading-[1.35]` garante que cedilha e
   * til não sejam cortados como já aconteceu nos títulos.
   */
  const t = TOM[tom];
  const base =
    "inline-flex shrink-0 items-center whitespace-nowrap rounded px-1.5 py-px text-[var(--fs-micro)] font-semibold uppercase leading-[1.35] tracking-[0.06em]";
  if (variante === "contorno") {
    return (
      <span
        className={`${base} gap-1.5 border`}
        style={{ borderColor: t.bdr, background: t.bg, color: t.cor }}
      >
        {children}
      </span>
    );
  }
  return (
    <span className={`${base} text-black`} style={{ background: t.cor }}>
      {children}
    </span>
  );
}

/** Status com ícone + rótulo — cor nunca carrega o significado sozinha. */
export function StatusAtivo({ ativo }: { ativo: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[var(--fs-micro)] font-semibold uppercase tracking-[0.06em]">
      <IconPointFilled
        size="0.6rem"
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
      <Ic size="1.625rem" stroke={1.5} className="text-[var(--ink-muted)]" aria-hidden="true" />
      <p className="marca text-[var(--fs-md)] leading-[1.15] text-[var(--ink-2)]">{titulo}</p>
      <p className="max-w-[46ch] text-[var(--fs-corpo)] leading-relaxed text-[var(--ink-muted)]">
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
        <span className="tabular shrink-0 text-[var(--fs-corpo-2)] text-[var(--ink-2)]">
          {formatar(valor)}{" "}
          <span className="text-[var(--ink-muted)]">/ {formatar(limite)}</span>
        </span>
      </div>
      <div className="h-[0.5625rem] w-full overflow-hidden rounded-md bg-[var(--surface-3)]">
        <div
          className="h-full rounded-md transition-[width] duration-500"
          style={{
            width: `${p}%`,
            background: "linear-gradient(90deg, var(--meta-de), var(--meta-ate))",
          }}
        />
      </div>
      <span className="tabular text-[var(--fs-corpo)] text-[var(--ink-muted)]">
        {p.toFixed(1).replace(".", ",")}% consumido
      </span>
    </div>
  );
}
