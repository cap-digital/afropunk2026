import { notFound } from "next/navigation";
import { ErroMeta, Shell, subtituloEscopo, Linha, Pagina } from "@/components/Shell";
import { Cartao, Stat, Vazio } from "@/components/ui";
import { BarrasAgrupadas, BarrasH, EmpilhadaTotal, MapaCalor, type PontoGrafico } from "@/components/charts";
import { carregarBreakdowns, carregarEscopo } from "@/lib/dados";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import { explicarErroMeta, MetaError, REVALIDATE } from "@/lib/meta";
import {
  ehEscopoValido,
  ESCOPOS,
  PLATAFORMA_LABEL,
  POSICIONAMENTO_LABEL,
  type EscopoSlug,
} from "@/lib/config";
import { brl, compact, pct } from "@/lib/format";

export const revalidate = REVALIDATE;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

export default async function MetaPosicionamentos({
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
        <Shell escopo={escopo} titulo="Meta Ads · Posicionamentos" sub={subtituloEscopo(escopo, undefined, periodo)}>
          <div className="cartao h-[37.5rem]">
            <Vazio
              titulo="Sem dados de posicionamento"
              descricao="O mapa de plataformas e posicionamentos aparece assim que houver entrega registrada."
            />
          </div>
        </Shell>
      );
    }

    const bd = await carregarBreakdowns(d);

    const plataformasUnicas = [...new Set(bd.posicionamentos.map((p) => p.chave))];
    const posicoesUnicas = [...new Set(bd.posicionamentos.map((p) => p.chave2 ?? "unknown"))].slice(0, 7);
    const linhas = plataformasUnicas.map((p) => PLATAFORMA_LABEL[p] ?? p);
    const colunas = posicoesUnicas.map((p) => POSICIONAMENTO_LABEL[p] ?? p);
    const valores = new Map<string, number>();
    for (const l of bd.posicionamentos) {
      const lin = PLATAFORMA_LABEL[l.chave] ?? l.chave;
      const col = POSICIONAMENTO_LABEL[l.chave2 ?? "unknown"] ?? l.chave2 ?? "—";
      if (!colunas.includes(col)) continue;
      valores.set(`${lin}||${col}`, (valores.get(`${lin}||${col}`) ?? 0) + l.impressions);
    }

    const totalImpr = bd.plataformas.reduce((a, p) => a + p.impressions, 0) || 1;
    const principal = bd.plataformas[0];

    const porPosicionamento: PontoGrafico[] = [...bd.posicionamentos]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 7)
      .map((p) => ({
        nome: POSICIONAMENTO_LABEL[p.chave2 ?? ""] ?? p.chave2 ?? "—",
        valor: p.impressions,
      }));

    const cpmPorPlataforma: PontoGrafico[] = bd.plataformas
      .filter((p) => p.impressions > 500)
      .map((p) => ({
        nome: PLATAFORMA_LABEL[p.chave] ?? p.chave,
        valor: (p.spend / p.impressions) * 1000,
      }))
      .sort((a, b) => Number(b.valor) - Number(a.valor));

    // Comparativo: share do Instagram (ou da plataforma principal) por praça.
    const mixPorBucket: PontoGrafico[] = plataformasUnicas.slice(0, 3).map((plat) => {
      const linha: PontoGrafico = { nome: PLATAFORMA_LABEL[plat] ?? plat };
      for (const f of d.fatias) {
        const lb = bd.porBucket.get(f.bucket.slug)?.plataformas ?? [];
        const tot = lb.reduce((a, l) => a + l.impressions, 0) || 1;
        const naPlat = lb.filter((l) => l.chave === plat).reduce((a, l) => a + l.impressions, 0);
        linha[f.bucket.slug] = Number(((naPlat / tot) * 100).toFixed(2));
      }
      return linha;
    });
    const seriesBuckets = d.fatias
      .map((f) => ({ chave: f.bucket.slug, nome: f.bucket.nome, cor: f.bucket.cor }));

    return (
      <Shell
        escopo={escopo}
        titulo="Meta Ads · Posicionamentos"
        sub={subtituloEscopo(escopo, undefined, periodo)}
      >
        <Pagina>
          <div className="cartao grid grid-cols-2 items-center gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5 lg:px-5">
            <Stat
              rotulo="Plataforma principal"
              valor={PLATAFORMA_LABEL[principal?.chave ?? ""] ?? "—"}
              sub={principal ? `${pct((principal.impressions / totalImpr) * 100, 1)} das impressões` : undefined}
            />
            <Stat rotulo="Plataformas" valor={String(bd.plataformas.length)} sub="com entrega" />
            <Stat rotulo="Posicionamentos" valor={String(bd.posicionamentos.length)} sub="combinações ativas" />
            <Stat rotulo="Impressões" valor={compact(d.total.impressions)} />
            <Stat rotulo="CPM médio" valor={brl(d.total.cpm)} sub={`CPC ${brl(d.total.cpc)}`} />
          </div>

          {/* Dentro de `Linha`, não solto na coluna: `h-full` num filho direto
              da página pede a altura inteira para si, o flex encolhe de volta e
              sobra buraco embaixo. `Linha` distribui o espaço de verdade. */}
          <Linha>
            <Cartao
              titulo="Mapa de entrega: plataforma × posicionamento"
              sub="Impressões por combinação — rampa sequencial, mais claro é mais volume"
            >
              <div className="h-[var(--h-grafico)]">
                <MapaCalor linhas={linhas} colunas={colunas} valores={valores} formato="int" />
              </div>
            </Cartao>
          </Linha>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Cartao titulo="Top posicionamentos" sub="Onde o volume realmente acontece">
              <div className="h-[var(--h-grafico)]">
                <BarrasH dados={porPosicionamento} formato="int" corUnica="var(--seq-2)" larguraRotulo={128} />
              </div>
            </Cartao>

            {d.comparativo ? (
              <Cartao
                titulo="Mix de plataformas por praça"
                sub="% das impressões de cada praça em cada plataforma"
              >
                <div className="h-[var(--h-grafico)]">
                  <BarrasAgrupadas dados={mixPorBucket} series={seriesBuckets} formato="pct" />
                </div>
              </Cartao>
            ) : (
              <Cartao
                titulo="Custo por mil por plataforma"
                sub="Só plataformas com mais de 500 impressões — abaixo disso o CPM é ruído"
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="h-[var(--h-grafico)]">
                    <BarrasH dados={cpmPorPlataforma} formato="brl" corUnica="var(--seq-3)" larguraRotulo={128} />
                  </div>
                  <EmpilhadaTotal
                    segmentos={bd.plataformas.slice(0, 3).map((p, i) => ({
                      nome: PLATAFORMA_LABEL[p.chave] ?? p.chave,
                      valor: p.impressions,
                      cor: ["var(--seq-2)", "var(--seq-4)", "var(--seq-1)"][i],
                    }))}
                    formato="int"
                  />
                </div>
              </Cartao>
            )}
          </Linha>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    const msg = e instanceof MetaError ? explicarErroMeta(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Meta Ads · Posicionamentos" sub={subtituloEscopo(escopo, undefined, periodo)}>
        <ErroMeta titulo="Falha ao carregar a Marketing API" detalhe={msg} />
      </Shell>
    );
  }
}
