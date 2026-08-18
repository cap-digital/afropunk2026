import { notFound } from "next/navigation";
import { AreaGrafico, ErroMeta, Shell, subtituloEscopo, Linha, Pagina } from "@/components/Shell";
import {
  Cartao,
  CartaoKpi,
  ComLeitura,
  GradeKpi,
  Realce,
  Secao,
  Stat,
  Vazio,
} from "@/components/ui";
import {
  AreaTempo,
  BarrasAgrupadas,
  BarrasH,
  EmpilhadaTotal,
  Funil,
  LinhasTempo,
  Medidor,
  type PontoGrafico,
  type SerieTempo,
} from "@/components/charts";
import {
  carregarBreakdowns,
  carregarConjuntos,
  carregarCriativos,
  carregarEscopo,
} from "@/lib/dados";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { explicarErroMeta, MetaError, REVALIDATE } from "@/lib/meta";
import {
  ehEscopoValido,
  ESCOPOS,
  PLATAFORMA_LABEL,
  type EscopoSlug,
} from "@/lib/config";
import { brl, brlCompact, compact, dec, diaMesCurto, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

export default async function MetaVisaoGeral({
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
        <Shell escopo={escopo} titulo="Meta Ads" sub={subtituloEscopo(escopo, undefined, periodo)}>
          <div className="cartao min-h-[26rem] flex-1 lg:h-full">
            <Vazio
              titulo={`${d.praca?.nome ?? "Este escopo"} não tem campanha desta edição no Meta`}
              descricao="O painel está pronto e conectado. Assim que a primeira campanha entrar no ar, investimento, entrega, público, posicionamentos e criativos aparecem aqui automaticamente."
            />
          </div>
        </Shell>
      );
    }

    const janela =
      d.primeiroDia && d.ultimoDia
        ? `${diaMesCurto(d.primeiroDia)} – ${diaMesCurto(d.ultimoDia)}`
        : "sem dados";

    return d.comparativo ? (
      <Comparativo d={d} janela={janela} escopo={escopo} />
    ) : (
      <PracaUnica d={d} janela={janela} escopo={escopo} />
    );
  } catch (e) {
    const msg = e instanceof MetaError ? explicarErroMeta(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Meta Ads" sub={subtituloEscopo(escopo, undefined, periodo)}>
        <ErroMeta titulo="Falha ao carregar a Marketing API" detalhe={msg} />
      </Shell>
    );
  }
}

// ------------------------------------------------------------ todas as praças

type Dados = Awaited<ReturnType<typeof carregarEscopo>>;

async function Comparativo({
  d,
  janela,
  escopo,
}: {
  d: Dados;
  janela: string;
  escopo: EscopoSlug;
}) {
  // Todos os buckets, sempre na ordem validada da paleta: filtrar os inativos
  // mudaria a adjacência das cores e reprovaria no teste de daltonismo.
  const fatias = d.fatias;

  const dias = [...new Set(fatias.flatMap((f) => f.serie.map((s) => s.date)))].sort();
  const serie: PontoGrafico[] = dias.map((dia) => {
    const linha: PontoGrafico = { date: dia };
    for (const f of fatias) {
      linha[f.bucket.slug] = f.serie.find((s) => s.date === dia)?.spend ?? 0;
    }
    return linha;
  });
  const series: SerieTempo[] = fatias.map((f) => ({
    chave: f.bucket.slug,
    nome: f.bucket.nome,
    cor: f.bucket.cor,
  }));

  const volumes: PontoGrafico[] = fatias.map((f) => ({
    nome: f.bucket.nome,
    impressoes: f.total.impressions,
    alcance: f.total.reach,
  }));

  const t = d.total;

  return (
    <Shell
      escopo={escopo}
      titulo="Meta Ads · Comparativo"
      sub={subtituloEscopo(escopo, `${d.campanhas.length} campanhas · ${janela}`, d.periodo)}
    >
      <Pagina>
        <Secao>Resumo consolidado</Secao>
        <GradeKpi>
          <CartaoKpi destaque rotulo="Investimento total" valor={brl(t.spend)} sub={`${janela} · ${d.conta.currency}`} />
          <CartaoKpi rotulo="Impressões" valor={compact(t.impressions)} sub={`freq. ${dec(t.frequency)}`} />
          <CartaoKpi rotulo="Alcance" valor={compact(t.reach)} sub="pessoas únicas" />
          <CartaoKpi rotulo="Cliques" valor={compact(t.clicks)} sub={`CTR ${pct(t.ctr)}`} />
          <CartaoKpi rotulo="CPM" valor={brl(t.cpm)} sub={`CPC ${brl(t.cpc)}`} />
          <CartaoKpi
            rotulo="Compras"
            valor={int(t.purchases)}
            sub={t.purchases > 0 ? `ROAS ${dec(t.roas)}× sobre ${brlCompact(t.spendConversao)}` : "sem conversão"}
          />
        </GradeKpi>

        <Secao>Evolução</Secao>
        <Linha preencher className="grid grid-cols-1 gap-[var(--esp-grade)] lg:grid-cols-[1.3fr_1fr]">
          <Cartao
            titulo="Investimento diário por praça"
            sub="Campanhas iniciadas em 31/07 e 03/08 — a série cresce a cada dia"
          >
            <AreaGrafico>
              <LinhasTempo dados={serie} series={series} formato="brl" />
            </AreaGrafico>
          </Cartao>

          <Cartao
            titulo="Volume entregue"
            sub="Impressões vs. alcance — a distância entre as barras é a repetição"
          >
            <AreaGrafico>
              <BarrasAgrupadas
                dados={volumes}
                series={[
                  { chave: "impressoes", nome: "Impressões", cor: "var(--seq-2)" },
                  { chave: "alcance", nome: "Alcance", cor: "var(--seq-4)" },
                ]}
                formato="int"
              />
            </AreaGrafico>
          </Cartao>
        </Linha>

        <Secao>Praça a praça</Secao>
        <Linha className="grid grid-cols-1 gap-[var(--esp-grade)] lg:grid-cols-[1fr_1.35fr]">
          <Cartao
            titulo="Divisão do investimento"
            sub="Parte do todo · inclui a campanha nacional"
          >
            <div className="flex h-full flex-col justify-between">
              <EmpilhadaTotal
                segmentos={fatias.filter((f) => f.ativa).map((f) => ({
                  nome: f.bucket.nome,
                  valor: f.total.spend,
                  cor: f.bucket.cor,
                }))}
                formato="brl"
              />
              <div className="flex flex-col gap-1.5">
                {fatias.map((f) => (
                  <div key={f.bucket.slug} className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="block h-2 w-2 shrink-0 rotate-45"
                      style={{ background: f.bucket.cor }}
                    />
                    <span className="w-[7.375rem] shrink-0 truncate text-[length:var(--fs-corpo-2)] text-[var(--ink-2)]">
                      {f.bucket.nome}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(f.total.impressions / (t.impressions || 1)) * 100}%`,
                          background: f.bucket.cor,
                        }}
                      />
                    </div>
                    <span className="tabular min-w-[3.25rem] shrink-0 whitespace-nowrap text-right text-[length:var(--fs-corpo)] text-[var(--ink-muted)]">
                      {compact(f.total.impressions)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Cartao>

          <Cartao
            titulo="Comparativo completo"
            sub="Todas as métricas lado a lado"
          >
            <div className="rola-lateral max-h-[var(--h-tabela)] overflow-auto">
              <table className="w-full" style={{ fontSize: "var(--fs-corpo)" }}>
                <thead className="sticky top-0 bg-[var(--surface)]">
                  <tr className="text-left text-[length:var(--fs-corpo)] uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                    <th className="pb-2 pr-2 font-semibold">Praça</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Investido</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Impressões</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Alcance</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Freq.</th>
                    <th className="pb-2 pr-2 text-right font-semibold">CTR</th>
                    <th className="pb-2 pr-2 text-right font-semibold">CPM</th>
                    <th className="pb-2 text-right font-semibold">Compras</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {d.fatias.map((f) => (
                    <tr key={f.bucket.slug} className="border-t border-[var(--border)] text-[var(--ink-2)]">
                      <td className="py-2 pr-2">
                        <span className="flex items-center gap-1.5 font-medium text-[var(--ink)]">
                          <span
                            aria-hidden="true"
                            className="block h-2 w-2 shrink-0 rotate-45"
                            style={{ background: f.bucket.cor }}
                          />
                          {f.bucket.nome}
                        </span>
                      </td>
                      {f.ativa ? (
                        <>
                          <td className="py-2 pr-2 text-right font-semibold text-[var(--ink)]">
                            {brl(f.total.spend)}
                          </td>
                          <td className="py-2 pr-2 text-right">{compact(f.total.impressions)}</td>
                          <td className="py-2 pr-2 text-right">{compact(f.total.reach)}</td>
                          <td className="py-2 pr-2 text-right">{dec(f.total.frequency)}</td>
                          <td className="py-2 pr-2 text-right">{pct(f.total.ctr)}</td>
                          <td className="py-2 pr-2 text-right">{brl(f.total.cpm)}</td>
                          <td className="py-2 text-right">{int(f.total.purchases)}</td>
                        </>
                      ) : (
                        <td colSpan={7} className="py-2 text-right text-[length:var(--fs-corpo-2)] italic text-[var(--ink-muted)]">
                          sem campanha ativa
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border-forte)] font-semibold text-[var(--ink)]">
                    <td className="py-2 pr-2">Total</td>
                    <td className="py-2 pr-2 text-right">{brl(t.spend)}</td>
                    <td className="py-2 pr-2 text-right">{compact(t.impressions)}</td>
                    <td className="py-2 pr-2 text-right">{compact(t.reach)}</td>
                    <td className="py-2 pr-2 text-right">{dec(t.frequency)}</td>
                    <td className="py-2 pr-2 text-right">{pct(t.ctr)}</td>
                    <td className="py-2 pr-2 text-right">{brl(t.cpm)}</td>
                    <td className="py-2 text-right">{int(t.purchases)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Cartao>
        </Linha>
      </Pagina>
    </Shell>
  );
}

// ------------------------------------------------------------- praça única

async function PracaUnica({
  d,
  janela,
  escopo,
}: {
  d: Dados;
  janela: string;
  escopo: EscopoSlug;
}) {
  const t = d.total;
  const praca = d.praca!;
  const [bd, conjuntos, criativos] = await Promise.all([
    carregarBreakdowns(d),
    carregarConjuntos(d),
    carregarCriativos(d),
  ]);

  // Melhor conjunto e melhor criativo por retorno. Só entram os que têm
  // receita: ROAS 0 significa "não converteu", e não "converteu mal".
  const topConjunto = [...conjuntos]
    .filter((c) => c.m.purchaseValue > 0)
    .sort((a, b) => b.m.roas - a.m.roas)[0];
  const topCriativo = [...criativos]
    .filter((c) => c.m.purchaseValue > 0)
    .sort((a, b) => b.m.roas - a.m.roas)[0];

  const orcamento = d.campanhas.reduce((a, c) => a + Number(c.lifetime_budget ?? 0) / 100, 0);

  // Começa em cliques no link: impressão não é etapa de funil, é entrega.
  const funil = [
    { nome: "Cliques no link", valor: t.linkClicks },
    { nome: "Visitas à página", valor: t.landingPageViews },
    { nome: "Adições ao carrinho", valor: t.addToCart },
    { nome: "Checkouts iniciados", valor: t.initiateCheckout },
    { nome: "Compras", valor: t.purchases },
  ].filter((e) => e.valor > 0);

  const plataformas: PontoGrafico[] = bd.plataformas.slice(0, 4).map((p) => ({
    nome: PLATAFORMA_LABEL[p.chave] ?? p.chave,
    valor: p.impressions,
  }));

  /*
   * Leitura do funil: qual passagem perde mais gente.
   *
   * O gráfico mostra as cinco etapas e as taxas entre elas; o que ele NÃO diz
   * é qual delas é o gargalo, porque comparar cinco porcentagens de cabeça é
   * justamente o trabalho que o cartão deveria poupar. Aqui a maior queda vira
   * frase, com o volume perdido em número absoluto — que é o que dimensiona o
   * problema. Uma taxa de 15% não diz se são 30 pessoas ou 3 mil.
   */
  const gargalo = (() => {
    if (funil.length < 2) return null;
    let pior: { de: string; para: string; taxa: number; perdidos: number } | null = null;
    for (let i = 1; i < funil.length; i++) {
      const anterior = funil[i - 1];
      const atual = funil[i];
      if (anterior.valor <= 0) continue;
      const taxa = (atual.valor / anterior.valor) * 100;
      if (!pior || taxa < pior.taxa) {
        pior = {
          de: anterior.nome.toLowerCase(),
          para: atual.nome.toLowerCase(),
          taxa,
          perdidos: anterior.valor - atual.valor,
        };
      }
    }
    // Funil sem estreitamento relevante não tem gargalo para apontar.
    return pior && pior.taxa < 80 ? pior : null;
  })();

  return (
    <Shell
      escopo={escopo}
      titulo="Meta Ads"
      sub={subtituloEscopo(escopo, `${d.campanhas.length} campanhas · ${janela}`, d.periodo)}
    >
      <Pagina>
        <Secao>Resumo</Secao>
        <GradeKpi>
          <CartaoKpi destaque rotulo="Investido" valor={brl(t.spend)} sub={`${janela} · ${d.conta.currency}`} />
          <CartaoKpi rotulo="Impressões" valor={compact(t.impressions)} />
          <CartaoKpi rotulo="Alcance" valor={compact(t.reach)} sub={`freq. ${dec(t.frequency)}`} />
          <CartaoKpi rotulo="CTR" valor={pct(t.ctr)} sub={`${compact(t.clicks)} cliques`} />
          <CartaoKpi rotulo="CPM" valor={brl(t.cpm)} sub={`CPC ${brl(t.cpc)}`} />
          <CartaoKpi
            rotulo={t.purchases > 0 ? "ROAS" : "Compras"}
            valor={t.purchases > 0 ? `${dec(t.roas)}×` : "0"}
            sub={
              t.purchases > 0
                ? `${int(t.purchases)} compras · ${brl(t.purchaseValue)}`
                : "sem conversão no período"
            }
          />
        </GradeKpi>

        <Secao>Ritmo e conversão</Secao>
        <Linha preencher className="grid grid-cols-1 gap-[var(--esp-grade)] lg:grid-cols-[1.5fr_1fr]">
          <Cartao
            titulo="Investimento por dia"
            sub="Ritmo de gasto desde o início da veiculação"
          >
            <AreaGrafico>
              <AreaTempo
                dados={d.serie}
                series={[{ chave: "spend", nome: "Investimento", cor: praca.cor }]}
                formato="brl"
              />
            </AreaGrafico>
          </Cartao>

          <Cartao
            titulo="Funil de conversão"
            sub="Eventos contados de forma independente pelo Meta"
          >
            {/* `h-full`, não teto de tabela: o funil SABE se distribuir na
                altura (é o `esticar` do componente). Preso a um `min-height` de
                52vh ele empilhava as cinco etapas no topo e deixava o resto do
                cartão preto — o vazio mais visível do dashboard. */}
            <ComLeitura
              leitura={
                gargalo && (
                  <>
                    A maior perda está entre <Realce>{gargalo.de}</Realce> e{" "}
                    <Realce>{gargalo.para}</Realce>: passam{" "}
                    <Realce>{pct(gargalo.taxa, 1)}</Realce>, e{" "}
                    <Realce>{int(gargalo.perdidos)}</Realce> pessoas ficam pelo caminho. É a etapa
                    onde uma melhora rende mais do que aumentar a verba.
                  </>
                )
              }
            >
              <Funil etapas={funil} cor={praca.cor} esticar={false} />
            </ComLeitura>
          </Cartao>
        </Linha>

        <Secao>Entrega e verba</Secao>
        <Linha className="grid grid-cols-1 gap-[var(--esp-grade)] lg:grid-cols-3">
          <Cartao titulo="Onde as impressões acontecem" sub="Plataformas de veiculação">
            <BarrasH dados={plataformas} formato="int" corUnica="var(--seq-2)" larguraRotulo={104} />
          </Cartao>

          <Cartao
            titulo="Orçamento"
            sub={orcamento > 0 ? "Consumo sobre o total contratado" : "Sem orçamento vitalício na campanha"}
          >
            <div className="flex h-full flex-col justify-center gap-4">
              {orcamento > 0 ? (
                <>
                  <Medidor valor={t.spend} limite={orcamento} rotulo="Investimento vitalício" cor={praca.cor} />
                  <div className="grid grid-cols-2 gap-3">
                    <Stat rotulo="Restante" valor={brl(Math.max(orcamento - t.spend, 0))} tamanho="sm" />
                    <Stat rotulo="Custo por compra" valor={t.purchases > 0 ? brl(t.cpa) : "—"} tamanho="sm" />
                  </div>
                </>
              ) : (
                <p className="text-[length:var(--fs-corpo-2)] leading-relaxed text-[var(--ink-muted)]">
                  As campanhas desta praça não usam orçamento vitalício no nível da campanha — o
                  controle está no conjunto de anúncios.
                </p>
              )}
            </div>
          </Cartao>

          {/*
            Destaques por retorno. O rótulo da plataforma fica explícito porque
            esta seção passa a receber Google Ads — e aí os dois convivem aqui.
          */}
          <Cartao
            titulo="Destaques por ROAS"
            sub="O que mais devolveu por real investido"
          >
            <div className="flex h-full flex-col justify-center gap-3">
              <Destaque
                rotulo="Top conjunto"
                nome={topConjunto?.nome}
                roas={topConjunto?.m.roas}
                investido={topConjunto?.m.spend}
                receita={topConjunto?.m.purchaseValue}
                cor={praca.cor}
              />
              <div className="h-px w-full bg-[var(--border)]" />
              <Destaque
                rotulo="Top criativo"
                nome={topCriativo?.adName}
                roas={topCriativo?.m.roas}
                investido={topCriativo?.m.spend}
                receita={topCriativo?.m.purchaseValue}
                cor={praca.cor}
                imagem={topCriativo?.imageUrl ?? topCriativo?.thumbnailUrl ?? null}
                link={topCriativo?.permalink ?? null}
              />
            </div>
          </Cartao>
        </Linha>
      </Pagina>
    </Shell>
  );
}

/* eslint-disable @next/next/no-img-element */
/**
 * Linha de destaque por ROAS. `plataforma` fica visível de propósito: quando o
 * Google Ads entrar, os dois canais dividem este cartão e a origem precisa
 * estar clara sem depender de cor.
 */
function Destaque({
  rotulo,
  nome,
  roas,
  investido,
  receita,
  cor,
  imagem,
  link,
  plataforma = "Meta",
}: {
  rotulo: string;
  nome?: string;
  roas?: number;
  investido?: number;
  receita?: number;
  cor: string;
  imagem?: string | null;
  link?: string | null;
  plataforma?: string;
}) {
  if (!nome || !roas) {
    return (
      <div className="flex flex-col gap-1">
        <span className="rotulo">{rotulo}</span>
        <p className="text-[length:var(--fs-corpo-2)] leading-relaxed text-[var(--ink-muted)]">
          Nenhum registrou receita no período selecionado.
        </p>
      </div>
    );
  }

  const conteudo = (
    <div className="flex items-center gap-2.5">
      {imagem && (
        <span className="h-[2.375rem] w-[2.375rem] shrink-0 overflow-hidden rounded-md bg-[var(--surface-2)]">
          <img src={imagem} alt="" loading="lazy" className="h-full w-full object-cover" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rotulo">{rotulo}</span>
          <span className="text-[length:var(--fs-rotulo)] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
            · {plataforma}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[length:var(--fs-corpo-2)] font-semibold text-[var(--ink)]" title={nome}>
          {nome}
        </p>
        <p className="tabular text-[length:var(--fs-corpo)] text-[var(--ink-muted)]">
          {brl(investido ?? 0)} investido · {brl(receita ?? 0)} de receita
        </p>
      </div>
      <span
        className="tabular shrink-0 text-[length:var(--fs-kpi)] font-bold leading-none"
        style={{ color: roas >= 1 ? "var(--good)" : cor }}
      >
        {dec(roas)}×
      </span>
    </div>
  );

  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80">
      {conteudo}
    </a>
  ) : (
    conteudo
  );
}
