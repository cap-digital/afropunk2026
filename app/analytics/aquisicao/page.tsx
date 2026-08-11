import { ErroGA4, Linha, Pagina, ShellAnalytics } from "@/components/Shell";
import { Cartao, Hero, Secao, Stat } from "@/components/ui";
import { BarrasH, EmpilhadaTotal, type PontoGrafico } from "@/components/charts";
import { carregarAquisicaoGA4, type LinhaCanal } from "@/lib/analytics";
import { explicarErroGA4, GA4Error, REVALIDATE_GA4, ROTULO_PADRAO } from "@/lib/ga4";
import { periodoDeParams, rotuloPeriodo, type ParamsBusca } from "@/lib/periodo";
import { brl, brlCompact, compact, pct } from "@/lib/format";

export const revalidate = REVALIDATE_GA4;

/** Rampa sequencial ciano; o 5º em diante cai no tom base. */
const TONS = ["var(--seq-4)", "var(--seq-3)", "var(--seq-2)", "var(--seq-1)"];
const tom = (i: number) => TONS[i] ?? "var(--seq-2)";

export default async function AnalyticsAquisicao({
  searchParams,
}: {
  searchParams: ParamsBusca;
}) {
  const periodo = periodoDeParams(searchParams);

  try {
    const d = await carregarAquisicaoGA4(periodo);
    const t = d.totais;

    // Só canais que trouxeram sessão; e receita zerada não vira barra.
    const canaisSessoes: PontoGrafico[] = d.canais.slice(0, 8).map((c, i) => ({
      nome: c.nome,
      valor: c.sessoes,
      cor: tom(i),
    }));
    const canaisReceita: PontoGrafico[] = d.canais
      .filter((c) => c.receita > 0)
      .slice(0, 8)
      .map((c) => ({ nome: c.nome, valor: c.receita }));

    // Origens vêm de UTM e chegam com o nome inteiro da campanha; sem corte
    // os rótulos quebram em várias linhas e se sobrepõem.
    const encurtar = (n: string) => (n.length > 30 ? `${n.slice(0, 29)}…` : n);
    const origens: PontoGrafico[] = d.origens
      .slice(0, 8)
      .map((o) => ({ nome: encurtar(o.nome), valor: o.sessoes }));

    // `(other)` e `(not set)` são baldes residuais do GA4 — como "melhor
    // canal" não dizem nada acionável.
    const residual = (n: string) => /^\((other|not set)\)$/i.test(n);
    const melhorConversao = [...d.canais]
      .filter((c) => c.sessoes >= 500 && c.transacoes > 0 && !residual(c.nome))
      .sort((a, b) => b.taxaConversao - a.taxaConversao)[0];

    return (
      <ShellAnalytics
        titulo="Analytics · Aquisição"
        sub={`De onde vem o tráfego · ${periodo === "maximum" ? ROTULO_PADRAO : rotuloPeriodo(periodo)}`}
      >
        <Pagina>
          <Secao>Origem do tráfego</Secao>

          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(250px,1.1fr)_repeat(4,1fr)] lg:gap-5 lg:px-5">
            <Hero
              rotulo="Sessões"
              valor={compact(t.sessoes)}
              sub={`${d.canais.length} canais com tráfego`}
            />
            <Stat
              rotulo="Canal líder"
              valor={d.canais[0]?.nome ?? "—"}
              sub={
                d.canais[0]
                  ? `${pct((d.canais[0].sessoes / (t.sessoes || 1)) * 100, 1)} das sessões`
                  : undefined
              }
            />
            <Stat
              rotulo="Melhor conversão"
              valor={melhorConversao ? melhorConversao.nome : "—"}
              sub={
                melhorConversao
                  ? `${pct(melhorConversao.taxaConversao, 2)} · mín. 500 sessões`
                  : "sem canal qualificado"
              }
            />
            <Stat rotulo="Receita" valor={brlCompact(t.receita)} sub={brl(t.receita)} />
            <Stat
              rotulo="Mobile"
              valor={pct(
                ((d.dispositivos.find((x) => x.nome === "mobile")?.sessoes ?? 0) /
                  (t.sessoes || 1)) *
                  100,
                1,
              )}
              sub="das sessões"
            />
          </div>

          <Secao>Canais</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Cartao
              titulo="Sessões por canal"
              sub="Agrupamento padrão do GA4"
              className="h-full"
            >
              <div className="h-[230px] lg:h-full">
                <BarrasH dados={canaisSessoes} formato="int" larguraRotulo={132} />
              </div>
            </Cartao>

            <Cartao
              titulo="Receita por canal"
              sub="Só canais que geraram venda"
              className="h-full"
            >
              <div className="h-[230px] lg:h-full">
                {canaisReceita.length > 0 ? (
                  <BarrasH
                    dados={canaisReceita}
                    formato="brl"
                    corUnica="var(--par-a)"
                    larguraRotulo={132}
                  />
                ) : (
                  <p className="pt-8 text-center text-[12px] text-[var(--ink-muted)]">
                    Nenhum canal registrou receita neste recorte.
                  </p>
                )}
              </div>
            </Cartao>
          </Linha>

          <Secao>Origens e dispositivos</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.3fr_1fr]">
            <Cartao
              titulo="Origem e mídia"
              sub="A fonte exata, antes do agrupamento em canais"
              className="h-full"
            >
              <div className="h-[230px] lg:h-full">
                <BarrasH
                  dados={origens}
                  formato="int"
                  corUnica="var(--seq-2)"
                  larguraRotulo={170}
                />
              </div>
            </Cartao>

            <Cartao
              titulo="Dispositivos"
              sub="Onde o público navega"
              className="h-full"
            >
              <div className="flex h-full flex-col justify-evenly gap-5">
                <EmpilhadaTotal
                  segmentos={d.dispositivos.slice(0, 3).map((x, i) => ({
                    nome: x.nome,
                    valor: x.sessoes,
                    cor: tom(i),
                  }))}
                  formato="int"
                />
                <div className="flex flex-col gap-2.5">
                  {d.dispositivos
                    .filter((x) => x.transacoes > 0)
                    .slice(0, 4)
                    .map((x) => (
                      <div key={x.nome} className="flex items-center justify-between gap-3">
                        <span className="text-[12px] text-[var(--ink-2)]">{x.nome}</span>
                        <span className="tabular text-[12px] text-[var(--ink-muted)]">
                          {compact(x.transacoes)} compras ·{" "}
                          <span className="font-bold text-[var(--ink)]">
                            {pct(x.taxaConversao, 2)}
                          </span>
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </Cartao>
          </Linha>
        </Pagina>
      </ShellAnalytics>
    );
  } catch (e) {
    const msg = e instanceof GA4Error ? explicarErroGA4(e) : (e as Error).message;
    return (
      <ShellAnalytics titulo="Analytics · Aquisição">
        <ErroGA4 titulo="Falha ao carregar a GA4 Data API" detalhe={msg} />
      </ShellAnalytics>
    );
  }
}

export type { LinhaCanal };
