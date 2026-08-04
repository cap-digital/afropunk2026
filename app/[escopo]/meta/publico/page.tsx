import { notFound } from "next/navigation";
import { ErroMeta, Linha, Pagina, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao, Secao, Stat, Vazio } from "@/components/ui";
import { BarrasAgrupadas, BarrasH, EmpilhadaTotal, Piramide, type PontoGrafico } from "@/components/charts";
import { carregarBreakdowns, carregarEscopo } from "@/lib/dados";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { explicarErroMeta, MetaError, REVALIDATE, type LinhaBreakdown } from "@/lib/meta";
import { DISPOSITIVO_LABEL, ehEscopoValido, ESCOPOS, type EscopoSlug } from "@/lib/config";
import { compact, dec, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

/** Soma impressões de um conjunto de linhas idade×gênero para um gênero. */
function porGenero(linhas: LinhaBreakdown[], genero: string): number {
  return linhas.filter((l) => l.chave2 === genero).reduce((a, l) => a + l.impressions, 0);
}

const EH_DESCONHECIDO = (f: string) => /unknown|desconhec/i.test(f);

export default async function MetaPublico({
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
        <Shell escopo={escopo} titulo="Meta Ads · Público" sub={subtituloEscopo(escopo, undefined, periodo)}>
          <div className="cartao h-full">
            <Vazio
              cor={d.praca?.cor}
              titulo="Sem dados de público"
              descricao="O detalhamento por idade, gênero e dispositivo aparece assim que houver entrega registrada."
            />
          </div>
        </Shell>
      );
    }

    const bd = await carregarBreakdowns(d);
    const cor = d.praca?.cor ?? "var(--todas)";

    // "Unknown" fica fora da pirâmide: são poucas dezenas de impressões e o
    // rótulo estoura o eixo de categorias. Continua contando nos totais.
    const faixas = [...new Set(bd.idadeGenero.map((l) => l.chave))]
      .filter((f) => !EH_DESCONHECIDO(f))
      .sort();

    const piramide = faixas.map((f) => {
      const linhas = bd.idadeGenero.filter((l) => l.chave === f);
      return {
        faixa: f,
        feminino: porGenero(linhas, "female"),
        masculino: porGenero(linhas, "male"),
      };
    });

    const totalF = porGenero(bd.idadeGenero, "female");
    const totalM = porGenero(bd.idadeGenero, "male");
    const totalOutros = bd.idadeGenero
      .filter((l) => l.chave2 !== "female" && l.chave2 !== "male")
      .reduce((a, l) => a + l.impressions, 0);
    const totalGen = totalF + totalM + totalOutros || 1;

    const porFaixa = faixas
      .map((f) => ({
        faixa: f,
        total: bd.idadeGenero.filter((l) => l.chave === f).reduce((a, l) => a + l.impressions, 0),
      }))
      .sort((a, b) => b.total - a.total);
    const totalImpr = porFaixa.reduce((a, f) => a + f.total, 0) || 1;

    const dispositivos: PontoGrafico[] = bd.dispositivos.slice(0, 6).map((r) => ({
      nome: DISPOSITIVO_LABEL[r.chave] ?? r.chave,
      valor: r.impressions,
    }));
    const regioes: PontoGrafico[] = bd.regioes.slice(0, 8).map((r) => ({
      nome: r.chave,
      valor: r.impressions,
    }));

    // Comparativo: perfil etário lado a lado entre praças.
    const perfilPorBucket: PontoGrafico[] = faixas.map((f) => {
      const linha: PontoGrafico = { nome: f };
      for (const fat of d.fatias) {
        const lb = bd.porBucket.get(fat.bucket.slug)?.idadeGenero ?? [];
        const tot = lb.reduce((a, l) => a + l.impressions, 0) || 1;
        const naFaixa = lb.filter((l) => l.chave === f).reduce((a, l) => a + l.impressions, 0);
        linha[fat.bucket.slug] = Number(((naFaixa / tot) * 100).toFixed(2));
      }
      return linha;
    });
    const seriesBuckets = d.fatias.map((f) => ({
      chave: f.bucket.slug,
      nome: f.bucket.nome,
      cor: f.bucket.cor,
    }));

    return (
      <Shell
        escopo={escopo}
        titulo="Meta Ads · Público"
        sub={subtituloEscopo(escopo, undefined, periodo)}
      >
        <Pagina>
          <Secao cor={cor}>Quem está sendo alcançado</Secao>

          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5 lg:px-5">
            <Stat
              rotulo="Faixa dominante"
              valor={porFaixa[0]?.faixa ?? "—"}
              sub={
                porFaixa[0] ? `${pct((porFaixa[0].total / totalImpr) * 100, 1)} das impressões` : undefined
              }
              cor={cor}
            />
            <Stat rotulo="Feminino" valor={pct((totalF / totalGen) * 100, 1)} sub={`${compact(totalF)} impressões`} />
            <Stat rotulo="Masculino" valor={pct((totalM / totalGen) * 100, 1)} sub={`${compact(totalM)} impressões`} />
            <Stat rotulo="Alcance total" valor={compact(d.total.reach)} sub={`freq. ${dec(d.total.frequency)}`} />
            <Stat
              rotulo={d.comparativo ? "Regiões atingidas" : "Impressões"}
              valor={d.comparativo ? int(bd.regioes.length) : compact(d.total.impressions)}
              sub={d.comparativo ? "com entrega registrada" : `CTR ${pct(d.total.ctr)}`}
            />
          </div>

          <Secao cor={cor}>Idade e gênero</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.15fr_1fr]">
            <Cartao
              titulo="Pirâmide etária"
              sub="Impressões por faixa e gênero — barras divergentes a partir do zero"
              className="h-full"
              cor={cor}
            >
              <div className="h-[260px] lg:h-full">
                <Piramide dados={piramide} corF="var(--par-a)" corM="var(--par-b)" formato="int" />
              </div>
            </Cartao>

            <Cartao
              titulo={d.comparativo ? "Perfil etário por praça" : "Distribuição por gênero"}
              sub={
                d.comparativo
                  ? "% das impressões de cada praça em cada faixa"
                  : "Parte do todo sobre as impressões entregues"
              }
              className="h-full"
              cor="var(--par-a)"
            >
              {d.comparativo ? (
                <div className="h-[260px] lg:h-full">
                  <BarrasAgrupadas dados={perfilPorBucket} series={seriesBuckets} formato="pct" />
                </div>
              ) : (
                <div className="flex h-full flex-col justify-center gap-7">
                  <EmpilhadaTotal
                    segmentos={[
                      { nome: "Feminino", valor: totalF, cor: "var(--par-a)" },
                      { nome: "Masculino", valor: totalM, cor: "var(--par-b)" },
                      ...(totalOutros > 0
                        ? [{ nome: "Não identificado", valor: totalOutros, cor: "var(--surface-3)" }]
                        : []),
                    ]}
                    formato="int"
                  />
                  <div className="flex flex-col gap-2.5">
                    {porFaixa.slice(0, 5).map((f) => (
                      <div key={f.faixa} className="flex items-center gap-3">
                        <span className="tabular w-[44px] shrink-0 text-[12.5px] text-[var(--ink-2)]">
                          {f.faixa}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(f.total / totalImpr) * 100}%`, background: cor }}
                          />
                        </div>
                        <span className="tabular w-[48px] shrink-0 text-right text-[12.5px] text-[var(--ink-muted)]">
                          {pct((f.total / totalImpr) * 100, 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Cartao>
          </Linha>

          <Secao cor={cor}>Onde o anúncio é visto</Secao>

          {/*
            Regiões só faz sentido no comparativo: no escopo de uma praça a
            segmentação é o próprio estado dela, e o gráfico vira uma barra só.
          */}
          <Linha className={d.comparativo ? "grid grid-cols-2 gap-3.5" : ""}>
            {d.comparativo && (
              <Cartao
                titulo="Regiões"
                sub="Impressões por estado — a segmentação geográfica em prática"
                className="h-full"
                cor={cor}
              >
                <div className="h-[260px] lg:h-full">
                  <BarrasH dados={regioes} formato="int" corUnica="var(--seq-2)" larguraRotulo={132} />
                </div>
              </Cartao>
            )}

            <Cartao
              titulo="Dispositivos"
              sub={
                d.comparativo
                  ? "Aparelho usado para ver o anúncio"
                  : `Aparelho usado para ver o anúncio · ${d.praca?.uf ?? ""} concentra toda a entrega`
              }
              className="h-full"
              cor="var(--seq-3)"
            >
              <div className="h-[260px] lg:h-full">
                <BarrasH dados={dispositivos} formato="int" corUnica="var(--seq-3)" larguraRotulo={120} />
              </div>
            </Cartao>
          </Linha>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    const msg = e instanceof MetaError ? explicarErroMeta(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Meta Ads · Público" sub={subtituloEscopo(escopo, undefined, periodo)}>
        <ErroMeta titulo="Falha ao carregar a Marketing API" detalhe={msg} />
      </Shell>
    );
  }
}
