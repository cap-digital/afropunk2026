/* eslint-disable @next/next/no-img-element */
import type { Criativo } from "@/lib/meta";
import { Etiqueta } from "./ui";
import { brl, compact, pct } from "@/lib/format";
import { metricasDoCard, type ChaveMetrica } from "./metricasCriativo";
import { OBJETIVO_LABEL } from "@/lib/config";

/**
 * Usamos <img> em vez de next/image de propósito: as URLs do fbcdn são
 * assinadas e expiram (parâmetro `oe`), então o pipeline de otimização do Next
 * não agrega nada e falharia depois que o link vencesse.
 */
export function CartaoCriativo({
  c,
  posicao,
  metricaDestaque,
}: {
  c: Criativo;
  posicao?: number;
  /** Métrica pela qual a grade está ordenada — sempre visível no card. */
  metricaDestaque?: ChaveMetrica;
}) {
  const src = c.imageUrl ?? c.thumbnailUrl;
  const ativo = c.status === "ACTIVE";
  const metricas = metricasDoCard(metricaDestaque);

  return (
    <article className="cartao group flex flex-col overflow-hidden transition-colors hover:border-[var(--border-forte)]">
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--surface-2)]">
        {posicao !== undefined && (
          <span className="absolute bottom-2 right-2 z-[2] flex h-5 min-w-[19px] items-center justify-center bg-black/80 px-1 text-[var(--fs-rotulo)] font-semibold tabular text-[var(--ink)]">
            {posicao}
          </span>
        )}
        {src ? (
          <img
            src={src}
            alt={c.adName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--fs-corpo)] text-[var(--ink-muted)]">
            sem preview
          </div>
        )}

        {c.bucket && (
          <span
            className="absolute left-2 top-2 rounded-[3px] px-1.5 py-[3px] text-[var(--fs-micro)] font-semibold uppercase tracking-[0.08em] text-black"
            style={{ background: c.bucket.cor }}
          >
            {c.bucket.nome}
          </span>
        )}

        {!ativo && (
          <span className="absolute right-1.5 top-1.5 rounded-[3px] bg-black/75 px-1 py-[2px] text-[var(--fs-micro)] font-semibold uppercase tracking-[0.08em] text-[var(--ink-2)]">
            Pausado
          </span>
        )}
      </div>

      {/*
        Bloco compacto de propósito: o card é pequeno, então nada de `.rotulo`
        (11px) aqui — os rótulos usam um passo abaixo para a altura acompanhar
        a redução da largura.
      */}
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <p
          className="line-clamp-1 text-[var(--fs-corpo-2)] font-semibold leading-tight text-[var(--ink)]"
          title={c.adName}
        >
          {c.adName}
        </p>

        <dl className="tabular grid grid-cols-3 gap-1.5 text-[var(--fs-corpo)]">
          {metricas.map((m) => {
            const destacada = m.chave === metricaDestaque;
            return (
              <div key={m.chave} className="min-w-0">
                <dt
                  className="truncate text-[var(--fs-micro)] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: destacada ? "var(--ink)" : "var(--ink-muted)" }}
                >
                  {m.curto}
                </dt>
                <dd
                  className="truncate font-bold"
                  style={{
                    color: m.bom?.(c) ? "var(--good)" : "var(--ink)",
                  }}
                >
                  {m.valor(c)}
                </dd>
              </div>
            );
          })}
        </dl>

        {/*
          O mesmo anúncio roda em várias campanhas e conjuntos — sem estas duas
          dimensões, cards de nome idêntico ficam indistinguíveis na grade.
        */}
        <p
          className="truncate text-[var(--fs-rotulo)] text-[var(--ink-2)]"
          title={`${OBJETIVO_LABEL[c.objetivo] ?? c.objetivo} · ${c.conjuntoNome ?? "—"} · ${c.campanhaNome}`}
        >
          <span className="font-semibold">{OBJETIVO_LABEL[c.objetivo] ?? c.objetivo}</span>
          {c.conjuntoNome ? ` · ${c.conjuntoNome}` : ""}
        </p>
        <p className="tabular truncate text-[var(--fs-rotulo)] text-[var(--ink-muted)]">
          {compact(c.m.impressions)} impr. ·{" "}
          {c.m.purchases > 0 ? `${c.m.purchases} compras` : "sem compra"}
        </p>

        {c.permalink ? (
          <a
            href={c.permalink}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver no Instagram"
            className="mt-auto flex items-center justify-center gap-1 border border-[var(--border-forte)] px-2 py-[5px] text-[var(--fs-rotulo)] font-semibold uppercase tracking-[0.08em] text-[var(--ink-2)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <IconeInstagram />
            Instagram
          </a>
        ) : (
          <span className="mt-auto block border border-dashed border-[var(--border)] px-2 py-[5px] text-center text-[var(--fs-rotulo)] uppercase tracking-[0.08em] text-[var(--ink-muted)]">
            Sem link
          </span>
        )}
      </div>
    </article>
  );
}

function IconeInstagram() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Linha de destaque: o criativo com melhor CTR do recorte. */
export function DestaqueCriativo({ criativos }: { criativos: Criativo[] }) {
  const comDados = criativos.filter((c) => c.m.impressions > 0);
  if (comDados.length === 0) return null;
  const melhor = [...comDados].sort((a, b) => b.m.ctr - a.m.ctr)[0];
  const maisInvestido = [...comDados].sort((a, b) => b.m.spend - a.m.spend)[0];

  return (
    <div className="grid grid-cols-2 gap-3.5">
      <MiniDestaque rotulo="Maior CTR" c={melhor} metrica={pct(melhor.m.ctr)} />
      <MiniDestaque
        rotulo="Maior investimento"
        c={maisInvestido}
        metrica={brl(maisInvestido.m.spend)}
      />
    </div>
  );
}

function MiniDestaque({
  rotulo,
  c,
  metrica,
}: {
  rotulo: string;
  c: Criativo;
  metrica: string;
}) {
  const src = c.imageUrl ?? c.thumbnailUrl;
  return (
    <div className="cartao flex items-center gap-3 p-2.5">
      <div className="h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[4px] bg-[var(--surface-2)]">
        {src && <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Etiqueta variante="contorno">
            {rotulo}
          </Etiqueta>
        </div>
        <p className="mt-1 truncate text-[var(--fs-corpo-2)] font-semibold text-[var(--ink)]" title={c.adName}>
          {c.adName}
        </p>
        <p className="truncate text-[var(--fs-corpo)] text-[var(--ink-muted)]">{c.bucket?.nome ?? "—"}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className="tabular block text-[var(--fs-kpi)] font-bold leading-none text-[var(--ink)]">
          {metrica}
        </span>
      </div>
    </div>
  );
}
