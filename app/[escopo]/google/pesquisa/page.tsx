import { notFound } from "next/navigation";
import { IconGauge, IconSearch } from "@tabler/icons-react";
import { ErroMeta, Linha, Pagina, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao, Hero, Secao, Stat } from "@/components/ui";
import { EmpilhadaTotal } from "@/components/charts";
import { TabelaOrdenavel } from "@/components/TabelaOrdenavel";
import {
  carregarPesquisa,
} from "@/lib/adsDetalhe";
import { explicarErroAds, GoogleAdsError, REVALIDATE_ADS } from "@/lib/googleAds";
import { ehControleNext } from "@/lib/erroNext";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { ehEscopoValido, ESCOPOS, type EscopoSlug } from "@/lib/config";
import { brl, brlCompact, compact, dec, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE_ADS;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

/** Faixa do índice de qualidade — 1 a 10, com o corte usual do Google. */
function faixaQualidade(q: number | null): { rotulo: string; cor: string } {
  if (q === null) return { rotulo: "Sem índice", cor: "var(--ink-muted)" };
  if (q >= 8) return { rotulo: "Alta", cor: "var(--good)" };
  if (q >= 5) return { rotulo: "Média", cor: "var(--par-b)" };
  return { rotulo: "Baixa", cor: "var(--critical)" };
}

export default async function Pesquisa({
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
    const d = await carregarPesquisa(escopo, periodo);

    /*
     * Sem campanha, sem página: a rota some da lateral e o acesso direto cai em
     * 404. Uma tela dizendo "não há nada aqui" é um beco — o Overview já
     * informa que a praça não tem esse canal no ar.
     */
    if (!d.ativo) notFound();

    const t = d.total;



    // Distribuição do investimento por faixa de qualidade — mostra se o gasto
    // está indo para palavra que o Google considera relevante.
    const porFaixa = new Map<string, number>();
    for (const p of d.palavras) {
      const f = faixaQualidade(p.qualidade).rotulo;
      porFaixa.set(f, (porFaixa.get(f) ?? 0) + p.m.custo);
    }
    const ORDEM_FAIXA = ["Alta", "Média", "Baixa", "Sem índice"];
    const faixas = ORDEM_FAIXA.filter((f) => (porFaixa.get(f) ?? 0) > 0).map((f) => ({
      nome: f,
      valor: porFaixa.get(f) ?? 0,
      cor: faixaQualidade(f === "Alta" ? 10 : f === "Média" ? 6 : f === "Baixa" ? 3 : null).cor,
    }));

    const comQualidade = d.palavras.filter((p) => p.qualidade !== null);
    const qualidadeMedia =
      comQualidade.length > 0
        ? comQualidade.reduce((a, p) => a + (p.qualidade ?? 0) * p.m.impressoes, 0) /
          Math.max(
            comQualidade.reduce((a, p) => a + p.m.impressoes, 0),
            1,
          )
        : 0;

    return (
      <Shell
        escopo={escopo}
        titulo="Pesquisa"
        sub={subtituloEscopo(escopo, `${d.palavras.length} palavras-chave com impressão`)}
      >
        <Pagina>
          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-[minmax(240px,1.1fr)_repeat(5,1fr)] lg:gap-5 lg:px-5">
            <Hero rotulo="Investido em Pesquisa" valor={brl(t.custo)} sub="soma das palavras-chave" />
            <Stat
              rotulo="Receita"
              valor={brlCompact(t.receita)}
              sub={`${int(t.conversoes)} conversões`}
            />
            <Stat rotulo="ROAS" valor={t.roas > 0 ? `${dec(t.roas)}×` : "—"} />
            <Stat rotulo="CPC médio" valor={brl(t.cpc)} sub={`CTR ${pct(t.ctr)}`} />
            <Stat
              rotulo="Qualidade"
              valor={qualidadeMedia > 0 ? dec(qualidadeMedia) : "—"}
              sub={qualidadeMedia > 0 ? "índice médio · 1 a 10" : "ainda sem índice"}
            />
            <Stat rotulo="Cliques" valor={compact(t.cliques)} sub={`${compact(t.impressoes)} impr.`} />
          </div>

          <Secao icone={IconGauge}>Qualidade das palavras</Secao>

          {/* O índice de qualidade não é número de apresentação — é diagnóstico:
              diz se o dinheiro está indo para palavra que o Google considera
              relevante. Fica como faixa, não como coluna da tabela. */}
          <div className="cartao shrink-0 px-5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="rotulo">Investimento por índice de qualidade</span>
              <span className="text-[11px] text-[var(--ink-muted)]">
                {faixas[0]?.nome === "Alta"
                  ? "A maior fatia está em palavra bem avaliada"
                  : "Boa parte do gasto está fora da faixa alta"}
              </span>
            </div>
            <div className="mt-2">
              <EmpilhadaTotal segmentos={faixas} formato="brl" />
            </div>
          </div>

          <Secao icone={IconSearch}>Palavras-chave</Secao>

          <Linha>
            <Cartao className="h-full min-w-0">
              <TabelaOrdenavel
                colunas={[
                  { chave: "texto", rotulo: "Palavra-chave" },
                  { chave: "custo", rotulo: "Investido", formato: "brl" },
                  { chave: "cpc", rotulo: "CPC", formato: "brl" },
                  { chave: "cliques", rotulo: "Cliques", formato: "int" },
                  { chave: "conversoes", rotulo: "Conv.", formato: "conv" },
                  { chave: "receita", rotulo: "Receita", formato: "brl", enfase: true },
                  { chave: "roas", rotulo: "ROAS", formato: "roas", destacarBom: true },
                ]}
                linhas={d.palavras.map((p) => ({
                  id: p.chave,
                  cor: escopo === "todas-as-pracas" ? p.bucket.cor : undefined,
                  titulo: p.texto,
                  texto: p.texto,
                  custo: p.m.custo,
                  cpc: p.m.cpc,
                  cliques: p.m.cliques,
                  conversoes: p.m.conversoes,
                  receita: p.m.receita,
                  roas: p.m.roas,
                }))}
                ordenarPor="custo"
              />
            </Cartao>
          </Linha>

          <p className="shrink-0 text-[11px] leading-relaxed text-[var(--ink-muted)]">
            A mesma palavra em grupos de anúncios diferentes vira uma linha só, e palavras sem
            impressão no período ficam fora. O índice de qualidade continua alimentando a
            distribuição de investimento acima — ele é diagnóstico da conta, não número de
            apresentação.
          </p>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    // `notFound()` sinaliza por exceção — deixa passar antes de tratar falha.
    if (ehControleNext(e)) throw e;
    const msg = e instanceof GoogleAdsError ? explicarErroAds(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Pesquisa" sub={subtituloEscopo(escopo)}>
        <ErroMeta titulo="Falha ao carregar a Google Ads API" detalhe={msg} />
      </Shell>
    );
  }
}
