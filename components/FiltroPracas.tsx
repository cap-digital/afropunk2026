"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconCheck } from "@tabler/icons-react";
import { BUCKETS, recorteDeParams } from "@/lib/config";

/**
 * Quais praças entram no comparativo de "todas as praças".
 *
 * O recorte vive na URL (`?pracas=`), como o período: compartilhável, sobrevive
 * ao refresh e a navegação da lateral leva junto. Todas marcadas é a URL limpa.
 * A última marcada não desmarca — comparativo sem praça nenhuma é página vazia.
 */
export function FiltroPracas() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const recorte = recorteDeParams(sp.get("pracas") ?? undefined);
  const marcadas = new Set(recorte ?? BUCKETS.map((b) => b.slug));

  const navegar = (slugs: string[]) => {
    const q = new URLSearchParams(sp.toString());
    const novo = recorteDeParams(slugs.join(","));
    if (novo) q.set("pracas", novo.join(","));
    else q.delete("pracas");
    // Vírgula legível na URL: o URLSearchParams a escaparia como %2C.
    const s = q.toString().replace(/%2C/g, ",");
    router.push(s ? `${pathname}?${s}` : pathname);
    // Mesmo motivo do filtro de período: sem o refresh o Router Cache pode
    // devolver a página com o recorte anterior.
    router.refresh();
  };

  const alternar = (slug: string) => {
    if (marcadas.has(slug)) {
      if (marcadas.size === 1) return;
      navegar([...marcadas].filter((s) => s !== slug));
    } else {
      navegar([...marcadas, slug]);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="rotulo">Comparar</p>
        {recorte && (
          <button
            type="button"
            onClick={() => navegar([])}
            className="text-[var(--fs-micro)] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            Todas
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5" role="group" aria-label="Praças no comparativo">
        {BUCKETS.map((b) => {
          const ligada = marcadas.has(b.slug);
          const ultima = ligada && marcadas.size === 1;
          return (
            <button
              key={b.slug}
              type="button"
              role="checkbox"
              aria-checked={ligada}
              aria-disabled={ultima || undefined}
              title={ultima ? "Pelo menos uma praça fica no comparativo" : undefined}
              onClick={() => alternar(b.slug)}
              className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[var(--fs-nav-sub)] leading-[1.3] transition-colors hover:bg-[var(--surface-2)] ${
                ligada ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
              } ${ultima ? "cursor-default" : ""}`}
            >
              {/* A caixa leva a cor da praça: é a mesma da série nos gráficos,
                  então a lateral serve de legenda para a página inteira. */}
              <span
                aria-hidden="true"
                className="grid h-[0.95rem] w-[0.95rem] shrink-0 place-items-center rounded-[4px] border"
                style={{
                  borderColor: ligada ? b.cor : "var(--border-forte)",
                  background: ligada ? b.cor : "transparent",
                }}
              >
                {ligada && <IconCheck size="0.7rem" stroke={3.2} className="text-black/85" />}
              </span>
              <span className="min-w-0 truncate">{b.nome}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
