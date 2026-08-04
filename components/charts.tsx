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
const TICK = { fill: "var(--ink-muted)", fontSize: 12 };
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
        <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
          {rotuloEixo ? rotuloEixo(String(label)) : label}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-[13px]">
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
        <span key={i} className="flex items-center gap-1.5 text-[12px] text-[var(--ink-2)]">
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
      <AreaChart data={dados} margin={{ top: 6, right: 8, left: 2, bottom: 0 }}>
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
          />
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
      <LineChart data={dados} margin={{ top: 6, right: 10, left: 2, bottom: 0 }}>
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
          />
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
  altura?: number;
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
  altura = "100%",
  cores,
  corUnica,
  rotularValor = true,
  larguraRotulo = 96,
}: {
  dados: PontoGrafico[];
  chaveValor?: string;
  chaveNome?: string;
  formato?: Formato;
  altura?: number | string;
  cores?: string[];
  corUnica?: string;
  rotularValor?: boolean;
  larguraRotulo?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
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
          tick={{ ...TICK, fontSize: 12.5 }}
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
              formatter={(v: number) => fmt(v, formato)}
              style={{ fill: "var(--ink-2)", fontSize: 12, fontWeight: 600 }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
      <BarChart data={dados} margin={{ top: 8, right: 6, left: 0, bottom: 0 }} barGap={3}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey={chaveNome}
          tick={{ ...TICK, fontSize: 10.5 }}
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
        {series.map((s) => (
          <Bar
            key={s.chave}
            dataKey={s.chave}
            name={s.nome}
            fill={s.cor}
            radius={[4, 4, 0, 0]}
            maxBarSize={34}
            isAnimationActive={false}
          />
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
}: {
  segmentos: { nome: string; valor: number; cor: string }[];
  formato?: Formato;
}) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0) || 1;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-7 w-full overflow-hidden rounded-[4px]">
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
              className="group relative transition-opacity hover:opacity-85"
            >
              {p > 9 && (
                <span className="absolute inset-0 flex items-center justify-center text-[11.5px] font-bold text-black/80">
                  {dec(p)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segmentos.map((s) => (
          <span key={s.nome} className="flex items-center gap-1.5 text-[12px]">
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
          tick={{ ...TICK, fontSize: 12.5 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip cursor={CURSOR_BARRA} content={dica(formato)} />
        <Legend content={legenda()} />
        <ReferenceLine x={0} stroke={EIXO} strokeWidth={1} />
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
            style: { fill: "var(--ink-muted)", fontSize: 10 },
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
                <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink)]">
                  <span
                    aria-hidden="true"
                    className="block h-2 w-2 rotate-45"
                    style={{ background: d.cor }}
                  />
                  {d.nome}
                </div>
                <div className="tabular flex flex-col gap-0.5 text-[12.5px] text-[var(--ink-2)]">
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
}: {
  linhas: string[];
  colunas: string[];
  valores: Map<string, number>;
  formato?: Formato;
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
    <div className="flex h-full flex-col gap-1.5 overflow-auto">
      <div
        className="grid gap-[2px] text-[11.5px]"
        style={{ gridTemplateColumns: `104px repeat(${colunas.length}, minmax(0,1fr))` }}
      >
        <div />
        {colunas.map((c) => (
          <div
            key={c}
            className="truncate pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]"
            title={c}
          >
            {c}
          </div>
        ))}
        {linhas.map((l) => (
          <Fragment key={l}>
            <div
              className="flex items-center truncate pr-2 text-[12px] text-[var(--ink-2)]"
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
                  className="flex h-9 items-center justify-center rounded-[3px] transition-opacity hover:opacity-80"
                >
                  <span
                    className="tabular text-[11.5px] font-semibold"
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
      <div className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-[var(--ink-muted)]">
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
}: {
  etapas: { nome: string; valor: number }[];
  cor: string;
}) {
  const topo = etapas[0]?.valor || 1;
  return (
    // justify-between: as etapas ocupam toda a altura do cartão em vez de
    // empilharem no topo e deixarem vazio embaixo em telas altas.
    <div className="flex h-full flex-col justify-between gap-2">
      {etapas.map((e, i) => {
        const larg = Math.max((e.valor / topo) * 100, 0.6);
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        const taxa = anterior && anterior > 0 ? (e.valor / anterior) * 100 : null;
        return (
          <div key={e.nome} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-[var(--ink-2)]">{e.nome}</span>
              <span className="flex items-baseline gap-2">
                {taxa !== null && (
                  <span className="tabular text-[11px] text-[var(--ink-muted)]">
                    {dec(taxa)}% vs. etapa anterior
                  </span>
                )}
                <span className="tabular text-[13px] font-bold text-[var(--ink)]">
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
      <div className="flex items-baseline justify-between">
        <span className="rotulo">{rotulo}</span>
        <span className="tabular text-[12px] text-[var(--ink-2)]">
          {fmt(valor, formato)} <span className="text-[var(--ink-muted)]">/ {fmt(limite, formato)}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: cor }} />
      </div>
      <span className="tabular text-[11px] text-[var(--ink-muted)]">{dec(p)}% consumido</span>
    </div>
  );
}
