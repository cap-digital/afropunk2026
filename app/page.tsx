import Link from "next/link";
import Image from "next/image";
import { Losangos } from "@/components/Marca";
import { MarcaAnimada } from "@/components/MarcaAnimada";
import { Sparkline } from "@/components/charts";
import { carregarEscopo, type FatiaBucket } from "@/lib/dados";
import { explicarErroMeta, MetaError, REVALIDATE } from "@/lib/meta";
import { brl, brlCompact, dec } from "@/lib/format";
import { ESCOPO_TODAS, NACIONAL, PRACAS } from "@/lib/config";

export const revalidate = REVALIDATE;

export default async function Capa() {
  let dados: Awaited<ReturnType<typeof carregarEscopo>> | null = null;
  let erro: string | null = null;
  try {
    dados = await carregarEscopo(ESCOPO_TODAS);
  } catch (e) {
    erro = e instanceof MetaError ? explicarErroMeta(e) : (e as Error).message;
  }

  const fatia = (slug: string) => dados?.fatias.find((f) => f.bucket.slug === slug) ?? null;
  const nacional = fatia(NACIONAL.slug);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between overflow-hidden bg-[var(--bg)] px-8 py-8">
      <header className="flex shrink-0 flex-col items-center gap-3">
        <MarcaAnimada />
        <Losangos qtd={9} cor="var(--surface-3)" />
        <p className="surgir text-[12px] font-bold uppercase tracking-[0.32em] text-[var(--ink-muted)] [animation-delay:2.4s]">
          Dashboard de mídia · Selecione a praça
        </p>
      </header>

      {erro && (
        <div className="cartao max-w-[70ch] p-4 text-center">
          <p className="text-[13.5px] font-semibold text-[var(--critical)]">
            Não foi possível carregar os dados do Meta
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{erro}</p>
        </div>
      )}

      <div className="flex w-full max-w-[1120px] shrink-0 flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          {PRACAS.map((p) => (
            <CartaoPraca key={p.slug} slug={p.slug} nome={p.nome} marca={p.marca} local={p.local} cor={p.cor} f={fatia(p.slug)} />
          ))}
        </div>

        {/* Botão para o comparativo consolidado */}
        <Link
          href={`/${ESCOPO_TODAS}/meta`}
          className="group flex items-center gap-5 rounded-[6px] border-2 border-[var(--ink)] bg-[var(--ink)] px-5 py-4 text-black transition-colors hover:bg-[var(--ink-2)] hover:border-[var(--ink-2)]"
        >
          <Losangos qtd={4} cor="#000000" />
          <div className="min-w-0 flex-1">
            <h3 className="marca text-[23px] leading-none">Ver todas as praças juntas</h3>
            <p className="mt-1.5 text-[12px] font-medium opacity-70">
              Comparativo entre Rio, Recife e Salvador — mais a campanha nacional
            </p>
          </div>
          {nacional && dados && (
            <div className="flex items-center gap-7">
              <MiniStat rotulo="Investido" valor={brl(dados.total.spend)} />
              <MiniStat rotulo="Receita" valor={brl(dados.total.purchaseValue)} />
              <MiniStat
                rotulo="ROAS"
                valor={dados.total.roas > 0 ? `${dec(dados.total.roas)}\u00d7` : "\u2014"}
                nota={
                  dados.total.spendConversao > 0
                    ? `sobre ${brlCompact(dados.total.spendConversao)}`
                    : undefined
                }
              />
            </div>
          )}
          <span className="text-[22px] leading-none transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>

      <footer className="flex shrink-0 flex-col items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--ink-muted)]">
          Desenvolvido por
        </span>
        {/*
          Versão reversa do logo: o ".hub" do arquivo original é preto e
          desapareceria no rodapé. O vermelho da marca é preservado.
        */}
        <Image
          src="/graalhub-reverso.png"
          alt="GRAAL.hub"
          width={900}
          height={127}
          priority
          className="h-[19px] w-auto opacity-90"
        />
      </footer>
    </main>
  );
}

function MiniStat({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] opacity-60">
        {rotulo}
      </span>
      <span className="tabular mt-0.5 text-[17px] font-bold leading-none">{valor}</span>
      {nota && <span className="tabular mt-0.5 text-[9px] opacity-50">{nota}</span>}
    </div>
  );
}

function CartaoPraca({
  slug,
  nome,
  marca,
  local,
  cor,
  f,
}: {
  slug: string;
  nome: string;
  marca: string;
  local: string;
  cor: string;
  f: FatiaBucket | null;
}) {
  const ativa = f?.ativa ?? false;

  return (
    <Link
      href={`/${slug}/meta`}
      className="cartao group relative flex flex-col overflow-hidden transition-all hover:border-[var(--border-forte)] hover:bg-[var(--surface-2)]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: cor }}
      />

      <div className="flex flex-col gap-3 p-4 pt-5">
        <div className="min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: cor }}
          >
            {marca}
          </p>
          <h3 className="marca mt-1.5 text-[31px] leading-[0.9]">{nome}</h3>
          <p className="mt-2 text-[12px] text-[var(--ink-muted)]">{local}</p>
        </div>

        <div className="h-px w-full bg-[var(--border)]" />

        {ativa && f ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <MiniStatEsq rotulo="Investido" valor={brlCompact(f.total.spend)} />
              <MiniStatEsq
                rotulo="ROAS"
                valor={f.total.roas > 0 ? `${dec(f.total.roas)}×` : "—"}
                destaque={f.total.roas >= 1}
              />
              <MiniStatEsq
                rotulo="CPA"
                valor={f.total.purchases > 0 ? brlCompact(f.total.cpa) : "—"}
              />
            </div>
            {f.total.spendConversao > 0 && (
              <p className="tabular -mt-1 text-[10px] leading-tight text-[var(--ink-muted)]">
                ROAS e CPA sobre {brlCompact(f.total.spendConversao)} em conversão
              </p>
            )}
            <div className="-mx-1 h-[38px]">
              <Sparkline dados={f.serie} chave="spend" cor={cor} altura={38} />
            </div>
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--good)" }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--good)]">
                {f.campanhas.length} campanha{f.campanhas.length > 1 ? "s" : ""} ativa
                {f.campanhas.length > 1 ? "s" : ""}
              </span>
            </div>
          </>
        ) : (
          <div className="flex min-h-[118px] flex-col justify-center gap-2">
            <p className="text-[13px] font-semibold text-[var(--ink-2)]">
              Ainda sem campanha ativa
            </p>
            <p className="text-[12px] leading-relaxed text-[var(--ink-muted)]">
              O painel já está montado e passa a exibir dados assim que a primeira campanha
              de {nome} entrar no ar.
            </p>
            <span className="mt-1 inline-flex w-fit items-center rounded-[3px] border border-[var(--border-forte)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
              Em breve
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function MiniStatEsq({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="rotulo truncate">{rotulo}</span>
      <span
        className="tabular mt-0.5 text-[17px] font-bold leading-none"
        style={destaque ? { color: "var(--good)" } : undefined}
      >
        {valor}
      </span>
    </div>
  );
}
