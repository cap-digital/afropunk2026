import { ErroGA4, Linha, Pagina, ShellAnalytics } from "@/components/Shell";
import { Cartao, Hero, Secao, Stat } from "@/components/ui";
import { BarrasAgrupadas, BarrasH, EmpilhadaTotal, type PontoGrafico } from "@/components/charts";
import { FunilEventos } from "@/components/FunilEventos";
import { carregarVendasGA4 } from "@/lib/analytics";
import { explicarErroGA4, GA4Error, REVALIDATE_GA4, ROTULO_PADRAO } from "@/lib/ga4";
import { periodoDeParams, rotuloPeriodo, type ParamsBusca } from "@/lib/periodo";
import { brl, brlCompact, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE_GA4;

export default async function AnalyticsVendas({
  searchParams,
}: {
  searchParams: ParamsBusca;
}) {
  const periodo = periodoDeParams(searchParams);

  try {
    const d = await carregarVendasGA4(periodo);
    const t = d.totais;

    const receitaTotal = d.eventos.reduce((a, e) => a + e.receita, 0);
    const ingressosTotal = d.eventos.reduce((a, e) => a + e.ingressos, 0);


    const receitaBarras: PontoGrafico[] = d.eventos.map((e) => ({
      nome: e.bucket?.nome ?? e.itemName,
      valor: e.receita,
      cor: e.bucket?.cor ?? "var(--seq-2)",
    }));


    return (
      <ShellAnalytics
        titulo="Analytics · Vendas por evento"
        sub={`Itens de e-commerce · ${periodo === "maximum" ? ROTULO_PADRAO : rotuloPeriodo(periodo)}`}
      >
        <Pagina>
          <Secao>Receita do site</Secao>

          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(250px,1.1fr)_repeat(4,1fr)] lg:gap-5 lg:px-5">
            <Hero
              rotulo="Receita em ingressos"
              valor={brlCompact(receitaTotal)}
              sub={`${brl(receitaTotal)} · ${int(ingressosTotal)} ingressos`}
            />
            {d.eventos.slice(0, 3).map((e) => (
              <Stat
                key={e.itemName}
                rotulo={e.bucket?.nome ?? e.itemName}
                valor={brlCompact(e.receita)}
                sub={`${int(e.ingressos)} ingressos · ${pct((e.receita / (receitaTotal || 1)) * 100, 1)}`}
              />
            ))}
            <Stat
              rotulo="Ticket médio"
              valor={ingressosTotal > 0 ? brl(receitaTotal / ingressosTotal) : "—"}
              sub={`${int(t.transacoes)} compras no site`}
            />
          </div>

          <Secao>Comparativo entre eventos</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.25fr_1fr]">
            {/* Coluna esquerda: receita em cima, ingressos embaixo */}
            <div className="flex min-h-0 flex-col gap-3.5">
              <Cartao
                titulo="Receita por evento"
                sub="Cor identifica a praça"
               
              >
                <div className="flex h-full flex-col justify-evenly gap-4">
                  <div className="h-[58%]">
                    <BarrasH dados={receitaBarras} formato="brl" larguraRotulo={132} />
                  </div>
                  <EmpilhadaTotal
                    segmentos={d.eventos.map((e) => ({
                      nome: e.bucket?.nome ?? e.itemName,
                      valor: e.receita,
                      cor: e.bucket?.cor ?? "var(--seq-2)",
                    }))}
                    formato="brl"
                  />
                </div>
              </Cartao>

              <Cartao
                titulo="Ingressos e carrinho"
                sub="Vendidos vs. adicionados ao carrinho"
               
              >
                <div className="h-[var(--h-grafico)]">
                  <BarrasAgrupadas
                    dados={d.eventos.map((e) => ({
                      nome: e.bucket?.nome ?? e.itemName,
                      ingressos: e.ingressos,
                      carrinho: e.adicoesCarrinho,
                    }))}
                    series={[
                      { chave: "ingressos", nome: "Vendidos", cor: "var(--par-a)" },
                      { chave: "carrinho", nome: "No carrinho", cor: "var(--par-b)" },
                    ]}
                    formato="int"
                  />
                </div>
              </Cartao>
            </div>

            {/* Coluna direita: funil da praça escolhida */}
            <Cartao
              titulo="Funil de venda por praça"
              sub="Escolha o evento · começa no carrinho, o GA4 não rastreia visualização de item"
            >
              {/* `min-h` em vez de `h`: o funil tem partes de altura própria
                  (botões de praça, trapézios, legenda, rodapé) que somam mais
                  que o slot padrão em tela muito estreita — a 175% de zoom o
                  conteúdo pedia 284px num slot de 230px e o cartão cortava.
                  Deixando crescer, nada some. */}
              <div className="min-h-[var(--h-grafico)]">
                <FunilEventos
                  eventos={d.eventos.map((e) => ({
                    itemName: e.itemName,
                    nome: e.bucket?.nome ?? e.itemName,
                    cor: e.bucket?.cor ?? "var(--seq-2)",
                    adicoesCarrinho: e.adicoesCarrinho,
                    checkouts: e.checkouts,
                    ingressos: e.ingressos,
                    receita: e.receita,
                  }))}
                />
              </div>
            </Cartao>
          </Linha>

        </Pagina>
      </ShellAnalytics>
    );
  } catch (e) {
    const msg = e instanceof GA4Error ? explicarErroGA4(e) : (e as Error).message;
    return (
      <ShellAnalytics titulo="Analytics · Vendas por evento">
        <ErroGA4 titulo="Falha ao carregar a GA4 Data API" detalhe={msg} />
      </ShellAnalytics>
    );
  }
}
