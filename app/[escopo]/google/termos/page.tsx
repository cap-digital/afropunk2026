import { notFound } from "next/navigation";
import { IconMessageSearch, IconPointFilled, IconRoute } from "@tabler/icons-react";
import { ErroMeta, Linha, Pagina, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao, Hero, Secao, Stat } from "@/components/ui";
import { BarrasH } from "@/components/charts";
import { TabelaOrdenavel } from "@/components/TabelaOrdenavel";
import { somarAds } from "@/lib/ads";
import { carregarTermos, tipoDaBusca, TIPO_BUSCA } from "@/lib/adsDetalhe";
import { explicarErroAds, GoogleAdsError, REVALIDATE_ADS } from "@/lib/googleAds";
import { ehControleNext } from "@/lib/erroNext";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { ehEscopoValido, ESCOPOS, type EscopoSlug } from "@/lib/config";
import { brl, brlCompact, compact, dec, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE_ADS;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

export default async function Termos({
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
    const d = await carregarTermos(escopo, periodo);

    /*
     * Sem campanha, sem página: a rota some da lateral e o acesso direto cai em
     * 404. Uma tela dizendo "não há nada aqui" é um beco — o Overview já
     * informa que a praça não tem esse canal no ar.
     */
    if (!d.ativo) notFound();

    /*
     * Só termos que já viraram palavra-chave nossa. Os que o Google trouxe por
     * correspondência ampla e ainda não foram adotados são fila de trabalho da
     * operação, não leitura de cliente — mostrá-los aqui convidaria à pergunta
     * "por que estamos pagando por isso?" sem o contexto de que a decisão de
     * adotar ou negativar é justamente o que está em curso.
     */
    const termos = d.termos.filter((x) => x.status === "ADDED" || x.status === "ADDED_EXCLUDED");
    const t = somarAds(termos.map((x) => x.m));

    /*
     * Agrupamento por intenção. Só entram os tipos que existem no recorte —
     * barra zerada num gráfico de quatro sugere que a categoria fracassou,
     * quando na verdade ninguém buscou daquele jeito.
     */
    const CORES_TIPO: Record<string, string> = {
      compra: "var(--seq-4)",
      marcaPraca: "var(--seq-3)",
      marca: "var(--seq-2)",
      outros: "var(--seq-1)",
    };
    const porTipo = TIPO_BUSCA.map((t) => {
      const doTipo = termos.filter((x) => tipoDaBusca(x.termo) === t.tipo);
      return { ...t, termos: doTipo.length, m: somarAds(doTipo.map((x) => x.m)) };
    }).filter((t) => t.termos > 0);

    // O tipo com melhor retorno entre os que têm receita — o KPI é a manchete
    // do gráfico logo abaixo, não um número solto.
    const melhorTipo = [...porTipo].filter((t) => t.m.roas > 0).sort((a, b) => b.m.roas - a.m.roas)[0];


    return (
      <Shell
        escopo={escopo}
        titulo="Termos de busca"
        sub={subtituloEscopo(escopo, `${termos.length} palavras-chave com busca`)}
      >
        <Pagina>
          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(240px,1.1fr)_repeat(4,1fr)] lg:gap-5 lg:px-5">
            <Hero
              rotulo="Investido em buscas"
              valor={brl(t.custo)}
              sub={`${compact(t.cliques)} cliques · CTR ${pct(t.ctr)}`}
            />
            <Stat
              rotulo="Receita"
              valor={brlCompact(t.receita)}
              sub={`ROAS ${t.roas > 0 ? `${dec(t.roas)}×` : "—"}`}
            />
            <Stat
              rotulo="Termos"
              valor={int(termos.length)}
              sub="já são palavra-chave"
            />
            <Stat
              rotulo="CPC médio"
              valor={brl(t.cpc)}
              sub={`${compact(t.impressoes)} impressões`}
            />
            <Stat
              rotulo="Tipo que mais rende"
              valor={melhorTipo ? `${dec(melhorTipo.m.roas)}×` : "—"}
              sub={melhorTipo ? melhorTipo.nome.toLowerCase() : "sem receita no recorte"}
            />
          </div>


          <Secao icone={IconRoute}>Tipo de busca</Secao>

          {/* O que a tabela não dá: ela lista termo a termo, isto agrupa por
              intenção e mostra qual tipo de busca devolve mais por real. */}
          <div className="cartao grid shrink-0 grid-cols-1 gap-4 px-5 py-3.5 lg:grid-cols-[1.35fr_1fr]">
            <div className="h-[132px]">
              <BarrasH
                dados={porTipo.map((t) => ({
                  nome: t.nome,
                  valor: t.m.custo,
                  cor: CORES_TIPO[t.tipo],
                }))}
                formato="brl"
                larguraRotulo={128}
              />
            </div>
            <div className="flex flex-col justify-center gap-1.5">
              {porTipo.map((t) => (
                <div key={t.tipo} className="flex items-baseline gap-2 text-[var(--fs-corpo-2)]">
                  <IconPointFilled
                    size={11}
                    aria-hidden="true"
                    className="shrink-0 self-center"
                    style={{ color: CORES_TIPO[t.tipo] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[var(--ink-2)]" title={t.descricao}>
                    {t.nome}
                  </span>
                  <span className="tabular shrink-0 text-[var(--fs-corpo)] text-[var(--ink-muted)]">
                    {t.termos} {t.termos === 1 ? "termo" : "termos"}
                  </span>
                  <span
                    className="tabular w-[64px] shrink-0 text-right font-bold"
                    style={{ color: t.m.roas >= 1 ? "var(--good)" : "var(--ink-2)" }}
                  >
                    {t.m.roas > 0 ? `${dec(t.m.roas)}×` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Secao icone={IconMessageSearch}>O que as pessoas digitaram</Secao>

          {/* Tabela em largura cheia: ela já está ordenada por investimento, e
              um gráfico de barras ao lado repetiria o mesmo ranking. */}
          <Linha>
            <Cartao className="h-full min-w-0">
              <TabelaOrdenavel
                colunas={[
                  { chave: "termo", rotulo: "Termo buscado" },
                  { chave: "impressoes", rotulo: "Impr.", formato: "int" },
                  { chave: "cliques", rotulo: "Cliques", formato: "int" },
                  { chave: "custo", rotulo: "Investido", formato: "brl" },
                  { chave: "conversoes", rotulo: "Conv.", formato: "conv" },
                  { chave: "receita", rotulo: "Receita", formato: "brl", enfase: true },
                  { chave: "roas", rotulo: "ROAS", formato: "roas", destacarBom: true },
                ]}
                linhas={termos.map((x) => ({
                  id: x.chave,
                  cor: escopo === "todas-as-pracas" ? x.bucket.cor : undefined,
                  titulo: x.termo,
                  termo: x.termo,
                  impressoes: x.m.impressoes,
                  cliques: x.m.cliques,
                  custo: x.m.custo,
                  conversoes: x.m.conversoes,
                  receita: x.m.receita,
                  roas: x.m.roas,
                }))}
                ordenarPor="custo"
              />
            </Cartao>
          </Linha>


          <p className="shrink-0 text-[var(--fs-corpo)] leading-relaxed text-[var(--ink-muted)]">
            Termo de busca é o que a pessoa digitou; palavra-chave é o que compramos. A tabela traz
            só as buscas que já viraram palavra-chave da conta — o mesmo termo aparecendo em grupos
            diferentes vira uma linha só.
          </p>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    // `notFound()` sinaliza por exceção — deixa passar antes de tratar falha.
    if (ehControleNext(e)) throw e;
    const msg = e instanceof GoogleAdsError ? explicarErroAds(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Termos de busca" sub={subtituloEscopo(escopo)}>
        <ErroMeta titulo="Falha ao carregar a Google Ads API" detalhe={msg} />
      </Shell>
    );
  }
}
