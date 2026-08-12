import { ErroGA4, Linha, Pagina, ShellAnalytics } from "@/components/Shell";
import { Cartao, Hero, Secao, Stat } from "@/components/ui";
import { AreaTempo, Funil, LinhasTempo, type PontoGrafico } from "@/components/charts";
import { carregarVisaoGeralGA4 } from "@/lib/analytics";
import { explicarErroGA4, GA4Error, REVALIDATE_GA4, ROTULO_PADRAO } from "@/lib/ga4";
import { periodoDeParams, rotuloPeriodo, type ParamsBusca } from "@/lib/periodo";
import { brl, brlCompact, compact, dec, diaMesCurto, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE_GA4;

/** Minutos:segundos a partir de segundos. */
function duracao(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default async function AnalyticsVisaoGeral({
  searchParams,
}: {
  searchParams: ParamsBusca;
}) {
  const periodo = periodoDeParams(searchParams);

  try {
    const d = await carregarVisaoGeralGA4(periodo);
    const t = d.totais;

    const janela =
      d.primeiroDia && d.ultimoDia
        ? `${diaMesCurto(d.primeiroDia)} – ${diaMesCurto(d.ultimoDia)}`
        : rotuloPeriodo(periodo);

    const serieSessoes: PontoGrafico[] = d.serie.map((p) => ({
      date: p.date,
      sessoes: p.sessoes,
    }));
    const serieReceita: PontoGrafico[] = d.serie.map((p) => ({
      date: p.date,
      receita: p.receita,
      transacoes: p.transacoes,
    }));

    return (
      <ShellAnalytics
        titulo="Analytics · Visão geral"
        sub={`Site AFROPUNK · ${janela}${periodo === "maximum" ? ` · ${ROTULO_PADRAO}` : ""}`}
      >
        <Pagina>
          <Secao>Comportamento do site</Secao>

          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(250px,1.1fr)_repeat(5,1fr)] lg:gap-5 lg:px-5">
            <Hero
              rotulo="Sessões"
              valor={compact(t.sessoes)}
              sub={`${compact(t.usuarios)} usuários · ${pct(t.taxaEngajamento * 100, 1)} engajadas`}
            />
            <Stat
              rotulo="Receita"
              valor={brlCompact(t.receita)}
              sub={`${brl(t.receita)} · ${int(t.transacoes)} compras`}
            />
            <Stat
              rotulo="Conversão"
              valor={pct(t.taxaConversao * 100, 2)}
              sub="das sessões compram"
            />
            <Stat rotulo="Ticket médio" valor={brl(t.ticketMedio)} />
            <Stat
              rotulo="Novos usuários"
              valor={compact(t.novosUsuarios)}
              sub={`${pct((t.novosUsuarios / (t.usuarios || 1)) * 100, 1)} do total`}
            />
            <Stat rotulo="Duração média" valor={duracao(t.duracaoMedia)} sub="por sessão" />
          </div>

          <Secao>Ritmo</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
            <Cartao
              titulo="Sessões por dia"
              sub="Os picos coincidem com as aberturas de venda"
            >
              <div className="h-[var(--h-grafico)]">
                <AreaTempo
                  dados={serieSessoes}
                  series={[{ chave: "sessoes", nome: "Sessões", cor: "var(--seq-3)" }]}
                  formato="int"
                />
              </div>
            </Cartao>

            <Cartao
              titulo="Funil do site"
              sub="Da sessão à compra · etapas do e-commerce"
            >
              <div className="min-h-[var(--h-tabela)] flex-1 overflow-auto pr-1">
                {/* Etapa zerada fica fora: linha vazia não informa nada. */}
                <Funil etapas={d.funil.filter((e) => e.valor > 0)} cor="var(--seq-3)" />
              </div>
            </Cartao>
          </Linha>

          <Secao>Receita</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
            <Cartao
              titulo="Receita por dia"
              sub="Valor transacionado no site"
            >
              <div className="h-[var(--h-grafico)]">
                <LinhasTempo
                  dados={serieReceita}
                  series={[{ chave: "receita", nome: "Receita", cor: "var(--par-a)" }]}
                  formato="brl"
                />
              </div>
            </Cartao>

            <Cartao
              titulo="Compras por dia"
              sub="Quantidade de transações"
            >
              <div className="h-[var(--h-grafico)]">
                <AreaTempo
                  dados={serieReceita}
                  series={[{ chave: "transacoes", nome: "Compras", cor: "var(--par-b)" }]}
                  formato="int"
                />
              </div>
            </Cartao>
          </Linha>

          <p className="shrink-0 text-[var(--fs-corpo)] leading-relaxed text-[var(--ink-muted)]">
            Sessões, canais e funil são do site inteiro — o checkout é comum aos três eventos e
            não há como atribuí-los por cidade. A divisão por praça está em{" "}
            <span className="font-semibold text-[var(--ink-2)]">Vendas por evento</span>, a partir
            dos itens de e-commerce. Sem filtro, o recorte padrão é de {ROTULO_PADRAO} — a
            propriedade guarda desde 2025, incluindo a edição passada. Média de{" "}
            {dec(t.visualizacoes / (t.sessoes || 1))} visualizações por sessão.
          </p>
        </Pagina>
      </ShellAnalytics>
    );
  } catch (e) {
    const msg = e instanceof GA4Error ? explicarErroGA4(e) : (e as Error).message;
    return (
      <ShellAnalytics titulo="Analytics · Visão geral">
        <ErroGA4 titulo="Falha ao carregar a GA4 Data API" detalhe={msg} />
      </ShellAnalytics>
    );
  }
}
