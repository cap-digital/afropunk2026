import Link from "next/link";
import { notFound } from "next/navigation";
import { ErroMeta, Linha, Pagina, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao, Etiqueta, Hero, Secao, Stat } from "@/components/ui";
import { AreaTempo, BarrasAgrupadas, EmpilhadaTotal, type PontoGrafico } from "@/components/charts";
import { carregarEscopo } from "@/lib/dados";
import { periodoDeParams, type ParamsBusca } from "@/lib/periodo";
import {
  explicarErroMeta,
  MetaError,
  METRICAS_ZERO,
  REVALIDATE,
  type Metricas,
} from "@/lib/meta";
import { ehEscopoValido, ESCOPOS, type EscopoSlug } from "@/lib/config";
import { brl, compact, dec, diaMesCurto, int, pct } from "@/lib/format";

export const revalidate = REVALIDATE;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

/**
 * Canais de mídia. As cores são o par binário já validado (azul/laranja),
 * fora das quatro cores de praça — praça é identidade de entidade.
 */
interface Canal {
  slug: string;
  nome: string;
  cor: string;
  conectado: boolean;
  href: (e: EscopoSlug) => string;
}

const CANAIS: Canal[] = [
  {
    slug: "meta",
    nome: "Meta Ads",
    cor: "var(--par-a)",
    conectado: true,
    href: (e) => `/${e}/meta`,
  },
  {
    slug: "google",
    nome: "Google Ads",
    cor: "var(--par-b)",
    conectado: false,
    href: (e) => `/${e}/google`,
  },
];

export default async function VisaoGeralGlobal({
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

    // Google ainda não tem API: entra zerado e explicitamente marcado como tal,
    // para que os totais nunca deem a impressão de já incluir o canal.
    const porCanal: Record<string, Metricas> = {
      meta: d.total,
      google: METRICAS_ZERO,
    };

    const total: Metricas = d.total; // soma dos canais conectados
    const janela =
      d.primeiroDia && d.ultimoDia
        ? `${diaMesCurto(d.primeiroDia)} – ${diaMesCurto(d.ultimoDia)}`
        : "sem dados";

    const serie: PontoGrafico[] = d.serie.map((p) => ({
      date: p.date,
      meta: p.spend,
      google: 0,
    }));

    const comparativo: PontoGrafico[] = [
      { nome: "Investimento", meta: total.spend, google: 0 },
      { nome: "Receita", meta: total.purchaseValue, google: 0 },
    ];

    return (
      <Shell
        escopo={escopo}
        titulo="Overview"
        sub={subtituloEscopo(escopo, `Meta + Google · ${janela}`, periodo)}
      >
        <Pagina>
          <Secao cor="var(--par-a)">Consolidado de mídia</Secao>

          <div className="cartao grid shrink-0 grid-cols-2 items-center gap-5 px-5 py-4 lg:grid-cols-[minmax(250px,1.1fr)_repeat(5,1fr)]">
            <Hero
              rotulo="Investimento total"
              valor={brl(total.spend)}
              sub={`${janela} · canais conectados`}
            />
            <Stat rotulo="Receita" valor={brl(total.purchaseValue)} cor="var(--par-a)" />
            <Stat
              rotulo="ROAS consolidado"
              valor={total.roas > 0 ? `${dec(total.roas)}×` : "—"}
              sub={total.roas > 0 ? `sobre ${brl(total.spendConversao)} em conversão` : "sem receita"}
            />
            <Stat rotulo="Compras" valor={int(total.purchases)} />
            <Stat
              rotulo="CPA"
              valor={total.purchases > 0 ? brl(total.cpa) : "—"}
              sub={total.purchases > 0 ? "só campanhas de conversão" : undefined}
            />
            <Stat
              rotulo="Impressões"
              valor={compact(total.impressions)}
              sub={`CTR ${pct(total.ctr)}`}
            />
          </div>

          <Secao cor="var(--par-a)">Canais</Secao>

          <div className="grid shrink-0 grid-cols-1 gap-3.5 lg:grid-cols-2">
            {CANAIS.map((c) => {
              const m = porCanal[c.slug];
              const share = total.spend > 0 ? (m.spend / total.spend) * 100 : 0;
              return (
                <Link
                  key={c.slug}
                  href={c.href(escopo)}
                  className="cartao group flex items-center gap-5 px-5 py-4 transition-colors hover:border-[var(--border-forte)]"
                >
                  <span
                    aria-hidden="true"
                    className="block h-3.5 w-3.5 shrink-0 rotate-45"
                    style={{ background: c.cor, opacity: c.conectado ? 1 : 0.4 }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="marca text-[19px] leading-none">{c.nome}</h3>
                      <Etiqueta variante="contorno" cor={c.conectado ? undefined : "var(--ink-muted)"}>
                        {c.conectado ? "Conectado" : "Não conectado"}
                      </Etiqueta>
                    </div>
                    <p className="mt-1.5 text-[12px] text-[var(--ink-muted)]">
                      {c.conectado
                        ? `${pct(share, 1)} do investimento · ${int(m.purchases)} compras`
                        : "Sem dados até a credencial da API chegar"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-7 sm:flex">
                    <MiniCanal rotulo="Investido" valor={c.conectado ? brl(m.spend) : "—"} />
                    <MiniCanal rotulo="Receita" valor={c.conectado ? brl(m.purchaseValue) : "—"} />
                    <MiniCanal
                      rotulo="ROAS"
                      valor={c.conectado && m.roas > 0 ? `${dec(m.roas)}×` : "—"}
                    />
                  </div>
                  <span className="shrink-0 text-[20px] leading-none text-[var(--ink-muted)] transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              );
            })}
          </div>

          <Secao cor="var(--par-a)">Meta × Google</Secao>

          <Linha className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.35fr_1fr]">
            <Cartao
              titulo="Investimento diário por canal"
              sub="Google entra nesta série assim que a API for conectada"
              className="h-full"
              cor="var(--par-a)"
            >
              <div className="h-[260px] lg:h-full">
                <AreaTempo
                  dados={serie}
                  series={[
                    { chave: "meta", nome: "Meta Ads", cor: "var(--par-a)" },
                    { chave: "google", nome: "Google Ads", cor: "var(--par-b)" },
                  ]}
                  formato="brl"
                />
              </div>
            </Cartao>

            <Cartao
              titulo="Investimento e receita por canal"
              sub="Mesma unidade (R$) — comparação direta"
              className="h-full"
              cor="var(--par-b)"
            >
              <div className="flex h-full flex-col justify-evenly gap-4">
                <div className="h-[58%]">
                  <BarrasAgrupadas
                    dados={comparativo}
                    series={[
                      { chave: "meta", nome: "Meta Ads", cor: "var(--par-a)" },
                      { chave: "google", nome: "Google Ads", cor: "var(--par-b)" },
                    ]}
                    formato="brl"
                  />
                </div>
                <EmpilhadaTotal
                  segmentos={CANAIS.filter((c) => porCanal[c.slug].spend > 0).map((c) => ({
                    nome: c.nome,
                    valor: porCanal[c.slug].spend,
                    cor: c.cor,
                  }))}
                  formato="brl"
                />
              </div>
            </Cartao>
          </Linha>
        </Pagina>
      </Shell>
    );
  } catch (e) {
    const msg = e instanceof MetaError ? explicarErroMeta(e) : (e as Error).message;
    return (
      <Shell escopo={escopo} titulo="Overview" sub={subtituloEscopo(escopo, undefined, periodo)}>
        <ErroMeta titulo="Falha ao carregar a Marketing API" detalhe={msg} />
      </Shell>
    );
  }
}

function MiniCanal({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="rotulo">{rotulo}</span>
      <span className="tabular mt-0.5 text-[17px] font-bold leading-none">{valor}</span>
    </div>
  );
}
