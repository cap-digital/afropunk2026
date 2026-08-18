"use client";

import { Fragment } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { brl, brlCompact, compact, dec, diaMesCurto, int, pct } from "@/lib/format";

const GRID = "var(--grid)";
const EIXO = "var(--baseline)";
// O tamanho vem do CSS (`.recharts-cartesian-axis-tick text`), que vence o
// atributo de apresentação — por isso aqui só a cor. Os `fontSize` que
// existiam neste objeto e nos overrides por eixo nunca chegaram a renderizar.
const TICK = { fill: "var(--ink-muted)" };
const SURFACE = "var(--surface)";

export type Formato = "brl" | "int" | "pct" | "dec" | "roas";

export function fmt(v: number, f: Formato = "int"): string {
  switch (f) {
    case "brl":
      return brl(v);
    case "pct":
      return pct(v);
    case "dec":
      return dec(v);
    case "roas":
      return `${dec(v)}×`;
    default:
      return int(v);
  }
}
function fmtEixo(v: number, f: Formato = "int"): string {
  switch (f) {
    case "brl":
      return brlCompact(v);
    case "pct":
      return `${dec(v)}%`;
    case "roas":
      return `${dec(v)}×`;
    default:
      return compact(v);
  }
}

// ------------------------------------------------------------------ tooltip

function Caixa({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[5px] border border-[var(--border-forte)] bg-[var(--surface-2)] px-2.5 py-2 shadow-xl">
      {children}
    </div>
  );
}

interface ItemDica {
  name?: string | number;
  value?: string | number;
  color?: string;
  fill?: string;
}

interface DicaProps {
  active?: boolean;
  payload?: ItemDica[];
  label?: string | number;
  formato?: Formato;
  rotuloEixo?: (v: string) => string;
}

function DicaPadrao({ active, payload, label, formato = "int", rotuloEixo }: DicaProps) {
  if (!active || !payload?.length) return null;
  return (
    <Caixa>
      {label !== undefined && (
        <div className="mb-1.5 text-[length:var(--fs-rotulo)] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          {rotuloEixo ? rotuloEixo(String(label)) : label}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-[length:var(--fs-corpo-2)]">
            <span className="flex items-center gap-1.5 text-[var(--ink-2)]">
              <span
                aria-hidden="true"
                className="block h-2 w-2 rotate-45"
                style={{ background: p.color ?? p.fill }}
              />
              {p.name}
            </span>
            <span className="tabular font-semibold text-[var(--ink)]">
              {fmt(Math.abs(Number(p.value)), formato)}
            </span>
          </div>
        ))}
      </div>
    </Caixa>
  );
}

/** Recharts entrega props não tipadas ao `content`; normalizamos aqui. */
function dica(formato: Formato, rotuloEixo?: (v: string) => string) {
  const Conteudo = (props: unknown) => (
    <DicaPadrao {...(props as DicaProps)} formato={formato} rotuloEixo={rotuloEixo} />
  );
  Conteudo.displayName = "DicaTooltip";
  return Conteudo;
}

const CURSOR_LINHA = { stroke: "var(--ink-muted)", strokeWidth: 1, strokeDasharray: "3 3" };
const CURSOR_BARRA = { fill: "rgba(255,255,255,0.05)" };

interface ItemLegenda {
  value?: string | number;
  color?: string;
}

function LegendaChips({ payload }: { payload?: ItemLegenda[] }) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1.5">
      {payload.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5 text-[length:var(--fs-corpo)] text-[var(--ink-2)]">
          <span
            aria-hidden="true"
            className="block h-2 w-2 rotate-45"
            style={{ background: p.color }}
          />
          {p.value}
        </span>
      ))}
    </div>
  );
}

function legenda() {
  const Conteudo = (props: unknown) => (
    <LegendaChips {...(props as { payload?: ItemLegenda[] })} />
  );
  Conteudo.displayName = "LegendaGrafico";
  return Conteudo;
}

/** Ponto genérico de gráfico: chaves de série resolvidas em runtime. */
export type PontoGrafico = Record<string, string | number | undefined>;

// ------------------------------------------------------------- rótulos

interface PropsRotulo {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | string;
  index?: number;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

/**
 * Rótulo no PICO de cada série.
 *
 * Rotular o último ponto parecia natural, mas as séries convergem no dia
 * corrente (parcial) e os rótulos se empilham uns sobre os outros. O pico de
 * cada série cai em dias e alturas diferentes, então se espalham sozinhos — e
 * é a informação mais útil da linha.
 */
function rotuloPico(dados: PontoGrafico[], chave: string, formato: Formato, cor: string) {
  let iPico = -1;
  let maior = 0;
  dados.forEach((d, i) => {
    const v = Number(d[chave]);
    if (Number.isFinite(v) && v > maior) {
      maior = v;
      iPico = i;
    }
  });

  const Conteudo = (props: unknown) => {
    const { x, y, value, index } = props as PropsRotulo;
    const v = num(value);
    if (v === null || x === undefined || y === undefined || index !== iPico) return null;
    const cheio = fmt(v, formato);
    const texto = cheio.length > 12 ? fmtEixo(v, formato) : cheio;
    // Nas pontas o rótulo centralizado é cortado pela borda do gráfico.
    const naDireita = index === dados.length - 1;
    const naEsquerda = index === 0;
    return (
      <text
        x={naDireita ? x - 2 : naEsquerda ? x + 2 : x}
        y={y - 10}
        fill={cor}
        style={{ fontSize: "var(--fs-valor-grafico)", fontWeight: 600 }}
        textAnchor={naDireita ? "end" : naEsquerda ? "start" : "middle"}
      >
        {texto}
      </text>
    );
  };
  Conteudo.displayName = "RotuloPico";
  return Conteudo;
}

/**
 * Rótulo em todos os pontos quando são poucos; só no último quando são muitos.
 * O limite evita que a série vire uma fileira de números conforme os dias
 * se acumulam.
 */
function rotuloPontos(
  dados: PontoGrafico[],
  chave: string,
  formato: Formato,
  cor: string,
  limite = 8,
) {
  const total = dados.length;
  const todos = total <= limite;
  // Série longa: um rótulo só, no pico. O último dia costuma ser parcial e
  // rotulá-lo dá a impressão errada de queda.
  let iPico = -1;
  let maior = 0;
  dados.forEach((d, i) => {
    const v = Number(d[chave]);
    if (Number.isFinite(v) && v > maior) {
      maior = v;
      iPico = i;
    }
  });

  const Conteudo = (props: unknown) => {
    const { x, y, value, index } = props as PropsRotulo;
    const v = num(value);
    if (v === null || x === undefined || y === undefined) return null;
    if (!todos && index !== iPico) return null;
    const cheio = fmt(v, formato);
    const texto = cheio.length > 12 ? fmtEixo(v, formato) : cheio;
    const naDireita = index === total - 1;
    const naEsquerda = index === 0;
    return (
      <text
        x={naDireita ? x - 2 : naEsquerda ? x + 2 : x}
        y={y - 9}
        fill={cor}
        style={{ fontSize: "var(--fs-valor-grafico)", fontWeight: 600 }}
        textAnchor={naDireita ? "end" : naEsquerda ? "start" : "middle"}
      >
        {texto}
      </text>
    );
  };
  Conteudo.displayName = "RotuloPontos";
  return Conteudo;
}

/**
 * Rótulo no topo da barra, com altura escalonada por série.
 *
 * Barras vizinhas de um grupo ficam a ~37px de distância e um número tem
 * ~42px: lado a lado eles se sobrepõem. Cada série ganha uma faixa de altura
 * própria, então vizinhos nunca disputam o mesmo espaço.
 */
function rotuloTopo(formato: Formato, indiceSerie: number) {
  const Conteudo = (props: unknown) => {
    const { x, y, width, value } = props as PropsRotulo;
    const v = num(value);
    if (v === null || x === undefined || y === undefined || width === undefined) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 6 - indiceSerie * 14}
        textAnchor="middle"
        fill="var(--ink-2)"
        style={{ fontSize: "var(--fs-valor-grafico)", fontWeight: 600 }}
      >
        {fmt(v, formato)}
      </text>
    );
  };
  Conteudo.displayName = "RotuloTopo";
  return Conteudo;
}


// ------------------------------------------------------------------ tempo

export interface SerieTempo {
  chave: string;
  nome: string;
  cor: string;
}

/** Área empilhada / simples ao longo do tempo. Crosshair + tooltip por padrão. */
export function AreaTempo({
  dados,
  series,
  formato = "brl",
  altura = "100%",
  empilhar = false,
}: {
  dados: PontoGrafico[];
  series: SerieTempo[];
  formato?: Formato;
  altura?: number | string;
  empilhar?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={dados} margin={{ top: 22, right: 14, left: 2, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.chave} id={`g-${s.chave}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.cor} stopOpacity={0.38} />
              <stop offset="100%" stopColor={s.cor} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={diaMesCurto}
          tick={TICK}
          axisLine={{ stroke: EIXO }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={66}
          tickFormatter={(v) => fmtEixo(v, formato)}
        />
        <Tooltip
          cursor={CURSOR_LINHA}
          content={dica(formato, diaMesCurto)}
        />
        {series.length > 1 && <Legend content={legenda()} />}
        {series.map((s) => (
          <Area
            key={s.chave}
            type="monotone"
            dataKey={s.chave}
            name={s.nome}
            stroke={s.cor}
            strokeWidth={2}
            fill={`url(#g-${s.chave})`}
            stackId={empilhar ? "1" : undefined}
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: SURFACE }}
            isAnimationActive={false}
          >
            {/* Com mais de uma série, rotular todo ponto sobrepõe os números
                das séries vizinhas nos dias em que elas se aproximam — aí só o
                pico de cada uma, que cai em dias diferentes. */}
            <LabelList
              dataKey={s.chave}
              content={
                series.length > 1
                  ? rotuloPico(dados, s.chave, formato, s.cor)
                  : rotuloPontos(dados, s.chave, formato, s.cor)
              }
            />
          </Area>
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Multi-linha — para comparar praças na mesma escala. */
export function LinhasTempo({
  dados,
  series,
  formato = "brl",
  altura = "100%",
}: {
  dados: PontoGrafico[];
  series: SerieTempo[];
  formato?: Formato;
  altura?: number | string;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={dados} margin={{ top: 26, right: 16, left: 2, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={diaMesCurto}
          tick={TICK}
          axisLine={{ stroke: EIXO }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={66}
          tickFormatter={(v) => fmtEixo(v, formato)}
        />
        <Tooltip
          cursor={CURSOR_LINHA}
          content={dica(formato, diaMesCurto)}
        />
        {series.length > 1 && <Legend content={legenda()} />}
        {series.map((s) => (
          <Line
            key={s.chave}
            type="monotone"
            dataKey={s.chave}
            name={s.nome}
            stroke={s.cor}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: s.cor }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE }}
            connectNulls
            isAnimationActive={false}
          >
            <LabelList dataKey={s.chave} content={rotuloPico(dados, s.chave, formato, s.cor)} />
          </Line>
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Sparkline para stat tiles e small multiples. */
export function Sparkline({
  dados,
  chave = "spend",
  cor,
  altura = 34,
}: {
  dados: PontoGrafico[];
  chave?: string;
  cor: string;
  /** Aceita "100%" para acompanhar a caixa, que agora é dimensionada em rem. */
  altura?: number | string;
}) {
  if (!dados?.length) return <div style={{ height: altura }} />;
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={dados} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp-${chave}-${cor.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={chave}
          stroke={cor}
          strokeWidth={2}
          fill={`url(#sp-${chave}-${cor.replace("#", "")})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------------ barras

/** Barras horizontais. Uma cor por item (categórico) ou rampa sequencial. */
export function BarrasH({
  dados,
  chaveValor = "valor",
  chaveNome = "nome",
  formato = "int",
  altura,
  cores,
  corUnica,
  rotularValor = true,
  larguraRotulo = 96,
}: {
  dados: PontoGrafico[];
  chaveValor?: string;
  chaveNome?: string;
  formato?: Formato;
  /** Só quando o chamador precisa fugir da altura por faixa. */
  altura?: number | string;
  cores?: string[];
  corUnica?: string;
  rotularValor?: boolean;
  larguraRotulo?: number;
}) {
  /*
   * Altura DERIVADA do número de faixas.
   *
   * Antes era `100%` e quem chamava embrulhava num `h-[var(--h-grafico)]` —
   * a mesma medida do gráfico de série temporal. Só que uma série contínua
   * precisa de altura para a curva ter forma, e uma lista de cinco barras não:
   * ela precisa de cinco faixas. Esticada em 36vh, cada barra de 22px ficava
   * numa pista de 72px, o cartão ficava com o dobro da altura do conteúdo, e —
   * porque o irmão mais alto da linha define a altura de todos — arrastava
   * "Orçamento" e "Destaques por ROAS" junto, empurrando a página para fora
   * da tela.
   *
   * A faixa tem piso e teto em px de propósito: `maxBarSize` é px cravado, e
   * numa raiz pequena uma faixa puramente em `rem` ficaria menor que a própria
   * barra.
   */
  const alturaFaixas = `calc(${Math.max(dados.length, 1)} * var(--h-barra-faixa) + var(--h-barra-folga))`;
  return (
    <div style={{ height: altura ?? alturaFaixas }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ top: 2, right: rotularValor ? 52 : 8, left: 0, bottom: 0 }}
        barCategoryGap="22%"
      >
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey={chaveNome}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          interval={0}
          width={larguraRotulo}
        />
        <Tooltip cursor={CURSOR_BARRA} content={dica(formato)} />
        <Bar dataKey={chaveValor} name="Valor" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          {dados.map((d, i) => (
            <Cell
              key={i}
              fill={
                (typeof d.cor === "string" ? d.cor : undefined) ??
                cores?.[i] ??
                corUnica ??
                "var(--seq-2)"
              }
            />
          ))}
          {rotularValor && (
            <LabelList
              dataKey={chaveValor}
              position="right"
              // Valor cheio muito longo é cortado pela margem: acima de 12
              // caracteres cai para a forma compacta.
              formatter={(v: number) => {
                const cheio = fmt(v, formato);
                return cheio.length > 12 ? fmtEixo(v, formato) : cheio;
              }}
              style={{ fill: "var(--ink-2)", fontSize: "var(--fs-valor-grafico)", fontWeight: 600 }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

/** Barras verticais agrupadas — comparação entre praças por métrica. */
export function BarrasAgrupadas({
  dados,
  series,
  formato = "int",
  altura = "100%",
  chaveNome = "nome",
}: {
  dados: PontoGrafico[];
  series: SerieTempo[];
  formato?: Formato;
  altura?: number | string;
  chaveNome?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} margin={{ top: 34, right: 6, left: 0, bottom: 0 }} barGap={3}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey={chaveNome}
          tick={TICK}
          axisLine={{ stroke: EIXO }}
          tickLine={false}
        />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v) => fmtEixo(v, formato)}
        />
        <Tooltip cursor={CURSOR_BARRA} content={dica(formato)} />
        {series.length > 1 && <Legend content={legenda()} />}
        {series.map((s, i) => (
          <Bar
            key={s.chave}
            dataKey={s.chave}
            name={s.nome}
            fill={s.cor}
            radius={[4, 4, 0, 0]}
            maxBarSize={34}
            isAnimationActive={false}
          >
            {/* Acima de ~12 barras os rótulos encostam uns nos outros. */}
            {dados.length * series.length <= 12 && (
              <LabelList dataKey={s.chave} content={rotuloTopo(formato, i)} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Barra empilhada horizontal única — parte-do-todo.
 * O anel de 2px na cor da superfície é o separador entre segmentos.
 */
export function EmpilhadaTotal({
  segmentos,
  formato = "brl",
  esticar = false,
}: {
  segmentos: { nome: string; valor: number; cor: string }[];
  formato?: Formato;
  /**
   * A barra cresce com a altura disponível em vez de ficar em 24px.
   *
   * Numa linha que preenche a tela, três faixas de 24px dentro de um cartão de
   * 500px deixam o conteúdo boiando. Barra é forma, não texto: engrossar não
   * atrapalha a leitura da proporção — ao contrário, o rótulo de porcentagem
   * dentro dela fica mais confortável. Quem tem altura fixa mantém `false`.
   */
  esticar?: boolean;
}) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0) || 1;
  return (
    <div className={`flex flex-col gap-2.5 ${esticar ? "h-full" : ""}`}>
      <div
        /*
          Teto de 3,25rem no modo esticado: barra é forma, e forma tem uma
          proporção onde ainda lê como barra. Sem teto, num cartão alto com uma
          faixa só ela virava uma laje de cor ocupando um terço da tela — o
          oposto do que "preencher o espaço" deveria significar.
        */
        className={`flex w-full overflow-hidden rounded-[5px] ${
          esticar ? "max-h-[3.25rem] min-h-[1.75rem] flex-1" : "h-6"
        }`}
      >
        {segmentos.map((s) => {
          const p = (s.valor / total) * 100;
          if (p <= 0) return null;
          return (
            <div
              key={s.nome}
              title={`${s.nome}: ${fmt(s.valor, formato)} (${dec(p)}%)`}
              style={{
                width: `${p}%`,
                background: s.cor,
                boxShadow: `inset -2px 0 0 0 ${"var(--surface)"}`,
              }}
              className="group relative overflow-hidden transition-opacity hover:opacity-85"
            >
              {/* Corte em 14%: abaixo disso a faixa fica mais estreita que o
                  próprio número em cartões de coluna, e o rótulo vazava para o
                  segmento vizinho. O valor exato está sempre na legenda. */}
              {p >= 14 && (
                <span className="absolute inset-0 flex items-center justify-center text-[length:var(--fs-rotulo)] font-semibold text-black/80">
                  {dec(p)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segmentos.map((s) => (
          <span key={s.nome} className="flex items-center gap-1.5 text-[length:var(--fs-corpo)]">
            <span
              aria-hidden="true"
              className="block h-2 w-2 rotate-45"
              style={{ background: s.cor }}
            />
            <span className="text-[var(--ink-2)]">{s.nome}</span>
            <span className="tabular font-semibold text-[var(--ink)]">
              {fmt(s.valor, formato)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ público

/**
 * Pirâmide etária — barra divergente centrada no zero.
 * Mulheres à esquerda (negativo), homens à direita; o sinal é só geometria.
 */
export function Piramide({
  dados,
  corF,
  corM,
  altura = "100%",
  formato = "int",
}: {
  dados: { faixa: string; feminino: number; masculino: number }[];
  corF: string;
  corM: string;
  altura?: number | string;
  formato?: Formato;
}) {
  const plot = dados.map((d) => ({ ...d, feminino: -Math.abs(d.feminino) }));
  const max = Math.max(...dados.map((d) => Math.max(d.feminino, d.masculino)), 1);
  /**
   * Arredonda o limite para cima até meia potência de 10. Com um domínio
   * simétrico e "redondo", o Recharts gera ticks que passam pelo zero sozinho —
   * forçar `ticks` explicitamente quebra o posicionamento das barras empilhadas
   * com stackOffset="sign".
   */
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const limite = Math.ceil(max / (mag / 2)) * (mag / 2);
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        data={plot}
        layout="vertical"
        stackOffset="sign"
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        barCategoryGap="18%"
      >
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" horizontal={false} />
        <XAxis
          type="number"
          domain={[-limite, limite]}
          /* 3 marcas: extremo, zero, extremo. Com 5 o rótulo do meio some em
             telas estreitas e o eixo espelhado fica ilegível. */
          tickCount={3}
          allowDecimals={false}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => fmtEixo(Math.abs(v), formato)}
        />
        <YAxis
          type="category"
          dataKey="faixa"
          tick={TICK}
          axisLine={false}
          tickLine={false}
          interval={0}
          width={52}
        />
        <Tooltip cursor={CURSOR_BARRA} content={dica(formato)} />
        <Legend content={legenda()} />
        <ReferenceLine x={0} stroke={EIXO} strokeWidth={1} />
        {/*
          DEFEITO ABERTO: nenhuma barra é desenhada.
          Eixos, grade, legenda e tooltip renderizam; os `<g
          class="recharts-bar-rectangle">` saem VAZIOS, o que no Recharts quer
          dizer geometria inválida (NaN) chegando ao `Rectangle`.

          Já descartados: `radius` em array (tirar não muda nada) e
          `stackOffset="sign"` (tirar piora — some até o grupo do retângulo).
          Os dados chegam certos: `plot` traz `feminino` negativo e `masculino`
          positivo, ambos numéricos. A suspeita que sobra é a combinação
          `layout="vertical"` + `stackId` + domínio simétrico explícito.

          Fica como está — errado e visível — em vez de "consertado" por
          tentativa. Quem for atacar: comparar com um caso mínimo sem
          `domain`/`tickCount` fixos é o próximo passo.
        */}
        <Bar
          dataKey="feminino"
          name="Feminino"
          fill={corF}
          stackId="s"
          radius={[4, 0, 0, 4]}
          maxBarSize={20}
        />
        <Bar
          dataKey="masculino"
          name="Masculino"
          fill={corM}
          stackId="s"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface PontoDispersao {
  x: number;
  y: number;
  z: number;
  nome: string;
  cor: string;
}

/** Dispersão CPM × CTR, tamanho = investimento. Cap de 3 cores (regra all-pairs). */
export function Dispersao({
  dados,
  altura = "100%",
}: {
  dados: PontoDispersao[];
  altura?: number | string;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <ScatterChart margin={{ top: 10, right: 14, left: 0, bottom: 16 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
        <XAxis
          type="number"
          dataKey="x"
          name="CPM"
          tick={TICK}
          axisLine={{ stroke: EIXO }}
          tickLine={false}
          tickFormatter={(v) => brlCompact(v)}
          label={{
            value: "CPM",
            position: "insideBottom",
            offset: -10,
            style: { fill: "var(--ink-muted)", fontSize: "var(--fs-eixo)" },
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="CTR"
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v) => `${dec(v)}%`}
        />
        <ZAxis type="number" dataKey="z" range={[80, 620]} name="Investimento" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: "var(--ink-muted)" }}
          content={(props: unknown) => {
            const { active, payload } = props as {
              active?: boolean;
              payload?: { payload: PontoDispersao }[];
            };
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <Caixa>
                <div className="mb-1 flex items-center gap-1.5 text-[length:var(--fs-corpo-2)] font-semibold text-[var(--ink)]">
                  <span
                    aria-hidden="true"
                    className="block h-2 w-2 rotate-45"
                    style={{ background: d.cor }}
                  />
                  {d.nome}
                </div>
                <div className="tabular flex flex-col gap-0.5 text-[length:var(--fs-corpo-2)] text-[var(--ink-2)]">
                  <span>CPM {brl(d.x)}</span>
                  <span>CTR {pct(d.y)}</span>
                  <span>Investimento {brl(d.z)}</span>
                </div>
              </Caixa>
            );
          }}
        />
        <Scatter data={dados} isAnimationActive={false}>
          {dados.map((d, i) => (
            <Cell key={i} fill={d.cor} fillOpacity={0.75} stroke={SURFACE} strokeWidth={2} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------- formas sem recharts

/** Mapa de calor plataforma × posicionamento, na rampa sequencial ciano. */
export function MapaCalor({
  linhas,
  colunas,
  valores,
  formato = "int",
  larguraRotulo = 104,
}: {
  linhas: string[];
  colunas: string[];
  valores: Map<string, number>;
  formato?: Formato;
  larguraRotulo?: number;
}) {
  const max = Math.max(...[...valores.values()], 1);
  const passo = (v: number) => {
    if (v <= 0) return "var(--surface-2)";
    const r = v / max;
    if (r > 0.66) return "var(--seq-4)";
    if (r > 0.33) return "var(--seq-3)";
    if (r > 0.08) return "var(--seq-2)";
    return "var(--seq-1)";
  };
  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      {/*
        A faixa do mapa é a MESMA do gráfico de barras (`--h-barra-faixa`): nos
        dois casos uma linha é uma categoria, e o que define a altura é quantas
        elas são.

        Antes as linhas eram `minmax(0, 1fr)` esticando dentro de um wrapper de
        36vh — cinco plataformas viravam cinco tiras de 65px, e duas delas sem
        nenhuma entrega. O mapa ficava do tamanho de uma série temporal para
        mostrar uma tabela de cinco por sete.
      */}
      <div
        className="grid min-h-0 gap-[2px] text-[length:var(--fs-corpo)]"
        style={{
          gridTemplateColumns: `${larguraRotulo}px repeat(${colunas.length}, minmax(0,1fr))`,
          gridTemplateRows: `auto repeat(${linhas.length}, var(--h-barra-faixa))`,
        }}
      >
        <div />
        {colunas.map((c) => (
          <div
            key={c}
            className="truncate pb-1 text-center text-[length:var(--fs-rotulo)] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]"
            title={c}
          >
            {c}
          </div>
        ))}
        {linhas.map((l) => (
          <Fragment key={l}>
            {/*
              `truncate` esconde nos DOIS eixos. Com a linha do grid comprimida
              a 16px e a fonte fluida pedindo 20px de caixa, ele cortava o
              rótulo do dia na horizontal e na vertical. Aqui só o horizontal
              recorta; `leading-none` tira a folga que sobrava da entrelinha.
            */}
            <div
              className="flex items-center overflow-x-hidden text-ellipsis whitespace-nowrap pr-2 leading-none text-[length:var(--fs-corpo)] text-[var(--ink-2)]"
              title={l}
            >
              {l}
            </div>
            {colunas.map((c) => {
              const v = valores.get(`${l}||${c}`) ?? 0;
              const claro = v / max > 0.33;
              return (
                <div
                  key={`${l}-${c}`}
                  title={`${l} · ${c}: ${fmt(v, formato)}`}
                  style={{ background: passo(v) }}
                  className="flex h-full min-h-0 items-center justify-center rounded-[3px] transition-opacity hover:opacity-80"
                >
                  <span
                    className="tabular text-[length:var(--fs-rotulo)] font-semibold"
                    style={{ color: v <= 0 ? "var(--ink-muted)" : claro ? "#0b0b0b" : "#ffffff" }}
                  >
                    {v > 0 ? compact(v) : "–"}
                  </span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-1 text-[length:var(--fs-rotulo)] text-[var(--ink-muted)]">
        <span>Menos</span>
        {["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)"].map((c) => (
          <span key={c} className="block h-2.5 w-6 rounded-[2px]" style={{ background: c }} />
        ))}
        <span>Mais</span>
      </div>
    </div>
  );
}

/** Funil de conversão — etapas ordenadas com taxa de passagem. */
export function Funil({
  etapas,
  cor,
  esticar = true,
}: {
  etapas: { nome: string; valor: number }[];
  cor: string;
  /** Centraliza o bloco na altura do cartão em vez de ancorar no topo. */
  esticar?: boolean;
}) {
  const topo = etapas[0]?.valor || 1;
  return (
    /*
     * Centraliza com gap FIXO — não distribui na altura toda.
     *
     * Era `justify-between`, para o funil não empilhar no topo e deixar vazio
     * embaixo. Só que espalhar cinco etapas por 400px afasta uma barra da outra
     * a ponto de deixarem de ler como uma sequência: viram cinco medidores
     * soltos, e a queda de etapa para etapa — que é a informação — some.
     * Bloco junto, centrado, com a folga sobrando em volta. Mesma conclusão a
     * que a legenda do FunilEventos já tinha chegado.
     */
    <div className={`flex h-full flex-col gap-4 ${esticar ? "justify-center" : "justify-start"}`}>
      {etapas.map((e, i) => {
        const larg = Math.max((e.valor / topo) * 100, 0.6);
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        const taxa = anterior && anterior > 0 ? (e.valor / anterior) * 100 : null;
        return (
          <div key={e.nome} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[length:var(--fs-corpo-2)] text-[var(--ink-2)]">{e.nome}</span>
              <span className="flex items-baseline gap-2">
                {taxa !== null && (
                  <span className="tabular text-[length:var(--fs-corpo)] text-[var(--ink-muted)]">
                    {dec(taxa)}% vs. etapa anterior
                  </span>
                )}
                <span className="tabular text-[length:var(--fs-corpo-2)] font-bold text-[var(--ink)]">
                  {int(e.valor)}
                </span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-[3px] bg-[var(--surface-2)]">
              <div
                className="h-full rounded-[3px] transition-all"
                style={{
                  width: `${larg}%`,
                  background: cor,
                  opacity: 1 - i * 0.13,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Medidor: uma razão contra um limite, na mesma rampa. */
export function Medidor({
  valor,
  limite,
  rotulo,
  formato = "brl",
  cor,
}: {
  valor: number;
  limite: number;
  rotulo: string;
  formato?: Formato;
  cor: string;
}) {
  const p = limite > 0 ? Math.min((valor / limite) * 100, 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      {/* Rótulo curto em cima, números embaixo: com o rótulo e os dois valores
          na mesma linha, cada monitor truncava num ponto diferente. */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="rotulo">{rotulo}</span>
        <span className="tabular text-[var(--ink-2)]" style={{ fontSize: "var(--fs-corpo)" }}>
          {fmt(valor, formato)}{" "}
          <span className="text-[var(--ink-muted)]">de {fmt(limite, formato)}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: cor }} />
      </div>
      <span className="tabular text-[length:var(--fs-corpo)] text-[var(--ink-muted)]">{dec(p)}% consumido</span>
    </div>
  );
}

/**
 * Funil em trapézios: cada faixa estreita conforme o valor da etapa, e a base
 * de uma encosta no topo da seguinte — a forma comunica a perda sem precisar
 * ler os números.
 *
 * Feito com `clip-path` em HTML, não SVG: o texto fica dentro da faixa com a
 * mesma nitidez e as mesmas regras tipográficas do resto do dashboard.
 * Altura fixa e modesta: esticado na altura do cartão, vira um bloco pesado
 * que domina a tela.
 */
export function FunilTrapezio({
  etapas,
  cor,
  alturaBanda = 54,
}: {
  etapas: { nome: string; valor: number }[];
  cor: string;
  alturaBanda?: number;
}) {
  if (etapas.length === 0) return null;

  /**
   * Afunilamento CONSTANTE: cada faixa estreita o mesmo tanto, independentemente
   * do valor. A largura proporcional deixava a última faixa minúscula e a forma
   * ilegível — quem carrega a grandeza é o número, ao lado; a forma só diz que
   * há uma sequência de etapas.
   */
  const LARGURA_MIN = 34;
  const passo = (100 - LARGURA_MIN) / etapas.length;
  const larguraNo = (i: number) => 100 - passo * i;

  return (
    // gap-2: separação visível entre os níveis, como no funil de referência.
    <div className="flex w-full flex-col gap-2">
      {etapas.map((e, i) => {
        const cima = larguraNo(i);
        const baixo = larguraNo(i + 1);
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        const taxa = anterior && anterior > 0 ? (e.valor / anterior) * 100 : null;

        return (
          <div key={e.nome} className="relative" style={{ height: alturaBanda }}>
            <div
              className="flex h-full w-full items-center justify-center px-4"
              style={{
                background: cor,
                opacity: 1 - i * 0.16,
                clipPath: `polygon(${(100 - cima) / 2}% 0%, ${(100 + cima) / 2}% 0%, ${(100 + baixo) / 2}% 100%, ${(100 - baixo) / 2}% 100%)`,
              }}
            >
              <span className="truncate text-[length:var(--fs-corpo-2)] font-semibold uppercase tracking-[0.06em] text-[#0b0b0b]">
                {e.nome}
              </span>
            </div>

            {taxa !== null && (
              <span className="tabular absolute right-1 top-1/2 -translate-y-1/2 text-[length:var(--fs-md)] font-bold text-[var(--ink-2)]">
                {dec(taxa)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
