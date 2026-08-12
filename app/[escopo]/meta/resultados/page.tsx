import { notFound } from "next/navigation";
import { ErroMeta, Shell, subtituloEscopo, Linha, Pagina } from "@/components/Shell";
import { Cartao, Hero, Secao, Stat, Vazio } from "@/components/ui";
import { BarrasH, LinhasTempo, type PontoGrafico, type SerieTempo } from "@/components/charts";
import { carregarConjuntos, carregarEscopo } from "@/lib/dados";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { explicarErroMeta, MetaError, REVALIDATE } from "@/lib/meta";
import { ehEscopoValido, ESCOPOS, nomeCurtoCampanha, type EscopoSlug } from "@/lib/config";
import { brl, dec, diaMesCurto, int } from "@/lib/format";

export const revalidate = REVALIDATE;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

export default async function MetaResultados({
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
        <Shell escopo={escopo} titulo="Meta Ads · Resultados" sub={subtituloEscopo(escopo, undefined, periodo)}>
          <div className="cartao h-[600px]">
            <Vazio
              titulo="Sem resultados registrados"
              descricao="Receita, ROAS, compras e CPA aparecem aqui assim que a primeira campanha de conversão começar a converter."
            />
          </div>
        </Shell>
      );
    }

    const conjuntos = await carregarConjuntos(d);
    const t = d.total;
    const cor = d.praca?.cor ?? "var(--todas)";

    // Evolução diária de ROAS e receita. ROAS do dia = receita do dia / gasto do dia.
    const serieRoas: PontoGrafico[] = d.serie.map((p) => ({
      date: p.date,
      // Só o gasto de conversão no denominador — o de Alcance não busca venda.
      roas: p.spendConversao > 0 ? Number((p.receitaConversao / p.spendConversao).toFixed(2)) : 0,
    }));
    const serieReceita: PontoGrafico[] = d.serie.map((p) => ({
      date: p.date,
      receita: p.purchaseValue,
      investimento: p.spend,
    }));

    // Só conjuntos que registraram receita — o resto polui a leitura de vendas.
    const conjuntosComReceita = [...conjuntos]
      .filter((c) => c.m.purchaseValue > 0)
      .sort((a, b) => b.m.purchaseValue - a.m.purchaseValue);

    const receitaPorConjunto: PontoGrafico[] = conjuntosComReceita.slice(0, 7).map((c) => ({
      nome: c.nome.length > 26 ? `${c.nome.slice(0, 25)}…` : c.nome,
      valor: c.m.purchaseValue,
      cor: c.bucket?.cor ?? cor,
    }));


    const ticketMedio = t.purchases > 0 ? t.purchaseValue / t.purchases : 0;
    const lucroBruto = t.purchaseValue - t.spend;

    const seriesRoas: SerieTempo[] = [{ chave: "roas", nome: "ROAS", cor }];
    const seriesReceita: SerieTempo[] = [
      { chave: "receita", nome: "Receita", cor: "var(--par-a)" },
      { chave: "investimento", nome: "Investimento", cor: "var(--par-b)" },
    ];

    return (
      <Shell
        escopo={escopo}
        titulo="Meta Ads · Resultados"
        sub={subtituloEscopo(
          escopo,
          d.primeiroDia && d.ultimoDia
            ? `${diaMesCurto(d.primeiroDia)} – ${diaMesCurto(d.ultimoDia)}`
            : "sem dados",
        )}
      >
        <Pagina>
          <Secao>Retorno</Secao>

          <div className="cartao grid grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(250px,1.1fr)_repeat(5,1fr)] lg:gap-5 lg:px-5">
            <Hero
              rotulo="Receita atribuída"
              valor={brl(t.purchaseValue)}
              sub={`${int(t.purchases)} compras · ${brl(t.receitaConversao)} em conversão`}
            />
            <Stat
              rotulo="Investimento total"
              valor={brl(t.spend)}
              sub={`${brl(t.spendConversao)} em conversão`}
            />
            <Stat
              rotulo="ROAS"
              valor={t.roas > 0 ? `${dec(t.roas)}×` : "—"}
              sub={t.roas > 0 ? "sobre o investimento em conversão" : "sem receita"}
            />
            <Stat
              rotulo="CPA"
              valor={t.purchasesConversao > 0 ? brl(t.cpa) : "—"}
              sub={t.purchasesConversao > 0 ? "só campanhas de conversão" : "sem compra"}
            />
            <Stat rotulo="Ticket médio" valor={t.purchases > 0 ? brl(ticketMedio) : "—"} />
            <Stat
              rotulo="Resultado bruto"
              valor={brl(lucroBruto)}
              sub={lucroBruto >= 0 ? "receita acima do investido" : "ainda abaixo do investido"}
            />
          </div>

          <Secao>Evolução</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Cartao
              titulo="Evolução do ROAS"
              sub="Receita do dia ÷ investimento em conversão do dia"
            >
              <div className="h-[var(--h-grafico)]">
                <LinhasTempo dados={serieRoas} series={seriesRoas} formato="roas" />
              </div>
            </Cartao>

            <Cartao
              titulo="Receita × investimento por dia"
              sub="Mesma unidade (R$), então cabem no mesmo eixo"
            >
              <div className="h-[var(--h-grafico)]">
                <LinhasTempo dados={serieReceita} series={seriesReceita} formato="brl" />
              </div>
            </Cartao>
          </Linha>

          <Secao>Onde a receita nasce</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.25fr_1fr]">
            <Cartao
              titulo="Receita por conjunto de anúncios"
              sub={
                conjuntosComReceita.length > 0
                  ? `${conjuntosComReceita.length} conjunto${conjuntosComReceita.length > 1 ? "s" : ""} com venda registrada`
                  : "nenhum conjunto registrou venda no período"
              }
            >
              <div className="h-[var(--h-grafico)]">
                {receitaPorConjunto.length > 0 ? (
                  <BarrasH dados={receitaPorConjunto} formato="brl" larguraRotulo={186} />
                ) : (
                  <Vazio
                    titulo="Sem receita por conjunto"
                    descricao="As campanhas de alcance não geram venda direta. Quando as de conversão registrarem compras, a divisão por conjunto aparece aqui."
                  />
                )}
              </div>
            </Cartao>

            <Cartao
              titulo="Detalhamento por conjunto"
              sub="Ordenado por receita · ROAS em verde quando passa de 1×"
            >
              <div className="max-h-[var(--h-tabela)] overflow-auto">
              <table className="w-full" style={{ fontSize: "var(--fs-corpo)" }}>
                <thead className="sticky top-0 bg-[var(--surface)]">
                  <tr className="text-left uppercase tracking-[0.1em] text-[var(--ink-muted)] [font-size:var(--fs-micro)]">
                    <th className="pb-2 pr-3 font-semibold">Conjunto</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Investido</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Receita</th>
                    <th className="pb-2 pr-3 text-right font-semibold">ROAS</th>
                    <th className="pb-2 text-right font-semibold">Compras</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {[...conjuntos]
                    .sort((a, b) => b.m.purchaseValue - a.m.purchaseValue || b.m.spend - a.m.spend)
                    .map((c) => (
                      <tr key={c.id} className="border-t border-[var(--border)] text-[var(--ink-2)]">
                        <td
                          className="max-w-[220px] truncate py-2 pr-3 font-medium text-[var(--ink)]"
                          title={`${c.nome} — ${nomeCurtoCampanha(d.campanhas.find((k) => k.id === c.campanhaId)?.name ?? "")}`}
                        >
                          {c.nome}
                        </td>
                        <td className="py-2 pr-3 text-right">{brl(c.m.spend)}</td>
                        <td className="py-2 pr-3 text-right font-semibold text-[var(--ink)]">
                          {c.m.purchaseValue > 0 ? brl(c.m.purchaseValue) : "—"}
                        </td>
                        <td
                          className="py-2 pr-3 text-right font-semibold"
                          style={{ color: c.m.roas >= 1 ? "var(--good)" : "var(--ink-2)" }}
                        >
                          {c.m.roas > 0 ? `${dec(c.m.roas)}×` : "—"}
                        </td>
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
      <Shell escopo={escopo} titulo="Meta Ads · Resultados" sub={subtituloEscopo(escopo, undefined, periodo)}>
        <ErroMeta titulo="Falha ao carregar a Marketing API" detalhe={msg} />
      </Shell>
    );
  }
}
