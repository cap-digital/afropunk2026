import { notFound } from "next/navigation";
import { ErroMeta, Linha, Pagina, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao, Hero, Secao, Stat } from "@/components/ui";
import { BarrasH, EmpilhadaTotal, MapaCalor, type PontoGrafico } from "@/components/charts";
import { carregarSegmentacao, DIA_LABEL } from "@/lib/adsDetalhe";
import { explicarErroAds, GoogleAdsError, REVALIDATE_ADS } from "@/lib/googleAds";
import { ehControleNext } from "@/lib/erroNext";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { ehEscopoValido, ESCOPOS, type EscopoSlug } from "@/lib/config";
import { brl, brlCompact, compact, conv, dec, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE_ADS;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

/**
 * Faixas de 3 horas em vez das 24 colunas cruas: com 24 colunas cada célula
 * fica com ~35px e o número dentro não cabe. Oito faixas mantêm a leitura de
 * madrugada / manhã / tarde / noite sem virar uma régua ilegível.
 */
const FAIXAS = [
  { rotulo: "00–03", de: 0, ate: 2 },
  { rotulo: "03–06", de: 3, ate: 5 },
  { rotulo: "06–09", de: 6, ate: 8 },
  { rotulo: "09–12", de: 9, ate: 11 },
  { rotulo: "12–15", de: 12, ate: 14 },
  { rotulo: "15–18", de: 15, ate: 17 },
  { rotulo: "18–21", de: 18, ate: 20 },
  { rotulo: "21–24", de: 21, ate: 23 },
];

export default async function Segmentacao({
  params,
  searchParams,
}: {
  params: { escopo: string };
  searchParams: ParamsBusca;
}) {
  if (!ehEscopoValido(params.escopo)) notFound();
  const escopo = params.escopo as EscopoSlug;
  const periodo = periodoDeParams(searchParams);
  const cor = "var(--seq-4)";

  try {
    const d = await carregarSegmentacao(escopo, periodo);

    /*
     * Sem campanha, sem página: a rota some da lateral e o acesso direto cai em
     * 404. Uma tela dizendo "não há nada aqui" é um beco — o Overview já
     * informa que a praça não tem esse canal no ar.
     */
    if (!d.ativo) notFound();

    const t = d.total;

    // Só dias com alguma entrega entram no mapa: as campanhas têm poucos dias
    // no ar e uma linha inteira vazia sugeriria que ninguém buscou naquele dia.
    const diasComDado = [...new Set(d.horaDia.filter((c) => c.impressoes > 0).map((c) => c.dia))]
      .sort((a, b) => a - b)
      .map((i) => DIA_LABEL[i]);

    const valores = new Map<string, number>();
    for (const c of d.horaDia) {
      const faixa = FAIXAS.find((f) => c.hora >= f.de && c.hora <= f.ate);
      if (!faixa) continue;
      const k = `${DIA_LABEL[c.dia]}||${faixa.rotulo}`;
      valores.set(k, (valores.get(k) ?? 0) + c.cliques);
    }

    const melhorHora = [...d.porHora].sort((a, b) => b.m.conversoes - a.m.conversoes)[0];

    // Seis cidades: da sétima em diante os nomes compostos quebram em duas
    // linhas e a barra some — e a cauda já é irrelevante (menos de R$ 10).
    const cidades = d.cidades.slice(0, 6);
    const cidadesGrafico: PontoGrafico[] = cidades.map((c) => ({
      nome: c.nome,
      valor: c.m.custo,
      cor,
    }));

    const CORES_DISP = ["var(--par-a)", "var(--par-b)", "var(--ink-muted)", "var(--seq-2)"];
    const mixDispositivo = d.dispositivos.map((x, i) => ({
      nome: x.nome,
      valor: x.m.custo,
      cor: CORES_DISP[i] ?? "var(--ink-muted)",
    }));

    return (
      <Shell
        escopo={escopo}
        titulo="Segmentação"
        sub={subtituloEscopo(escopo, `${d.cidades.length} cidades com entrega`)}
      >
        <Pagina>
          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(240px,1.1fr)_repeat(4,1fr)] lg:gap-5 lg:px-5">
            <Hero
              rotulo="Investido"
              valor={brl(t.custo)}
              sub={`${compact(t.impressoes)} impressões · CTR ${pct(t.ctr)}`}
            />
            {d.dispositivos.slice(0, 2).map((x) => (
              <Stat
                key={x.nome}
                rotulo={x.nome}
                valor={pct(t.custo > 0 ? (x.m.custo / t.custo) * 100 : 0, 1)}
                sub={`${brlCompact(x.m.custo)} · ROAS ${x.m.roas > 0 ? `${dec(x.m.roas)}×` : "—"}`}
              />
            ))}
            <Stat
              rotulo="Cidade que mais gasta"
              valor={cidades[0]?.nome ?? "—"}
              sub={cidades[0] ? `${brl(cidades[0].m.custo)} · ${int(cidades[0].m.conversoes)} conv.` : undefined}
            />
            <Stat
              rotulo="Melhor hora"
              valor={melhorHora && melhorHora.m.conversoes > 0 ? melhorHora.nome : "—"}
              sub={
                melhorHora && melhorHora.m.conversoes > 0
                  ? `${conv(melhorHora.m.conversoes)} conversões`
                  : "sem conversão no recorte"
              }
            />
          </div>

          <Secao>Quando e onde</Secao>

          {/* Sem gráfico de investimento por faixa ao lado do mapa: as duas
              formas responderiam a mesma pergunta e, somadas, não sobrava
              altura para nenhuma das duas caber em 768px. */}
          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.1fr_1fr]">
            <Cartao
              titulo="Cliques por dia e faixa de horário"
              sub="Faixas de 3 horas — só dias com entrega"
              className="min-h-0"
            >
              <div className="h-full">
                <MapaCalor
                  linhas={diasComDado}
                  colunas={FAIXAS.map((f) => f.rotulo)}
                  valores={valores}
                  formato="int"
                  larguraRotulo={44}
                />
              </div>
            </Cartao>

            <Cartao
              titulo="Cidades que mais consomem"
              sub="Localização de quem viu o anúncio"
              className="min-h-0"
            >
              <div className="h-full">
                <BarrasH
                  dados={cidadesGrafico}
                  formato="brl"
                  larguraRotulo={112}
                  corUnica="var(--par-a)"
                />
              </div>
            </Cartao>
          </Linha>

          <Secao>Aparelho</Secao>

          <div className="grid shrink-0 grid-cols-1 gap-3.5 lg:grid-cols-[280px_1fr]">
            <Cartao className="flex flex-col justify-center">
              <span className="rotulo">Investimento por aparelho</span>
              <div className="mt-2">
                <EmpilhadaTotal segmentos={mixDispositivo} formato="brl" />
              </div>
            </Cartao>

            <Cartao className="min-w-0">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-[var(--ink-muted)]">
                    <th className="pb-2 pr-3 font-semibold">Aparelho</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Investido</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Cliques</th>
                    <th className="pb-2 pr-3 text-right font-semibold">CTR</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Conv.</th>
                    <th className="pb-2 pr-3 text-right font-semibold">CPA</th>
                    <th className="pb-2 text-right font-semibold">ROAS</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {d.dispositivos.map((x, i) => (
                    <tr key={x.nome} className="border-t border-[var(--border)] text-[var(--ink-2)]">
                      <td className="py-2 pr-3 font-medium text-[var(--ink)]">
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="block h-2 w-2 shrink-0 rotate-45"
                            style={{ background: CORES_DISP[i] ?? "var(--ink-muted)" }}
                          />
                          {x.nome}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right">{brl(x.m.custo)}</td>
                      <td className="py-2 pr-3 text-right">{int(x.m.cliques)}</td>
                      <td className="py-2 pr-3 text-right">{pct(x.m.ctr)}</td>
                      <td className="py-2 pr-3 text-right">
                        {x.m.conversoes > 0 ? conv(x.m.conversoes) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {x.m.conversoes > 0 ? brl(x.m.cpa) : "—"}
                      </td>
                      <td
                        className="py-2 text-right font-semibold"
                        style={{ color: x.m.roas >= 1 ? "var(--good)" : "var(--ink-2)" }}
                      >
                        {x.m.roas > 0 ? `${dec(x.m.roas)}×` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Cartao>
          </div>

          <p className="shrink-0 text-[11px] leading-relaxed text-[var(--ink-muted)]">
            Cidade é a localização de quem viu o anúncio, não o alvo configurado na campanha — por
            isso aparecem cidades vizinhas ao evento. O relatório geográfico do Google não aceita
            filtro por status de campanha, então as pausadas são descartadas aqui pelo nome.
          </p>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    // `notFound()` sinaliza por exceção — deixa passar antes de tratar falha.
    if (ehControleNext(e)) throw e;
    const msg = e instanceof GoogleAdsError ? explicarErroAds(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Segmentação" sub={subtituloEscopo(escopo)}>
        <ErroMeta titulo="Falha ao carregar a Google Ads API" detalhe={msg} />
      </Shell>
    );
  }
}
