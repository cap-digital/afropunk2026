"use client";

import { useMemo, useState } from "react";
import { IconArrowDown, IconArrowUp, IconPointFilled } from "@tabler/icons-react";
import { brl, conv, dec, int, pct } from "@/lib/format";

/**
 * Tabela ordenável por coluna.
 *
 * As linhas chegam como registro plano de propósito: o servidor traduz o objeto
 * de domínio antes de mandar, porque função de acesso não atravessa a fronteira
 * do Server Component. O que passa é dado serializável, e a ordenação acontece
 * no cliente sem ida ao servidor.
 */

export type FormatoColuna = "texto" | "int" | "conv" | "brl" | "pct" | "roas" | "dec";

export interface ColunaTabela {
  chave: string;
  rotulo: string;
  formato?: FormatoColuna;
  /** Texto alinha à esquerda; número, à direita. */
  alinhar?: "esquerda" | "direita";
  /** Pinta de verde a partir de 1 — usado no ROAS. */
  destacarBom?: boolean;
  /** Dá ênfase de tinta cheia, para a coluna que a página quer que se leia. */
  enfase?: boolean;
  largura?: string;
}

export interface LinhaTabela {
  id: string;
  /** Cor do marcador na primeira coluna: é legenda, casa com a série do gráfico. */
  cor?: string;
  /** Texto completo no `title` quando a célula truncar. */
  titulo?: string;
  [chave: string]: string | number | undefined;
}

function formatar(v: string | number | undefined, f: FormatoColuna = "texto"): string {
  if (v === undefined || v === null || v === "") return "—";
  if (f === "texto") return String(v);
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  switch (f) {
    case "brl":
      return brl(n);
    case "int":
      return int(n);
    case "conv":
      return conv(n);
    case "pct":
      return pct(n);
    case "roas":
      return `${dec(n)}×`;
    default:
      return dec(n);
  }
}

export function TabelaOrdenavel({
  colunas,
  linhas,
  ordenarPor,
  className = "",
}: {
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  /** Coluna da ordenação inicial; começa decrescente se for numérica. */
  ordenarPor?: string;
  className?: string;
}) {
  const inicial = ordenarPor ?? colunas.find((c) => c.formato && c.formato !== "texto")?.chave ?? colunas[0].chave;
  const [chave, setChave] = useState(inicial);
  const [desc, setDesc] = useState(true);

  const ordenadas = useMemo(() => {
    const col = colunas.find((c) => c.chave === chave);
    const texto = !col?.formato || col.formato === "texto";
    const sinal = desc ? -1 : 1;
    return [...linhas].sort((a, b) => {
      const x = a[chave];
      const y = b[chave];
      if (texto) {
        return sinal * String(x ?? "").localeCompare(String(y ?? ""), "pt-BR");
      }
      // Vazio vai sempre para o fim, independente da direção — linha sem número
      // no topo de uma ordenação crescente esconde o que a pessoa quer ver.
      const nx = Number(x ?? 0);
      const ny = Number(y ?? 0);
      if (!nx && ny) return 1;
      if (nx && !ny) return -1;
      return sinal * (nx - ny);
    });
  }, [linhas, colunas, chave, desc]);

  const alternar = (c: ColunaTabela) => {
    if (c.chave === chave) {
      setDesc((v) => !v);
      return;
    }
    setChave(c.chave);
    // Número começa do maior; texto, de A a Z.
    setDesc(Boolean(c.formato) && c.formato !== "texto");
  };

  return (
    <div className={`h-full overflow-auto ${className}`}>
      <table className="w-full" style={{ fontSize: "var(--fs-corpo)" }}>
        <thead className="sticky top-0 z-[1] bg-[var(--surface-2)]">
          <tr className="uppercase tracking-[0.1em] text-[var(--ink-muted)] [font-size:var(--fs-micro)]">
            {colunas.map((c) => {
              const ativa = c.chave === chave;
              const direita = c.alinhar === "direita" || (c.formato && c.formato !== "texto");
              return (
                <th
                  key={c.chave}
                  style={c.largura ? { width: c.largura } : undefined}
                  aria-sort={ativa ? (desc ? "descending" : "ascending") : "none"}
                  className={`px-3 py-2 font-bold first:rounded-l-md first:pl-3 last:rounded-r-md ${
                    direita ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => alternar(c)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-[0.12em] transition-colors hover:text-[var(--ink)] ${
                      direita ? "flex-row-reverse" : ""
                    } ${ativa ? "text-[var(--ink)]" : ""}`}
                    title={`Ordenar por ${c.rotulo}`}
                  >
                    {c.rotulo}
                    {ativa ? (
                      desc ? (
                        <IconArrowDown size={12} stroke={2.4} aria-hidden="true" />
                      ) : (
                        <IconArrowUp size={12} stroke={2.4} aria-hidden="true" />
                      )
                    ) : (
                      <span aria-hidden="true" className="w-3" />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="tabular">
          {ordenadas.map((l) => (
            <tr
              key={l.id}
              className="border-b border-[var(--border)] text-[var(--ink-2)] transition-colors last:border-b-0 hover:bg-[var(--surface-2)]"
            >
              {colunas.map((c, i) => {
                const v = l[c.chave];
                const primeira = i === 0;
                const direita = c.alinhar === "direita" || (c.formato && c.formato !== "texto");
                const bom = c.destacarBom && Number(v ?? 0) >= 1;
                return (
                  <td
                    key={c.chave}
                    title={primeira ? (l.titulo ?? String(v ?? "")) : undefined}
                    className={`px-3 py-2 ${
                      direita ? "text-right" : ""
                    } ${primeira ? "max-w-[240px] font-medium text-[var(--ink)]" : ""} ${
                      c.enfase ? "font-semibold text-[var(--ink)]" : ""
                    } ${bom ? "font-semibold" : ""}`}
                    style={bom ? { color: "var(--good)" } : undefined}
                  >
                    {primeira ? (
                      <span className="flex items-center gap-1.5">
                        {l.cor && (
                          <IconPointFilled
                            size={12}
                            aria-hidden="true"
                            className="shrink-0"
                            style={{ color: l.cor }}
                          />
                        )}
                        <span className="truncate">{formatar(v, c.formato)}</span>
                      </span>
                    ) : (
                      formatar(v, c.formato)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
