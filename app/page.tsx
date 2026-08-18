import Link from "next/link";
import { Losangos } from "@/components/Marca";
import { MarcaAnimada } from "@/components/MarcaAnimada";
import { Sparkline } from "@/components/charts";
import { carregarEscopo, type FatiaBucket } from "@/lib/dados";
import { carregarAds, tentarAds, type DadosAds } from "@/lib/ads";
import { explicarErroMeta, MetaError, REVALIDATE } from "@/lib/meta";
import { brl, brlCompact, compact, dec, pct } from "@/lib/format";
import { ESCOPO_TODAS, NACIONAL, PRACAS } from "@/lib/config";
import { carregarVisaoGeralGA4, type TotaisSite } from "@/lib/analytics";
import type { PontoGrafico } from "@/components/charts";

export const revalidate = REVALIDATE;

/**
 * Números consolidados de uma praça — Meta + Google no mesmo card.
 *
 * A capa leva para a Overview, que soma os dois canais: se o card mostrasse só
 * o Meta, o investimento mudaria de valor ao clicar. ROAS e CPA saem do recorte
 * de conversão dos dois lados (no Google, todas as campanhas ativas são de
 * venda, então o gasto entra inteiro).
 */
interface ResumoPraca {
  investimento: number;
  roas: number;
  cpa: number;
  investimentoConversao: number;
  campanhas: number;
  serie: PontoGrafico[];
  ativa: boolean;
  /** Alguma campanha REALMENTE no ar hoje — o ponto verde depende disto. */
  emVeiculacao: boolean;
}

function consolidar(f: FatiaBucket | null, ads: DadosAds | null, slug: string): ResumoPraca {
  const g = ads?.fatias.find((x) => x.bucket.slug === slug) ?? null;
  const investimento = (f?.total.spend ?? 0) + (g?.total.custo ?? 0);
  const invConv = (f?.total.spendConversao ?? 0) + (g?.total.custo ?? 0);
  const receita = (f?.total.receitaConversao ?? 0) + (g?.total.receita ?? 0);
  const compras = (f?.total.purchasesConversao ?? 0) + (g?.total.conversoes ?? 0);

  // Série do Meta somada ao custo diário do Google daquela praça.
  const custoAdsPorDia = new Map(
    (ads?.serie ?? []).map((p) => [p.date, Number(p[`custo_${slug}`] ?? 0)] as const),
  );
  const datas = [
    ...new Set([...(f?.serie ?? []).map((p) => p.date), ...custoAdsPorDia.keys()]),
  ].sort();
  const spendMeta = new Map((f?.serie ?? []).map((p) => [p.date, p.spend] as const));
  const serie: PontoGrafico[] = datas.map((date) => ({
    date,
    spend: (spendMeta.get(date) ?? 0) + (custoAdsPorDia.get(date) ?? 0),
  }));

  return {
    investimento,
    roas: invConv > 0 ? receita / invConv : 0,
    cpa: compras > 0 ? invConv / compras : 0,
    investimentoConversao: invConv,
    campanhas: (f?.campanhas.length ?? 0) + (g?.campanhas.length ?? 0),
    serie,
    ativa: (f?.ativa ?? false) || (g?.ativa ?? false),
    emVeiculacao: (f?.campanhas ?? []).some((c) => c.effective_status === "ACTIVE"),
  };
}

export default async function Capa() {
  let dados: Awaited<ReturnType<typeof carregarEscopo>> | null = null;
  let erro: string | null = null;
  try {
    dados = await carregarEscopo(ESCOPO_TODAS);
  } catch (e) {
    erro = e instanceof MetaError ? explicarErroMeta(e) : (e as Error).message;
  }

  // Google e GA4 são opcionais na capa: se a credencial falhar, os cards de
  // praça continuam com o Meta. Mas a falha é dita — sem isso, o investimento
  // aparece menor do que é e ninguém sabe que está faltando metade da conta.
  const google = await tentarAds(carregarAds(ESCOPO_TODAS, "maximum"));
  const ads = google.dados;

  let ga4: TotaisSite | null = null;
  try {
    ga4 = (await carregarVisaoGeralGA4("maximum")).totais;
  } catch {
    ga4 = null;
  }

  const fatia = (slug: string) => dados?.fatias.find((f) => f.bucket.slug === slug) ?? null;
  const nacional = fatia(NACIONAL.slug);

  const totalInvestimento = (dados?.total.spend ?? 0) + (ads?.total.custo ?? 0);
  const totalReceita = (dados?.total.purchaseValue ?? 0) + (ads?.total.receita ?? 0);
  const totalInvConversao = (dados?.total.spendConversao ?? 0) + (ads?.total.custo ?? 0);
  const totalReceitaConversao = (dados?.total.receitaConversao ?? 0) + (ads?.total.receita ?? 0);
  const totalRoas = totalInvConversao > 0 ? totalReceitaConversao / totalInvConversao : 0;

  return (
    /*
     * Capa em duas zonas: marca no alto, seleção ocupando o resto.
     *
     * Já foi `justify-between` nos três filhos diretos — cada bloco se espalhava
     * por conta e os vãos saíam irregulares. Depois virou `justify-center` com
     * gap fixo, e aí a capa inteira passou a flutuar no meio da tela, com o
     * mesmo tanto de preto acima da marca e abaixo da assinatura.
     *
     * O cabeçalho é ÂNCORA (`shrink-0`, no topo) e a zona de baixo cresce:
     * ela toma toda a folga e centraliza a seleção dentro do que sobra. Com a
     * assinatura removida do pé, sobrou só um par — marca em cima, escolha
     * centrada no resto —, e a distância entre as duas se resolve sozinha em
     * qualquer altura de janela.
     */
    <main className="flex min-h-screen flex-col items-center overflow-hidden bg-[var(--bg)] px-8 py-[5vh]">
      <header className="flex shrink-0 flex-col items-center gap-3">
        <MarcaAnimada />
        <Losangos qtd={9} cor="var(--surface-3)" />
        <p className="surgir text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.32em] text-[var(--ink-muted)] [animation-delay:2.4s]">
          Dashboard de mídia · Selecione a praça
        </p>
      </header>

      {/* Zona do meio: é ela que cresce, e é dentro dela que a seleção
          centraliza. Os avisos de falha entram aqui junto com os cartões —
          são contexto da escolha, não do cabeçalho. */}
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 py-[4vh]">
        {google.erro && (
          <div className="cartao max-w-[76ch] px-4 py-3 text-center">
            <p className="text-[var(--fs-corpo-2)] font-semibold text-[var(--warning)]">
              Google Ads fora: os números abaixo trazem só o Meta
            </p>
            <p className="mt-1 text-[var(--fs-corpo-2)] leading-relaxed text-[var(--ink-2)]">{google.erro}</p>
          </div>
        )}

        {erro && (
          <div className="cartao max-w-[70ch] p-4 text-center">
            <p className="text-[var(--fs-corpo-2)] font-semibold text-[var(--critical)]">
              Não foi possível carregar os dados do Meta
            </p>
            <p className="mt-1.5 text-[var(--fs-corpo-2)] leading-relaxed text-[var(--ink-2)]">{erro}</p>
          </div>
        )}

        <div className="flex w-full max-w-[1120px] shrink-0 flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            {PRACAS.map((p) => (
              <CartaoPraca
                key={p.slug}
                slug={p.slug}
                nome={p.nome}
                marca={p.marca}
                local={p.local}
                cor={p.cor}
                r={consolidar(fatia(p.slug), ads, p.slug)}
              />
            ))}
          </div>

          {/* Botão para o comparativo consolidado */}
          <Link
            href={`/${ESCOPO_TODAS}`}
            className="group flex items-center gap-5 rounded-[6px] border-2 border-[var(--ink)] bg-[var(--ink)] px-5 py-4 text-black transition-colors hover:bg-[var(--ink-2)] hover:border-[var(--ink-2)]"
          >
            <Losangos qtd={4} cor="#000000" />
            <div className="min-w-0 flex-1">
              <h3 className="marca text-[var(--fs-lg)] leading-none">Ver todas as praças juntas</h3>
              <p className="mt-1.5 text-[var(--fs-corpo-2)] font-medium opacity-70">
                Meta e Google somados — Rio, Recife, Salvador e a campanha nacional
              </p>
            </div>
            {nacional && dados && (
              <div className="flex items-center gap-7">
                <MiniStat rotulo="Investido" valor={brl(totalInvestimento)} />
                <MiniStat rotulo="Receita" valor={brl(totalReceita)} />
                <MiniStat
                  rotulo="ROAS"
                  valor={totalRoas > 0 ? `${dec(totalRoas)}\u00d7` : "\u2014"}
                  nota={
                    totalInvConversao > 0 ? `sobre ${brlCompact(totalInvConversao)}` : undefined
                  }
                />
              </div>
            )}
            <span className="text-[var(--fs-lg)] leading-none transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>

          {/*
            GA4 fica fora do escopo de praça: o site é uma página só com checkout
            comum aos três eventos, então sessões e canais não se dividem por
            cidade — só a receita, via itens de e-commerce.
          */}
          <Link
            href="/analytics"
            className="cartao group flex items-center gap-5 px-5 py-4 transition-colors hover:border-[var(--border-forte)] hover:bg-[var(--surface-2)]"
          >
            <Losangos qtd={4} cor="var(--seq-3)" />
            <div className="min-w-0 flex-1">
              <h3 className="marca text-[var(--fs-kpi)] leading-none">Analytics do site</h3>
              <p className="mt-1.5 text-[var(--fs-corpo-2)] text-[var(--ink-muted)]">
                Google Analytics · tráfego, funil de venda e receita por evento
              </p>
            </div>
            {ga4 && (
              <div className="hidden items-center gap-7 sm:flex">
                <MiniStat rotulo="Sessões" valor={compact(ga4.sessoes)} />
                <MiniStat rotulo="Receita" valor={brl(ga4.receita)} />
                <MiniStat rotulo="Conversão" valor={pct(ga4.taxaConversao * 100, 2)} />
              </div>
            )}
            <span className="text-[var(--fs-kpi)] leading-none text-[var(--ink-muted)] transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>

    </main>
  );
}

function MiniStat({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-end">
      <span className="text-[var(--fs-rotulo)] font-semibold uppercase tracking-[0.08em] opacity-60">
        {rotulo}
      </span>
      <span
        className="tabular mt-0.5 truncate font-bold leading-none"
        style={{ fontSize: "var(--fs-kpi-sm)" }}
        title={valor}
      >
        {valor}
      </span>
      {nota && <span className="tabular mt-0.5 text-[var(--fs-micro)] opacity-50">{nota}</span>}
    </div>
  );
}

function CartaoPraca({
  slug,
  nome,
  marca,
  local,
  cor,
  r,
}: {
  slug: string;
  nome: string;
  marca: string;
  local: string;
  cor: string;
  r: ResumoPraca;
}) {
  return (
    <Link
      href={`/${slug}`}
      className="cartao group relative flex flex-col overflow-hidden transition-all hover:border-[var(--border-forte)] hover:bg-[var(--surface-2)]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: cor }}
      />

      <div className="flex flex-col gap-3 p-4 pt-5">
        <div className="min-w-0">
          {/* Rótulo neutro: na capa, a cor da praça fica só no filete do topo
              — que é a chave de legenda do sistema inteiro — e no sparkline,
              que é gráfico. O resto do cartão é cromo. */}
          <p className="text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
            {marca}
          </p>
          <h3 className="marca mt-1.5 text-[var(--fs-display)] leading-[0.9]">{nome}</h3>
          <p className="mt-2 text-[var(--fs-corpo-2)] text-[var(--ink-muted)]">{local}</p>
        </div>

        <div className="h-px w-full bg-[var(--border)]" />

        {r.ativa ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <MiniStatEsq rotulo="Investido" valor={brlCompact(r.investimento)} />
              <MiniStatEsq
                rotulo="ROAS"
                valor={r.roas > 0 ? `${dec(r.roas)}×` : "—"}
                destaque={r.roas >= 1}
              />
              <MiniStatEsq rotulo="CPA" valor={r.cpa > 0 ? brlCompact(r.cpa) : "—"} />
            </div>
            {r.investimentoConversao > 0 && (
              <p className="tabular -mt-1 text-[var(--fs-rotulo)] leading-tight text-[var(--ink-muted)]">
                ROAS e CPA sobre {brlCompact(r.investimentoConversao)} em conversão
              </p>
            )}
            {/* `altura="100%"`: com 38px fixos o gráfico não acompanhava a
                caixa, que agora é em rem — em zoom a caixa encolhia, ele não,
                e estourava o cartão em 3px. */}
            <div className="-mx-1 h-[2.375rem]">
              <Sparkline dados={r.serie} chave="spend" cor={cor} altura="100%" />
            </div>
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="block h-1.5 w-1.5 rounded-full"
                style={{ background: r.emVeiculacao ? "var(--good)" : "var(--ink-muted)" }}
              />
              {/* "ativas" saiu do texto: desde que campanha pausada passou a
                  contar, uma praça pode ter quatro campanhas na edição e
                  nenhuma no ar — era o caso do Rio no dia seguinte ao evento.
                  O ponto verde agora depende de veiculação de verdade. */}
              <span
                className="text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.08em]"
                style={{ color: r.emVeiculacao ? "var(--good)" : "var(--ink-muted)" }}
              >
                {r.campanhas} campanha{r.campanhas > 1 ? "s" : ""}
                {r.emVeiculacao ? " no ar" : " · encerrada" + (r.campanhas > 1 ? "s" : "")}
              </span>
            </div>
          </>
        ) : (
          <div className="flex min-h-[7.375rem] flex-col justify-center gap-2">
            <p className="marca text-[var(--fs-kpi)] text-[var(--ink-2)]">Sem Campanha Ativa</p>
            <p className="text-[var(--fs-corpo-2)] leading-relaxed text-[var(--ink-muted)]">
              O painel já está montado esperando a Campanha de {nome} entrar no ar
            </p>
            <span className="mt-1 inline-flex w-fit items-center rounded-[3px] border border-[var(--border-forte)] px-2 py-1 text-[var(--fs-corpo)] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
              Em breve
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function MiniStatEsq({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="rotulo truncate">{rotulo}</span>
      <span
        className="tabular mt-0.5 truncate font-bold leading-none"
        style={{
          fontSize: "var(--fs-kpi-sm)",
          ...(destaque ? { color: "var(--good)" } : {}),
        }}
        title={valor}
      >
        {valor}
      </span>
    </div>
  );
}
