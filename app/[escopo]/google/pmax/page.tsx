/* eslint-disable @next/next/no-img-element -- ver nota na galeria */
import { notFound } from "next/navigation";
import { IconPhoto, IconTextCaption } from "@tabler/icons-react";
import { ErroMeta, Linha, Pagina, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao, Etiqueta, Hero, Secao, Stat } from "@/components/ui";
import { PecasPmax } from "@/components/PecasPmax";
import {
  carregarPmax,
  FORCA_LABEL,
  type AtivoPmax,
} from "@/lib/adsDetalhe";
import { explicarErroAds, GoogleAdsError, REVALIDATE_ADS } from "@/lib/googleAds";
import { ehControleNext } from "@/lib/erroNext";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { ehEscopoValido, ESCOPOS, type EscopoSlug } from "@/lib/config";
import { brl, brlCompact, brlCurto, compact, dec, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE_ADS;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

export default async function Pmax({
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
    const d = await carregarPmax(escopo, periodo);

    /*
     * Sem campanha, sem página: a rota some da lateral e o acesso direto cai em
     * 404. Uma tela dizendo "não há nada aqui" é um beco — o Overview já
     * informa que a praça não tem esse canal no ar.
     */
    if (!d.ativo) notFound();

    const t = d.total;
    const forcas = [...new Set(d.grupos.map((g) => g.forca))];

    return (
      <Shell
        escopo={escopo}
        titulo="Performance Max"
        sub={subtituloEscopo(
          escopo,
          `${d.grupos.length} grupo${d.grupos.length > 1 ? "s" : ""} de recursos · ${d.imagens.length} imagens`,
        )}
        acoes={
          forcas.length === 1 ? (
            <Etiqueta
              variante="contorno"
              tom={
                forcas[0] === "EXCELLENT" || forcas[0] === "GOOD"
                  ? "bom"
                  : forcas[0] === "POOR"
                    ? "critico"
                    : forcas[0] === "AVERAGE"
                      ? "alerta"
                      : "apagado"
              }
            >
              Força {FORCA_LABEL[forcas[0]] ?? forcas[0]}
            </Etiqueta>
          ) : undefined
        }
      >
        <Pagina>
          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(240px,1.1fr)_repeat(5,1fr)] lg:gap-5 lg:px-5">
            <Hero rotulo="Investido em PMax" valor={brl(t.custo)} sub="grupos de recursos ativos" />
            <Stat
              rotulo="Receita"
              valor={brlCompact(t.receita)}
              sub={`${int(t.conversoes)} conversões`}
            />
            <Stat rotulo="ROAS" valor={t.roas > 0 ? `${dec(t.roas)}×` : "—"} />
            <Stat rotulo="CPA" valor={t.conversoes > 0 ? brl(t.cpa) : "—"} />
            <Stat rotulo="Cliques" valor={compact(t.cliques)} sub={`CTR ${pct(t.ctr)}`} />
            <Stat rotulo="CPC médio" valor={brl(t.cpc)} sub={`${compact(t.impressoes)} impr.`} />
          </div>

          <Secao icone={IconPhoto}>Peças e textos por desempenho</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
            <Cartao
              titulo="Peças do grupo de recursos"
              sub={`${d.imagens.length} peças · sem logo, que entra em todo anúncio e lideraria sempre`}
              icone={IconPhoto}
              className="min-h-0"
            >
              <PecasPmax pecas={d.imagens} />
            </Cartao>

            <Cartao
              titulo="Textos por desempenho"
              sub="Mesma ordem: receita do anúncio que incluiu a peça"
              icone={IconTextCaption}
              className="min-h-0"
            >
              <div className="flex max-h-[var(--h-tabela)] flex-col gap-3.5 overflow-auto">
                <ListaTexto rotulo="Títulos" itens={d.titulos} />
                <ListaTexto rotulo="Descrições" itens={d.descricoes} />
              </div>
            </Cartao>
          </Linha>

          <p className="shrink-0 text-[11px] leading-relaxed text-[var(--ink-muted)]">
            No Performance Max o Google monta cada anúncio combinando várias peças, e a métrica é do
            anúncio que <em>incluiu</em> aquele ativo — a mesma impressão conta para o título, a
            imagem e o logo que apareceram juntos. Por isso a soma das peças passa do total da
            campanha, e o número serve para comparar peças entre si, não para somar.
          </p>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    // `notFound()` sinaliza por exceção — deixa passar antes de tratar falha.
    if (ehControleNext(e)) throw e;
    const msg = e instanceof GoogleAdsError ? explicarErroAds(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Performance Max" sub={subtituloEscopo(escopo)}>
        <ErroMeta titulo="Falha ao carregar a Google Ads API" detalhe={msg} />
      </Shell>
    );
  }
}

/** Texto do ativo com o resultado ao lado — a ordem já vem por receita. */
function ListaTexto({ rotulo, itens }: { rotulo: string; itens: AtivoPmax[] }) {
  if (!itens.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="rotulo">
        {rotulo} · {itens.length}
      </span>
      <ul className="flex flex-col">
        {itens.map((x, i) => (
          <li
            key={`${x.id}-${i}`}
            className="flex items-baseline gap-2 border-b border-[var(--border-sutil)] py-[5px] text-[12.5px] leading-snug text-[var(--ink-2)] last:border-b-0"
          >
            <span className="tabular w-[16px] shrink-0 text-[10.5px] text-[var(--ink-muted)]">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">{x.texto}</span>
            <span className="tabular shrink-0 text-[11.5px] font-semibold text-[var(--ink)]">
              {x.m.receita > 0 ? brlCurto(x.m.receita) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
