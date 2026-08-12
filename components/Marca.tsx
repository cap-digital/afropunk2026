import Link from "next/link";

/** Wordmark AFROPUNK: caixa alta pesada dentro da moldura, "2026" abaixo. */
export function Marca({
  tamanho = "md",
  href = "/",
}: {
  tamanho?: "sm" | "md" | "lg" | "xl";
  href?: string | null;
}) {
  const escala = {
    sm: { txt: "text-[var(--fs-md)]", pad: "px-2 py-[3px]", ano: "text-[var(--fs-micro)]", gap: "gap-[3px]" },
    md: { txt: "text-[var(--fs-kpi)]", pad: "px-2.5 py-1", ano: "text-[var(--fs-corpo)]", gap: "gap-1" },
    lg: { txt: "text-[var(--fs-display)]", pad: "px-4 py-1.5", ano: "text-[var(--fs-md)]", gap: "gap-1.5" },
    xl: { txt: "text-[var(--fs-display)]", pad: "px-6 py-2.5", ano: "text-[var(--fs-kpi)]", gap: "gap-2" },
  }[tamanho];

  const conteudo = (
    <span className={`inline-flex flex-col items-center ${escala.gap}`}>
      <span className={`moldura marca ${escala.txt} ${escala.pad} leading-none`}>
        AFROPUNK<sup className="ml-[1px] align-super text-[0.4em] font-bold">®</sup>
      </span>
      <span
        className={`${escala.ano} font-bold tracking-[0.42em] text-[var(--ink-2)] leading-none pl-[0.42em]`}
      >
        2026
      </span>
    </span>
  );

  if (!href) return conteudo;
  return (
    <Link href={href} className="inline-block transition-opacity hover:opacity-80">
      {conteudo}
    </Link>
  );
}

/** Fileira de losangos do pôster — separador de marca. */
export function Losangos({
  cor = "var(--ink)",
  qtd = 7,
  className = "",
}: {
  cor?: string;
  qtd?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: qtd }).map((_, i) => (
        <span
          key={i}
          style={{ background: cor }}
          className="block h-[0.4375rem] w-[0.4375rem] rotate-45"
        />
      ))}
    </span>
  );
}
