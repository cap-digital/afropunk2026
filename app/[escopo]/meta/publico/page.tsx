import { notFound } from "next/navigation";
import { AreaGrafico, ErroMeta, Linha, Pagina, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao, CartaoKpi, ComLeitura, GradeKpi, Realce, Secao, Vazio } from "@/components/ui";
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

    /*
     * Leitura do cartão de gênero: concentração.
     *
     * O cartão mostra duas divisões — gênero em cima, faixa etária embaixo — e
     * a conclusão útil não está em nenhuma das duas sozinha: é quanto do público
     * cabe numa faixa só, porque é isso que decide se vale segmentar mais fino
     * ou se a campanha já está falando com quem devia.
     */
    const leituraPerfil = (() => {
      const topo = porFaixa[0];
      if (!topo || totalImpr <= 1) return null;
      const shareTopo = (topo.total / totalImpr) * 100;
      const duasPrimeiras = porFaixa
        .slice(0, 2)
        .reduce((acc, f) => acc + (f.total / totalImpr) * 100, 0);
      const genero = totalF >= totalM ? "feminino" : "masculino";
      const shareGenero = (Math.max(totalF, totalM) / totalGen) * 100;
      return { topo, shareTopo, duasPrimeiras, genero, shareGenero };
    })();

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
          <Secao>Quem está sendo alcançado</Secao>

          <GradeKpi colunas="lg:grid-cols-5">
            <CartaoKpi
              rotulo="Faixa dominante"
              valor={porFaixa[0]?.faixa ?? "—"}
              sub={
                porFaixa[0] ? `${pct((porFaixa[0].total / totalImpr) * 100, 1)} das impressões` : undefined
              }
            />
            <CartaoKpi rotulo="Feminino" valor={pct((totalF / totalGen) * 100, 1)} sub={`${compact(totalF)} impressões`} />
            <CartaoKpi rotulo="Masculino" valor={pct((totalM / totalGen) * 100, 1)} sub={`${compact(totalM)} impressões`} />
            <CartaoKpi rotulo="Alcance total" valor={compact(d.total.reach)} sub={`freq. ${dec(d.total.frequency)}`} />
            <CartaoKpi
              rotulo={d.comparativo ? "Regiões atingidas" : "Impressões"}
              valor={d.comparativo ? int(bd.regioes.length) : compact(d.total.impressions)}
              sub={d.comparativo ? "com entrega registrada" : `CTR ${pct(d.total.ctr)}`}
            />
          </GradeKpi>

          <Secao>Idade e gênero</Secao>

          <Linha preencher className="grid grid-cols-1 gap-[var(--esp-grade)] lg:grid-cols-[1.15fr_1fr]">
            <Cartao
              titulo="Pirâmide etária"
              sub="Impressões por faixa e gênero — barras divergentes a partir do zero"
            >
              <AreaGrafico>
                <Piramide dados={piramide} corF="var(--par-a)" corM="var(--par-b)" formato="int" />
              </AreaGrafico>
            </Cartao>

            <Cartao
              titulo={d.comparativo ? "Perfil etário por praça" : "Distribuição por gênero"}
              sub={
                d.comparativo
                  ? "% das impressões de cada praça em cada faixa"
                  : "Parte do todo sobre as impressões entregues"
              }
            >
              {d.comparativo ? (
                <AreaGrafico>
                  <BarrasAgrupadas dados={perfilPorBucket} series={seriesBuckets} formato="pct" />
                </AreaGrafico>
              ) : (
                <ComLeitura
                  leitura={
                    leituraPerfil && (
                      <>
                        Público concentrado: <Realce>{leituraPerfil.topo.faixa}</Realce> responde
                        por <Realce>{pct(leituraPerfil.shareTopo, 1)}</Realce> das impressões, e as
                        duas primeiras faixas somam{" "}
                        <Realce>{pct(leituraPerfil.duasPrimeiras, 1)}</Realce>. O corte de gênero é
                        mais suave — <Realce>{pct(leituraPerfil.shareGenero, 1)}</Realce>{" "}
                        {leituraPerfil.genero}.
                      </>
                    )
                  }
                >
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
                  <div className="flex flex-col gap-2">
                    {porFaixa.slice(0, 4).map((f) => (
                      <div key={f.faixa} className="flex items-center gap-3">
                        <span className="tabular min-w-[2.75rem] shrink-0 whitespace-nowrap text-[length:var(--fs-corpo-2)] text-[var(--ink-2)]">
                          {f.faixa}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(f.total / totalImpr) * 100}%`, background: cor }}
                          />
                        </div>
                        <span className="tabular min-w-[3.0rem] shrink-0 whitespace-nowrap text-right text-[length:var(--fs-corpo-2)] text-[var(--ink-muted)]">
                          {pct((f.total / totalImpr) * 100, 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ComLeitura>
              )}
            </Cartao>
          </Linha>

          <Secao>Onde o anúncio é visto</Secao>

          {/*
            Regiões só faz sentido no comparativo: no escopo de uma praça a
            segmentação é o próprio estado dela, e o gráfico vira uma barra só.
          */}
          <Linha className={d.comparativo ? "grid grid-cols-2 gap-[var(--esp-grade)]" : ""}>
            {d.comparativo && (
              <Cartao
                titulo="Regiões"
                sub="Impressões por estado — a segmentação geográfica em prática"
              >
                <BarrasH dados={regioes} formato="int" corUnica="var(--seq-2)" larguraRotulo={132} />
              </Cartao>
            )}

            <Cartao
              titulo="Dispositivos"
              sub={
                d.comparativo
                  ? "Aparelho usado para ver o anúncio"
                  : `Aparelho usado para ver o anúncio · ${d.praca?.uf ?? ""} concentra toda a entrega`
              }
            >
              <BarrasH dados={dispositivos} formato="int" corUnica="var(--seq-3)" larguraRotulo={120} />
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
