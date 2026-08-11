import { Marca } from "./Marca";

/**
 * Esqueleto de carregamento.
 *
 * Existe porque o App Router segura a navegação até o componente de servidor
 * resolver: sem fronteira de carregamento, a tela ANTERIOR fica no lugar, sem
 * sinal nenhum, e o clique parece não ter funcionado — então a pessoa clica de
 * novo. Aqui a troca é imediata e o dado chega depois.
 *
 * A geometria copia a moldura real (lateral de 236px, cabeçalho de 56px, mesmo
 * espaçamento) para que a chegada do conteúdo não empurre nada de lugar.
 */

function Bloco({ className = "" }: { className?: string }) {
  return <div className={`pulsa rounded-md bg-[var(--surface-3)] ${className}`} />;
}

export function EsqueletoDash() {
  return (
    <div
      className="flex min-h-screen w-full gap-4 bg-[var(--bg)] p-3 lg:h-screen lg:min-h-[640px] lg:overflow-hidden lg:p-4"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando</span>

      <aside className="painel hidden w-[236px] shrink-0 flex-col overflow-hidden lg:flex">
        <div className="flex h-[60px] shrink-0 items-center justify-center border-b border-[var(--border)] px-3">
          <Marca tamanho="sm" />
        </div>
        <div className="shrink-0 border-b border-[var(--border)] px-3 py-3.5">
          <Bloco className="h-[10px] w-10" />
          <Bloco className="mt-2 h-[38px] w-full" />
        </div>
        <div className="flex flex-1 flex-col gap-2 px-4 py-4">
          {Array.from({ length: 7 }, (_, i) => (
            <Bloco key={i} className="h-[26px]" />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-4">
        <header className="painel flex min-h-[56px] shrink-0 items-center justify-between gap-3 px-3.5 lg:h-[56px] lg:px-5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Bloco className="h-[17px] w-40" />
            <Bloco className="h-[9px] w-56" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Bloco className="h-[30px] w-[104px]" />
            <Bloco className="h-[30px] w-[86px]" />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-3">
          <Bloco className="h-[14px] w-44 shrink-0" />
          <div className="cartao grid shrink-0 grid-cols-3 items-center gap-5 px-5 py-4 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Bloco className="h-[9px] w-16" />
                <Bloco className="h-[22px] w-24" />
                <Bloco className="h-[9px] w-20" />
              </div>
            ))}
          </div>
          <Bloco className="h-[14px] w-32 shrink-0" />
          <div className="grid min-h-[236px] flex-1 grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
            <div className="cartao" />
            <div className="cartao" />
          </div>
        </main>
      </div>
    </div>
  );
}

/** Esqueleto da capa — sem moldura, três cartões de praça. */
export function EsqueletoCapa() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-between overflow-hidden bg-[var(--bg)] px-8 py-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando</span>
      <div className="flex shrink-0 flex-col items-center gap-3">
        <Marca />
        <Bloco className="h-[10px] w-64" />
      </div>
      <div className="flex w-full max-w-[1120px] shrink-0 flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="cartao flex flex-col gap-3 p-4 pt-5">
              <Bloco className="h-[10px] w-28" />
              <Bloco className="h-[28px] w-44" />
              <Bloco className="h-[10px] w-32" />
              <div className="h-px w-full bg-[var(--border)]" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex flex-col gap-1.5">
                    <Bloco className="h-[8px] w-12" />
                    <Bloco className="h-[16px] w-16" />
                  </div>
                ))}
              </div>
              <Bloco className="h-[38px] w-full" />
            </div>
          ))}
        </div>
        <Bloco className="h-[74px] w-full" />
        <Bloco className="h-[70px] w-full" />
      </div>
      <div className="h-8" />
    </main>
  );
}
