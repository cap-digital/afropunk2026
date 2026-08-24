"use client";

import { useMemo, useState } from "react";
import { AreaGrafico, Cartao } from "./ui";
import { AreaTempo, type Formato, type PontoGrafico, type SerieTempo } from "./charts";
import { agregarPorSemana } from "@/lib/semanas";

type Granularidade = "dia" | "semana";

const OPCOES: { valor: Granularidade; rotulo: string }[] = [
  { valor: "dia", rotulo: "Diário" },
  { valor: "semana", rotulo: "Semanal" },
];

/**
 * Cartão de série temporal com alternância diário / semanal no cabeçalho.
 *
 * O estado é local e some no refresh: granularidade é modo de leitura, não
 * recorte de dado, e por isso não vai para a URL como o período. A agregação
 * acontece no cliente sobre a série diária que a página já carregou — nada de
 * chamada nova, e a semana é calendário (seg–dom), ver `lib/semanas.ts`.
 *
 * É componente de cliente porque o alternador e o gráfico precisam do mesmo
 * estado, e o cartão que os abriga é quem os junta — por isso ele monta o
 * `Cartao` inteiro em vez de só o corpo. Serve a qualquer escopo: a página do
 * overview é uma só para as praças e para o comparativo.
 */
export function CartaoSerieTempo({
  titulo,
  sub,
  dados,
  series,
  formato = "brl",
  empilhar = false,
  className = "",
}: {
  titulo: Record<Granularidade, string>;
  sub?: Partial<Record<Granularidade, string>>;
  dados: PontoGrafico[];
  series: SerieTempo[];
  formato?: Formato;
  empilhar?: boolean;
  className?: string;
}) {
  const [gran, setGran] = useState<Granularidade>("dia");
  const semanal = useMemo(
    () => agregarPorSemana(dados, series.map((s) => s.chave)),
    [dados, series],
  );
  const semana = gran === "semana";

  return (
    <Cartao
      className={className}
      titulo={titulo[gran]}
      sub={sub?.[gran]}
      acao={<Alternador valor={gran} aoMudar={setGran} />}
    >
      <AreaGrafico>
        <AreaTempo
          dados={semana ? semanal.pontos : dados}
          series={series}
          formato={formato}
          empilhar={empilhar}
          rotuloData={semana ? (iso) => semanal.rotulos.get(iso) ?? iso : undefined}
        />
      </AreaGrafico>
    </Cartao>
  );
}

/**
 * Segmentado de dois estados. Mesma métrica dos botões do filtro de período
 * (corpo micro, caixa alta, raio 8px): é cromo, então preto e branco — o
 * selecionado é tinta cheia, o outro é contorno.
 */
function Alternador({
  valor,
  aoMudar,
}: {
  valor: Granularidade;
  aoMudar: (g: Granularidade) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Granularidade do eixo de tempo"
      className="flex overflow-hidden rounded-lg border border-[var(--border-forte)]"
    >
      {OPCOES.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => aoMudar(o.valor)}
            className={`px-2 py-[0.28rem] text-[var(--fs-micro)] font-semibold uppercase tracking-[0.06em] transition-colors ${
              ativo
                ? "bg-[var(--ink)] text-black"
                : "text-[var(--ink-2)] hover:text-[var(--ink)]"
            }`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
