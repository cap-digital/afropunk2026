import Link from "next/link";
import { notFound } from "next/navigation";
import { ErroMeta, Linha, Pagina, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao, Etiqueta, Hero, Secao, Stat } from "@/components/ui";
import { AreaTempo, EmpilhadaTotal, type PontoGrafico } from "@/components/charts";
import { carregarEscopo } from "@/lib/dados";
import { carregarAds, METRICAS_ADS_ZERO, tentarAds } from "@/lib/ads";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { explicarErroMeta, MetaError, REVALIDATE } from "@/lib/meta";
import { ehEscopoValido, ESCOPOS, type EscopoSlug } from "@/lib/config";
import { brl, brlCompact, compact, dec, diaMesCurto, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

/**
 * Recorte comum aos dois canais. O Meta e o Google têm dicionários diferentes
 * (purchases × conversions, purchaseValue × conversions_value); aqui cada um é
 * traduzido uma vez para que o consolidado some maçã com maçã.
 *
 * `investimentoConversao` é o denominador honesto de ROAS/CPA: no Meta só o
 * gasto das campanhas de venda entra; no Google, as três campanhas ativas são
 * de conversão, então o gasto entra inteiro.
 */
interface Canal {
  slug: string;
  nome: string;
  cor: string;
  href: string;
  conectado: boolean;
  investimento: number;
  receita: number;
  conversoes: number;
  cliques: number;
  impressoes: number;
  roas: number;
  /** Recorte de conversão — numerador e denominador do ROAS consolidado. */
  investimentoConversao: number;
  receitaConversao: number;
  conversoesConversao: number;
}

export default async function VisaoGeralGlobal({
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
    // O Google não pode derrubar a página, mas também não pode sumir em
    // silêncio: falha de leitura vira aviso, não "praça sem campanha".
    const [d, leitura] = await Promise.all([
      carregarEscopo(escopo, periodo),
      tentarAds(carregarAds(escopo, periodo)),
    ]);

    const ads = leitura.dados;
    const googleIndisponivel = leitura.erro !== null;
    const g = ads?.total ?? METRICAS_ADS_ZERO;
    const googleAtivo = Boolean(ads?.ativo);

    const canais: Canal[] = [
      {
        slug: "meta",
        nome: "Meta Ads",
        cor: "var(--par-a)",
        href: `/${escopo}/meta`,
        conectado: d.ativo,
        investimento: d.total.spend,
        receita: d.total.purchaseValue,
        conversoes: d.total.purchases,
        cliques: d.total.clicks,
        impressoes: d.total.impressions,
        roas: d.total.roas,
        investimentoConversao: d.total.spendConversao,
        receitaConversao: d.total.receitaConversao,
        conversoesConversao: d.total.purchasesConversao,
      },
      {
        slug: "google",
        nome: "Google Ads",
        cor: "var(--par-b)",
        href: `/${escopo}/google`,
        conectado: googleAtivo,
        investimento: g.custo,
        receita: g.receita,
        conversoes: g.conversoes,
        cliques: g.cliques,
        impressoes: g.impressoes,
        roas: g.roas,
        // Todas as campanhas ativas do Google são de venda, então o recorte de
        // conversão é o total do canal.
        investimentoConversao: g.custo,
        receitaConversao: g.receita,
        conversoesConversao: g.conversoes,
      },
    ];

    const soma = (f: (c: Canal) => number) => canais.reduce((a, c) => a + f(c), 0);
    const investimento = soma((c) => c.investimento);
    const receita = soma((c) => c.receita);
    const conversoes = soma((c) => c.conversoes);
    // ROAS e CPA saem do recorte de conversão nos dois lados: dividir a receita
    // inteira pelo investimento só de conversão inflaria o número.
    const invConversao = soma((c) => c.investimentoConversao);
    const recConversao = soma((c) => c.receitaConversao);
    const convConversao = soma((c) => c.conversoesConversao);
    const roas = invConversao > 0 ? recConversao / invConversao : 0;
    const cpa = convConversao > 0 ? invConversao / convConversao : 0;
    const impressoes = soma((c) => c.impressoes);
    const cliques = soma((c) => c.cliques);
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;

    const conectados = canais.filter((c) => c.conectado);
    const janela =
      d.primeiroDia && d.ultimoDia
        ? `${diaMesCurto(d.primeiroDia)} – ${diaMesCurto(d.ultimoDia)}`
        : "sem dados";

    // Série diária unificada: a união das datas dos dois canais, para que o
    // início mais tardio do Google não corte o histórico do Meta.
    const custoGooglePorDia = new Map(
      (ads?.serie ?? []).map((p) => [p.date, p.custo] as const),
    );
    const datas = [
      ...new Set([...d.serie.map((p) => p.date), ...custoGooglePorDia.keys()]),
    ].sort();
    const spendMetaPorDia = new Map(d.serie.map((p) => [p.date, p.spend] as const));
    const serie: PontoGrafico[] = datas.map((date) => ({
      date,
      meta: spendMetaPorDia.get(date) ?? 0,
      google: custoGooglePorDia.get(date) ?? 0,
    }));

    return (
      <Shell
        escopo={escopo}
        titulo="Overview"
        sub={subtituloEscopo(
          escopo,
          `${conectados.length === 2 ? "Meta + Google" : "Meta Ads"} · ${janela}`,
          periodo,
        )}
      >
        <Pagina>
          <Secao>Consolidado de mídia</Secao>

          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(250px,1.1fr)_repeat(5,1fr)] lg:gap-5 lg:px-5">
            <Hero
              rotulo="Investimento total"
              valor={brl(investimento)}
              sub={`${janela} · ${conectados.length} ${conectados.length === 1 ? "canal" : "canais"}`}
            />
            <Stat
              rotulo="Receita"
              valor={brlCompact(receita)}
              sub={brl(receita)}
            />
            <Stat
              rotulo="ROAS"
              valor={roas > 0 ? `${dec(roas)}×` : "—"}
              sub={roas > 0 ? `conversão: ${brlCompact(invConversao)}` : "sem receita"}
            />
            <Stat rotulo="Compras" valor={int(conversoes)} sub="Meta + Google" />
            <Stat
              rotulo="CPA"
              valor={convConversao > 0 ? brl(cpa) : "—"}
              sub={convConversao > 0 ? "só conversão" : undefined}
            />
            <Stat rotulo="Impressões" valor={compact(impressoes)} sub={`CTR ${pct(ctr)}`} />
          </div>

          <Secao>Canais</Secao>

          <div className="grid shrink-0 grid-cols-1 gap-3.5 lg:grid-cols-2">
            {canais.map((c) => {
              const share = investimento > 0 ? (c.investimento / investimento) * 100 : 0;
              return (
                /* Duas faixas em vez de uma linha só: com os dois canais
                   trazendo número, a versão em linha espremia o nome da
                   plataforma até quebrar em duas linhas. */
                <Link
                  key={c.slug}
                  href={c.href}
                  className="cartao group flex flex-col gap-3 px-5 py-4 transition-colors hover:border-[var(--border-forte)]"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="block h-3.5 w-3.5 shrink-0 rotate-45"
                      style={{ background: c.cor, opacity: c.conectado ? 1 : 0.4 }}
                    />
                    <h3 className="marca shrink-0 text-[19px] leading-none">{c.nome}</h3>
                    {/* "Sem campanha" e "indisponível" levam a ações opostas:
                        a primeira é informação, a segunda é credencial para
                        configurar. Nunca podem usar o mesmo rótulo. */}
                    <Etiqueta
                      variante="contorno"
                      tom={
                        c.conectado
                          ? "neutro"
                          : c.slug === "google" && googleIndisponivel
                            ? "critico"
                            : "apagado"
                      }
                    >
                      {c.conectado
                        ? "Ativo"
                        : c.slug === "google" && googleIndisponivel
                          ? "Indisponível"
                          : "Sem campanha"}
                    </Etiqueta>
                    <span className="min-w-0 flex-1 truncate text-right text-[11.5px] text-[var(--ink-muted)]">
                      {c.conectado
                        ? `${pct(share, 1)} do investimento · ${int(c.conversoes)} compras`
                        : c.slug === "google" && googleIndisponivel
                          ? "Credencial não configurada — veja o detalhe na capa"
                          : "Sem campanha desta praça no canal"}
                    </span>
                    <span className="shrink-0 text-[18px] leading-none text-[var(--ink-muted)] transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-4 border-t border-[var(--border)] pt-3">
                    <MiniCanal rotulo="Investido" valor={c.conectado ? brl(c.investimento) : "—"} />
                    <MiniCanal rotulo="Receita" valor={c.conectado ? brl(c.receita) : "—"} />
                    <MiniCanal
                      rotulo="ROAS"
                      valor={c.conectado && c.roas > 0 ? `${dec(c.roas)}×` : "—"}
                    />
                    <MiniCanal
                      rotulo="CPA"
                      valor={
                        c.conectado && c.conversoesConversao > 0
                          ? brl(c.investimentoConversao / c.conversoesConversao)
                          : "—"
                      }
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          <Secao>Meta × Google</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.35fr_1fr]">
            <Cartao
              titulo="Investimento diário por canal"
              sub={
                googleAtivo
                  ? "O Google entrou depois — antes da primeira barra, só há Meta"
                  : "Google entra nesta série quando a praça tiver campanha no canal"
              }
              className="h-full"
            >
              <div className="h-[230px] lg:h-full">
                <AreaTempo
                  dados={serie}
                  series={[
                    { chave: "meta", nome: "Meta Ads", cor: "var(--par-a)" },
                    { chave: "google", nome: "Google Ads", cor: "var(--par-b)" },
                  ]}
                  formato="brl"
                  empilhar
                />
              </div>
            </Cartao>

            {/* Barras agrupadas de investimento × receita não cabiam aqui: as
                duas grandezas diferem por uma ordem de magnitude e os rótulos
                se sobrepunham. Participação relativa responde à mesma pergunta
                e as três faixas juntas mostram onde o retorno descola do gasto
                — o ROAS de cada canal já está no cartão acima. */}
            <Cartao
              titulo="Participação por canal"
              sub="Onde o retorno descola do gasto"
              className="h-full"
            >
              {/* Duas faixas, não três: cada bloco custa ~80px com legenda e a
                  terceira estourava a altura do cartão. Compras sai — o CPA de
                  cada canal, logo acima, responde o mesmo. */}
              <div className="flex h-full flex-col justify-center gap-6">
                {[
                  { rotulo: "Investimento", valor: (c: Canal) => c.investimento },
                  { rotulo: "Receita", valor: (c: Canal) => c.receita },
                ].map((faixa) => (
                  <div key={faixa.rotulo} className="flex flex-col gap-2">
                    <span className="rotulo">{faixa.rotulo}</span>
                    <EmpilhadaTotal
                      segmentos={conectados.map((c) => ({
                        nome: c.nome,
                        valor: faixa.valor(c),
                        cor: c.cor,
                      }))}
                      formato="brl"
                    />
                  </div>
                ))}
              </div>
            </Cartao>
          </Linha>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    const msg = e instanceof MetaError ? explicarErroMeta(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Overview" sub={subtituloEscopo(escopo, undefined, periodo)}>
        <ErroMeta titulo="Falha ao carregar a Marketing API" detalhe={msg} />
      </Shell>
    );
  }
}

function MiniCanal({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="rotulo">{rotulo}</span>
      <span className="tabular mt-1 truncate text-[17px] font-bold leading-none">{valor}</span>
    </div>
  );
}
