import { notFound } from "next/navigation";
import { AreaGrafico, ErroMeta, Etiqueta, Shell, subtituloEscopo, Linha, Pagina } from "@/components/Shell";
import { Cartao, Stat, StatusAtivo, Vazio } from "@/components/ui";
import {
  BarrasAgrupadas,
  LinhasTempo,
  Medidor,
  type PontoGrafico,
  type SerieTempo,
} from "@/components/charts";
import { carregarEscopo } from "@/lib/dados";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { explicarErroMeta, getSerieDiaria, MetaError, REVALIDATE } from "@/lib/meta";
import {
  ehEscopoValido,
  ESCOPOS,
  nomeCurtoCampanha,
  OBJETIVO_LABEL,
  type EscopoSlug,
} from "@/lib/config";
import { brl, brlCompact, dec, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

/** Cores por campanha. Os dois primeiros slots são o par binário validado. */
const TONS = ["var(--par-a)", "var(--par-b)", "var(--seq-4)", "var(--seq-2)"];

export default async function MetaCampanhas({
  params,
  searchParams,
}: {
  params: { escopo: string };
  searchParams: ParamsBusca;
}) {
  if (!ehEscopoValido(params.escopo)) notFound();
  const escopo = params.escopo as EscopoSlug;
  const periodo = periodoDeParams(searchParams);

  try {
    const d = await carregarEscopo(escopo, periodo);

    if (!d.ativo) {
      return (
        <Shell escopo={escopo} titulo="Meta Ads · Campanhas" sub={subtituloEscopo(escopo, undefined, periodo)}>
          <div className="cartao min-h-[26rem] flex-1 lg:h-full">
            <Vazio
              titulo="Nenhuma campanha ativa"
              descricao="Assim que uma campanha entrar em veiculação, ela aparece aqui com investimento, entrega, orçamento e série diária."
            />
          </div>
        </Shell>
      );
    }

    const series = await getSerieDiaria(d.campanhas.map((c) => c.id), periodo);

    // No comparativo a cor segue a praça (identidade); na praça única, o objetivo.
    const corDa = (i: number, slugBucket: string | undefined) =>
      d.comparativo
        ? (d.fatias.find((f) => f.bucket.slug === slugBucket)?.bucket.cor ?? "var(--seq-2)")
        : TONS[i % TONS.length];

    const dias = [
      ...new Set(d.campanhas.flatMap((c) => (series.get(c.id) ?? []).map((s) => s.date))),
    ].sort();
    const serieCampanhas: PontoGrafico[] = dias.map((dia) => {
      const linha: PontoGrafico = { date: dia };
      for (const c of d.campanhas) {
        linha[c.id] = (series.get(c.id) ?? []).find((s) => s.date === dia)?.spend ?? 0;
      }
      return linha;
    });
    const seriesCfg: SerieTempo[] = d.campanhas.map((c, i) => ({
      chave: c.id,
      nome: d.comparativo
        ? `${OBJETIVO_LABEL[c.objective] ?? c.objective} · ${c.bucket?.nome ?? "—"}`
        : (OBJETIVO_LABEL[c.objective] ?? c.objective),
      cor: corDa(i, c.bucket?.slug),
    }));

    const comparativo: PontoGrafico[] = d.campanhas.map((c) => ({
      nome: d.comparativo
        ? `${c.bucket?.nome ?? "—"}`
        : (OBJETIVO_LABEL[c.objective] ?? c.objective),
      investimento: c.m.spend,
      cliques: c.m.clicks,
    }));

    return (
      <Shell
        escopo={escopo}
        titulo="Meta Ads · Campanhas"
        sub={subtituloEscopo(escopo, `${d.campanhas.length} ativas`)}
      >
        <Pagina>
          {/* Cartões por campanha */}
          <div
            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
              d.campanhas.length >= 5
                ? "lg:grid-cols-5"
                : d.campanhas.length === 4
                  ? "lg:grid-cols-4"
                  : d.campanhas.length === 3
                    ? "lg:grid-cols-3"
                    : "lg:grid-cols-2"
            }`}
          >
            {d.campanhas.map((c, i) => {
              const orcamento = Number(c.lifetime_budget ?? 0) / 100;
              const cor = corDa(i, c.bucket?.slug);
              return (
                <div key={c.id} className="cartao flex flex-col gap-2.5 p-[var(--esp-cartao-y)]">
                  {/* Objetivo e status juntos, à esquerda — não um em cada
                      ponta. A largura do cartão depende de quantas campanhas a
                      praça tem: com duas, `justify-between` jogava o status a
                      800px do rótulo e a linha deixava de ler como um par. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Etiqueta>{OBJETIVO_LABEL[c.objective] ?? c.objective}</Etiqueta>
                    <StatusAtivo ativo={c.effective_status === "ACTIVE"} />
                  </div>
                  <p
                    className="truncate text-[var(--fs-corpo-2)] font-semibold text-[var(--ink)]"
                    title={c.name}
                  >
                    {d.comparativo ? (c.bucket?.nome ?? nomeCurtoCampanha(c.name)) : nomeCurtoCampanha(c.name)}
                  </p>
                  {/* Espalhados, não em duas colunas de grade: o número de
                      colunas do cartão vem de quantas campanhas a praça tem, e
                      com duas o par de KPIs ficava espremido na metade
                      esquerda de um cartão de 800px. Mesmo arranjo do rodapé
                      dos cartões de canal no Overview. */}
                  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                    <Stat rotulo="Investido" valor={brlCompact(c.m.spend)} tamanho="sm" />
                    <Stat rotulo="CTR" valor={pct(c.m.ctr, 1)} tamanho="sm" />
                  </div>
                  {orcamento > 0 ? (
                    <Medidor valor={c.m.spend} limite={orcamento} rotulo="Orçamento" cor={cor} />
                  ) : (
                    <p className="text-[var(--fs-corpo)] leading-tight text-[var(--ink-muted)]">
                      Orçamento no conjunto de anúncios
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <Linha preencher className="grid grid-cols-1 gap-[var(--esp-grade)] lg:grid-cols-[1.4fr_1fr]">
            <Cartao
              titulo="Investimento diário por campanha"
              sub="Compara o ritmo de gasto entre as campanhas ativas"
            >
              <AreaGrafico>
                <LinhasTempo dados={serieCampanhas} series={seriesCfg} formato="brl" />
              </AreaGrafico>
            </Cartao>

            <Cartao
              titulo="Investimento × cliques"
              sub="Duas escalas diferentes, dois gráficos — nunca eixo duplo"
            >
              <div className="grid h-[18.75rem] grid-rows-2 gap-2 lg:h-full">
                <BarrasAgrupadas
                  dados={comparativo}
                  series={[{ chave: "investimento", nome: "Investimento (R$)", cor: "var(--par-a)" }]}
                  formato="brl"
                />
                <BarrasAgrupadas
                  dados={comparativo}
                  series={[{ chave: "cliques", nome: "Cliques", cor: "var(--par-b)" }]}
                  formato="int"
                />
              </div>
            </Cartao>
          </Linha>

          {/* Tabela longa rola DENTRO do cartão, não empurra a página: com
              todas as praças juntas ela passava 319px da tela e a última linha
              ficava fora de alcance sem que nada indicasse isso. */}
          <Linha>
            <Cartao
              titulo="Detalhamento"
              sub="Todas as métricas por campanha ativa"
              className="h-full min-w-0"
            >
              <div className="max-h-[var(--h-tabela)] overflow-auto">
              <table className="w-full" style={{ fontSize: "var(--fs-corpo)" }}>
                <thead>
                  <tr className="text-left text-[var(--fs-corpo)] uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                    <th className="pb-2 pr-3 font-semibold">Campanha</th>
                    {d.comparativo && <th className="pb-2 pr-3 font-semibold">Praça</th>}
                    <th className="pb-2 pr-3 font-semibold">Objetivo</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Investido</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Impressões</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Alcance</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Freq.</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Cliques</th>
                    <th className="pb-2 pr-3 text-right font-semibold">CTR</th>
                    <th className="pb-2 pr-3 text-right font-semibold">CPC</th>
                    <th className="pb-2 pr-3 text-right font-semibold">CPM</th>
                    <th className="pb-2 text-right font-semibold">Compras</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {[...d.campanhas]
                    .sort((a, b) => b.m.spend - a.m.spend)
                    .map((c) => (
                      <tr key={c.id} className="border-t border-[var(--border)] text-[var(--ink-2)]">
                        <td
                          className="max-w-[220px] truncate py-2 pr-3 font-medium text-[var(--ink)]"
                          title={c.name}
                        >
                          {nomeCurtoCampanha(c.name)}
                        </td>
                        {d.comparativo && (
                          <td className="py-2 pr-3">
                            <span className="flex items-center gap-1.5">
                              <span
                                aria-hidden="true"
                                className="block h-2 w-2 shrink-0 rotate-45"
                                style={{ background: c.bucket?.cor ?? "var(--ink-muted)" }}
                              />
                              {c.bucket?.nome ?? "—"}
                            </span>
                          </td>
                        )}
                        <td className="py-2 pr-3">{OBJETIVO_LABEL[c.objective] ?? c.objective}</td>
                        <td className="py-2 pr-3 text-right font-semibold text-[var(--ink)]">
                          {brl(c.m.spend)}
                        </td>
                        <td className="py-2 pr-3 text-right">{int(c.m.impressions)}</td>
                        <td className="py-2 pr-3 text-right">{int(c.m.reach)}</td>
                        <td className="py-2 pr-3 text-right">{dec(c.m.frequency)}</td>
                        <td className="py-2 pr-3 text-right">{int(c.m.clicks)}</td>
                        <td className="py-2 pr-3 text-right">{pct(c.m.ctr)}</td>
                        <td className="py-2 pr-3 text-right">{brl(c.m.cpc)}</td>
                        <td className="py-2 pr-3 text-right">{brl(c.m.cpm)}</td>
                        <td className="py-2 text-right">{int(c.m.purchases)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            </Cartao>
          </Linha>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    const msg = e instanceof MetaError ? explicarErroMeta(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Meta Ads · Campanhas" sub={subtituloEscopo(escopo, undefined, periodo)}>
        <ErroMeta titulo="Falha ao carregar a Marketing API" detalhe={msg} />
      </Shell>
    );
  }
}
