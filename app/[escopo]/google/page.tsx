import { notFound } from "next/navigation";
import { ErroMeta, Linha, Pagina, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao, Etiqueta, Hero, Secao, Stat } from "@/components/ui";
import { AreaTempo, Medidor, type SerieTempo } from "@/components/charts";
import { carregarAds, CANAL_LABEL, type FatiaCanalAds } from "@/lib/ads";
import { explicarErroAds, GoogleAdsError, REVALIDATE_ADS } from "@/lib/googleAds";
import { ehControleNext } from "@/lib/erroNext";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { ehEscopoValido, ESCOPOS, type EscopoSlug } from "@/lib/config";
import { brl, brlCompact, brlCurto, compact, dec, diaMesCurto, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE_ADS;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

/** Nome curto da campanha: o canal já tem coluna própria. */
function nomeCurto(nome: string): string {
  const tags = nome.match(/\[([^\]]+)\]/g) ?? [];
  const praca = tags.find((t) => /AFROPUNK/i.test(t));
  return praca ? praca.replace(/[[\]]/g, "").replace(/AFROPUNK\s*-\s*/i, "").trim() : nome;
}

export default async function GoogleAds({
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
    const d = await carregarAds(escopo, periodo);

    /*
     * Sem campanha, sem página: a rota some da lateral e o acesso direto cai em
     * 404. Uma tela dizendo "não há nada aqui" é um beco — o Overview já
     * informa que a praça não tem esse canal no ar.
     */
    if (!d.ativo) notFound();

    const t = d.total;
    const cor = d.praca?.cor ?? "var(--todas)";
    const janela =
      d.primeiroDia && d.ultimoDia
        ? `${diaMesCurto(d.primeiroDia)} – ${diaMesCurto(d.ultimoDia)}`
        : "sem dados";

    const orcamentoDiario = d.campanhas.reduce((a, c) => a + c.orcamentoDiario, 0);

    /**
     * Nesta página, COR = CANAL. Pesquisa e Performance Max são produtos
     * diferentes — intenção declarada contra descoberta automática — e rendem
     * de forma muito distinta; pintar os dois igual convidaria a ler o Google
     * como um bloco só. A praça é o escopo da página, então não disputa cor.
     */
    const CORES_CANAL = ["var(--par-a)", "var(--par-b)"];
    const corDoCanal = (canal: string) =>
      CORES_CANAL[d.canais.findIndex((c) => c.canal === canal)] ?? cor;

    const seriesCusto: SerieTempo[] = d.canais.map((c) => ({
      chave: `custo_${c.canal}`,
      nome: c.nome,
      cor: corDoCanal(c.canal),
    }));
    return (
      <Shell
        escopo={escopo}
        titulo="Google Ads"
        sub={subtituloEscopo(escopo, `${d.campanhas.length} campanhas ativas · ${janela}`)}
        acoes={<Etiqueta variante="contorno">Conectado</Etiqueta>}
      >
        <Pagina>
          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(250px,1.1fr)_repeat(5,1fr)] lg:gap-5 lg:px-5">
            <Hero rotulo="Investido" valor={brl(t.custo)} sub={`${janela} · BRL`} />
            <Stat
              rotulo="Receita"
              valor={brlCompact(t.receita)}
              sub={`${brl(t.receita)} · ${int(t.conversoes)} conversões`}
            />
            <Stat
              rotulo="ROAS"
              valor={t.roas > 0 ? `${dec(t.roas)}×` : "—"}
              sub="média dos dois canais"
            />
            <Stat
              rotulo="CPA"
              valor={t.conversoes > 0 ? brl(t.cpa) : "—"}
              sub={t.conversoes > 0 ? "custo por conversão" : undefined}
            />
            <Stat rotulo="Cliques" valor={compact(t.cliques)} sub={`CTR ${pct(t.ctr)}`} />
            <Stat rotulo="CPC médio" valor={brl(t.cpc)} sub={`${compact(t.impressoes)} impressões`} />
          </div>

          <Secao>Pesquisa × Performance Max</Secao>

          {/* Uma série por canal, empilhada: a pilha dá o total do dia sem
              esconder que os dois produtos entram em ritmos diferentes. Ao
              lado, cada canal com ROAS e CPA próprios — a média do Google
              esconde que Pesquisa e PMax rendem em ordens distintas. */}
          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_330px]">
            <Cartao
              titulo="Investimento por dia"
              sub="Empilhado por canal — a pilha inteira é o total do dia"
            >
              <div className="h-[var(--h-grafico)]">
                <AreaTempo dados={d.serie} series={seriesCusto} formato="brl" empilhar />
              </div>
            </Cartao>

            <Cartao className="flex flex-col justify-center gap-2.5">
              {d.canais.map((c) => (
                <ResumoCanal
                  key={c.canal}
                  fatia={c}
                  cor={corDoCanal(c.canal)}
                  share={t.custo > 0 ? (c.total.custo / t.custo) * 100 : 0}
                />
              ))}
              {!d.comparativo && orcamentoDiario > 0 && (
                <Medidor
                  valor={t.custo}
                  limite={orcamentoDiario * Math.max(d.serie.length, 1)}
                  rotulo="Verba do período"
                  cor={cor}
                />
              )}
            </Cartao>
          </Linha>

          <Secao>Campanhas ativas</Secao>

          <div className="shrink-0">
            <Cartao className="min-w-0">
              <div className="max-h-[var(--h-tabela)] overflow-auto">
                <table className="w-full" style={{ fontSize: "var(--fs-corpo)" }}>
                  <thead>
                    <tr className="text-left uppercase tracking-[0.1em] text-[var(--ink-muted)] [font-size:var(--fs-micro)]">
                      <th className="pb-2 pr-3 font-semibold">Canal</th>
                      <th className="pb-2 pr-3 font-semibold">Campanha</th>
                      <th className="pb-2 pr-3 text-right font-semibold">Investido</th>
                      <th className="pb-2 pr-3 text-right font-semibold">Receita</th>
                      <th className="pb-2 pr-3 text-right font-semibold">ROAS</th>
                      <th className="pb-2 pr-3 text-right font-semibold">Conv.</th>
                      <th className="pb-2 pr-3 text-right font-semibold">CPA</th>
                      <th className="pb-2 text-right font-semibold">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {[...d.campanhas]
                      .sort((a, b) => b.m.receita - a.m.receita)
                      .map((c) => (
                        <tr
                          key={c.id}
                          className="border-t border-[var(--border)] text-[var(--ink-2)]"
                        >
                          <td className="py-2 pr-3 font-medium text-[var(--ink)]">
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              <span
                                aria-hidden="true"
                                className="block h-2 w-2 shrink-0 rotate-45"
                                style={{ background: corDoCanal(c.canal) }}
                              />
                              {CANAL_LABEL[c.canal] ?? c.canal}
                            </span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap" title={c.nome}>
                            {nomeCurto(c.nome)}
                          </td>
                          <td className="py-2 pr-3 text-right">{brl(c.m.custo)}</td>
                          <td className="py-2 pr-3 text-right font-semibold text-[var(--ink)]">
                            {c.m.receita > 0 ? brl(c.m.receita) : "—"}
                          </td>
                          <td
                            className="py-2 pr-3 text-right font-semibold"
                            style={{ color: c.m.roas >= 1 ? "var(--good)" : "var(--ink-2)" }}
                          >
                            {c.m.roas > 0 ? `${dec(c.m.roas)}×` : "—"}
                          </td>
                          <td className="py-2 pr-3 text-right">{int(c.m.conversoes)}</td>
                          <td className="py-2 pr-3 text-right">
                            {c.m.conversoes > 0 ? brl(c.m.cpa) : "—"}
                          </td>
                          <td className="py-2 text-right">{pct(c.m.ctr)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Cartao>
          </div>

          <p className="shrink-0 text-[var(--fs-corpo)] leading-relaxed text-[var(--ink-muted)]">
            A praça vem do nome da campanha, pelo mesmo mapeador usado no Meta. Hoje o Google Ads
            cobre apenas Rio de Janeiro e Salvador — Recife não tem campanha no canal. Campanhas
            pausadas de edições anteriores (Belém, São Paulo, 2025) ficam fora.
          </p>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    // `notFound()` sinaliza por exceção — deixa passar antes de tratar falha.
    if (ehControleNext(e)) throw e;
    const msg = e instanceof GoogleAdsError ? explicarErroAds(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Google Ads" sub={subtituloEscopo(escopo)}>
        <ErroMeta titulo="Falha ao carregar a Google Ads API" detalhe={msg} />
      </Shell>
    );
  }
}

/** Linha de canal: ROAS e CPA próprios, para não somar Pesquisa com PMax. */
function ResumoCanal({
  fatia,
  cor,
  share,
}: {
  fatia: FatiaCanalAds;
  cor: string;
  share: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="block h-2.5 w-2.5 shrink-0 rotate-45"
          style={{ background: cor }}
        />
        <span
          className="min-w-0 flex-1 truncate font-semibold"
          style={{ fontSize: "var(--fs-corpo)" }}
        >
          {fatia.nome}
        </span>
        <span className="tabular shrink-0 text-[var(--fs-corpo)] text-[var(--ink-muted)]">
          {pct(share, 0)} da verba
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <MiniCanal rotulo="Investido" valor={brlCurto(fatia.total.custo)} />
        <MiniCanal
          rotulo="ROAS"
          valor={fatia.total.roas > 0 ? `${dec(fatia.total.roas)}×` : "—"}
          cor={cor}
        />
        <MiniCanal
          rotulo="CPA"
          valor={fatia.total.conversoes > 0 ? brl(fatia.total.cpa) : "—"}
        />
        <MiniCanal rotulo="CTR" valor={pct(fatia.total.ctr, 1)} />
      </div>
    </div>
  );
}

function MiniCanal({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="rotulo">{rotulo}</span>
      <span
        className="tabular mt-1 truncate font-bold leading-none"
        style={{ fontSize: "var(--fs-kpi-sm)", ...(cor ? { color: cor } : {}) }}
        title={valor}
      >
        {valor}
      </span>
    </div>
  );
}
