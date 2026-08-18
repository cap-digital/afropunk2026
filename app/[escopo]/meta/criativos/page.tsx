import { notFound } from "next/navigation";
import { ErroMeta, Shell, subtituloEscopo, Pagina } from "@/components/Shell";
import { Cartao, CartaoKpi, GradeKpi, Vazio } from "@/components/ui";
import { DestaqueCriativo } from "@/components/Criativos";
import { GradeCriativos } from "@/components/GradeCriativos";
import { carregarCriativos, carregarEscopo } from "@/lib/dados";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { explicarErroMeta, MetaError, REVALIDATE, somar } from "@/lib/meta";
import { ehEscopoValido, ESCOPOS, type EscopoSlug } from "@/lib/config";
import { brl, compact, pct } from "@/lib/format";

export const revalidate = REVALIDATE;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

export default async function MetaCriativos({
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
    const criativos = await carregarCriativos(d);

    if (criativos.length === 0) {
      return (
        <Shell escopo={escopo} titulo="Meta Ads · Criativos" sub={subtituloEscopo(escopo, undefined, periodo)}>
          <div className="cartao flex min-h-[26rem] flex-1 lg:h-full">
            <Vazio
              titulo="Nenhum criativo em veiculação"
              descricao="Os anúncios aparecem aqui com preview, métricas e botão direto para o post no Instagram assim que a campanha entrar no ar."
            />
          </div>
        </Shell>
      );
    }

    const total = somar(criativos.map((c) => c.m));
    const ordenados = [...criativos].sort((a, b) => b.m.spend - a.m.spend);
    const comPermalink = criativos.filter((c) => c.permalink).length;


    return (
      <Shell
        escopo={escopo}
        titulo="Meta Ads · Criativos"
        sub={subtituloEscopo(escopo, `${criativos.length} anúncios · ${comPermalink} com link do Instagram`)}
      >
        <Pagina>
          <div className="grid shrink-0 grid-cols-1 gap-[var(--esp-grade)] lg:grid-cols-[1.05fr_1fr]">
            <GradeKpi colunas="lg:grid-cols-4">
              <CartaoKpi rotulo="Anúncios" valor={String(criativos.length)} />
              <CartaoKpi rotulo="Investido" valor={brl(total.spend)} />
              <CartaoKpi rotulo="Impressões" valor={compact(total.impressions)} />
              <CartaoKpi rotulo="CTR médio" valor={pct(total.ctr)} />
            </GradeKpi>
            <DestaqueCriativo criativos={criativos} />
          </div>

          <Cartao
            titulo="Galeria de criativos"
            sub="Ordene pela métrica que importa · clique no card para abrir o post no Instagram"
          >
            {/* Sem teto nem rolagem aqui: a grade já tem os dois, por dentro, e
                é o que mantém os botões de ordenação parados enquanto as
                imagens rolam. Empilhados, os dois scrollers levavam a barra de
                ordenação embora junto com o conteúdo que ela ordena. */}
            <GradeCriativos criativos={ordenados} />
          </Cartao>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    const msg = e instanceof MetaError ? explicarErroMeta(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Meta Ads · Criativos" sub={subtituloEscopo(escopo, undefined, periodo)}>
        <ErroMeta titulo="Falha ao carregar a Marketing API" detalhe={msg} />
      </Shell>
    );
  }
}
