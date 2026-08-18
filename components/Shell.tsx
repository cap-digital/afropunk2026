import type { ReactNode } from "react";
import Link from "next/link";
import { IconWorldWww } from "@tabler/icons-react";
import { Moldura } from "./Moldura";
import { NavAnalytics } from "./Nav";
import { Etiqueta } from "./ui";
import { ESCOPO_TODAS, nomeDoEscopo, PRACA_POR_SLUG, type EscopoSlug } from "@/lib/config";
import { canaisDoEscopo, tentarAds } from "@/lib/ads";
import { rotuloPeriodo } from "@/lib/periodo";
import type { Periodo } from "@/lib/meta";

const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export async function Shell({
  escopo,
  children,
  titulo,
  sub,
  acoes,
}: {
  escopo: EscopoSlug;
  children: ReactNode;
  titulo: string;
  sub?: ReactNode;
  acoes?: ReactNode;
}) {
  const praca = escopo === ESCOPO_TODAS ? null : PRACA_POR_SLUG[escopo];
  // Renderizado no servidor: é o instante em que os dados foram lidos da API.
  const geradoEm = HORA.format(new Date());

  /*
   * A lateral só mostra o que existe — mas falha de credencial não pode virar
   * "não existe". Quando a leitura quebra, o grupo do Google aparece inteiro
   * com aviso, e cada página mostra o erro real da API. O Meta segue navegável.
   */
  const google = await tentarAds(canaisDoEscopo(escopo));

  return (
    <Moldura
      escopo={escopo}
      uf={praca?.uf ?? "BR"}
      titulo={titulo}
      sub={sub}
      acoes={acoes}
      geradoEm={geradoEm}
      canaisGoogle={google.dados ?? []}
      googleIndisponivel={google.erro !== null}
    >
      {children}
    </Moldura>
  );
}

/** Contexto do escopo, mostrado sob o título. */
/**
 * Subtítulo do cabeçalho: só o que é específico da PÁGINA.
 *
 * Antes ele repetia a marca e o local da praça — "AFROPUNK EXPERIENCE ·
 * TERREIRÃO DO SAMBA · …" — que já estão no seletor de praça, dois centímetros
 * à esquerda. Eram 74 caracteres pedindo 766px num espaço de 379px em tela de
 * 1280, e nenhum tamanho de fonte legível resolve isso: o excesso era de
 * conteúdo, não de tipografia. A lista de praças do comparativo saiu pelo
 * mesmo motivo — o seletor já diz "Todas as Praças", e os gráficos trazem a
 * legenda por praça.
 */
export function subtituloEscopo(
  escopo: EscopoSlug,
  extra?: string,
  periodo?: Periodo,
): string {
  const partes: string[] = [];
  if (extra) partes.push(extra);
  if (periodo && periodo !== "maximum") partes.push(rotuloPeriodo(periodo));
  return partes.join(" · ");
}

/**
 * Página: no desktop é uma coluna de altura total — as linhas com `flex-1`
 * dividem o que sobra, então não fica espaço morto embaixo. No mobile vira
 * uma pilha que rola.
 */
export function Pagina({ children }: { children: ReactNode }) {
  /*
   * A página ocupa a tela inteira — e a folga vai para quem sabe usá-la.
   *
   * Esta é a terceira tentativa e vale registrar por que as duas primeiras
   * falharam, porque a diferença entre elas e esta é sutil:
   *
   *   1ª — `h-full` em tudo. Todo cartão era obrigado a caber, e o que não
   *        cabia sumia cortado.
   *   2ª — `min-h-full` + `flex-1` em toda linha. A linha esticava até a
   *        janela e o CARTÃO junto, mas o conteúdo dele não: funil de cinco
   *        barras numa caixa de 900px.
   *   3ª — altura de conteúdo em tudo. Sem espaço morto dentro do cartão, mas
   *        com uma faixa preta no rodapé de toda página curta.
   *
   * O erro comum às duas primeiras foi dar a folga ao CARTÃO. Aqui ela vai
   * para o GRÁFICO: só a linha marcada com `preencher` cresce, e dentro dela
   * quem absorve a sobra é a área de plotagem — que fica melhor com mais
   * altura, ao contrário de uma lista de cinco linhas de texto. Linha de KPI,
   * de tabela e de cartão de campanha seguem com a altura do que carregam.
   */
  return (
    <div
      className="flex flex-col pb-1 lg:h-full"
      style={{ gap: "var(--esp-coluna)" }}
    >
      {children}
    </div>
  );
}

/**
 * Linha de cartões lado a lado.
 *
 * Não cresce mais para ocupar a folga da coluna: era esse `flex-1` que esticava
 * o cartão sem esticar o conteúdo dele. Os cartões irmãos continuam se
 * igualando em altura — isso é o `stretch` natural do grid/flex e é o que se
 * quer, um par de cartões lado a lado com bases desalinhadas fica torto. O que
 * sai é só a amarração à altura da JANELA.
 */
export function Linha({
  children,
  className = "",
  preencher = false,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Esta linha absorve a folga vertical da página. Ligar só onde há gráfico:
   * é a área de plotagem que melhora com altura extra. Numa linha de tabela ou
   * de texto, `preencher` só reabre o vazio dentro do cartão.
   */
  preencher?: boolean;
}) {
  /*
   * Sem `lg:flex` aqui: quem chama passa `grid` no className, e `display:flex`
   * sobrepunha o grid — as colunas perdiam o dimensionamento e os cartões
   * vazavam para fora da tela. O display é decisão de quem usa.
   */
  return (
    <div className={`min-w-0 ${preencher ? "lg:min-h-0 lg:flex-1" : "shrink-0"} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Área de plotagem.
 *
 * Substitui os `<div className="h-[var(--h-grafico)]">` espalhados pelas
 * páginas. A diferença é o `h-full`: dentro de uma `Linha preencher`, o
 * gráfico cresce com ela; fora, o `min-height` segura o piso e ele se comporta
 * como antes. Um só componente, os dois regimes — e nenhuma página precisa
 * saber em qual está.
 */
export function AreaGrafico({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`h-full min-h-[var(--h-grafico)] ${className}`}>{children}</div>
  );
}

/** Faixa de erro da Marketing API — mostra o que fazer. */
export function ErroMeta({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div className="cartao flex flex-col gap-2 p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="block h-2.5 w-2.5 rotate-45"
          style={{ background: "var(--critical)" }}
        />
        <h2 className="marca text-[var(--fs-kpi)]">{titulo}</h2>
      </div>
      <p className="max-w-[80ch] text-[var(--fs-corpo-2)] leading-relaxed text-[var(--ink-2)]">{detalhe}</p>
    </div>
  );
}

export { Etiqueta, nomeDoEscopo };

/**
 * Shell do dashboard GA4. Reaproveita a mesma moldura, trocando a navegação
 * por plataforma pela do Analytics e o seletor de praça por um retorno à capa
 * — o GA4 é do site inteiro, não de uma praça.
 */
export function ShellAnalytics({
  children,
  titulo,
  sub,
  acoes,
}: {
  children: ReactNode;
  titulo: string;
  sub?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <Moldura
      uf="GA4"
      titulo={titulo}
      sub={sub}
      acoes={acoes}
      geradoEm={HORA.format(new Date())}
      navegacao={<NavAnalytics />}
      contexto={
        <>
          <p className="rotulo px-1 pb-2">Fonte</p>
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-lg border border-[var(--border-forte)] bg-[var(--surface-2)] px-2.5 py-2.5 transition-colors hover:bg-[var(--surface-3)]"
          >
            <IconWorldWww
              size="0.9375rem"
              stroke={1.9}
              aria-hidden="true"
              className="shrink-0 text-[var(--ink-muted)]"
            />
            <span className="marca min-w-0 flex-1 truncate text-[var(--fs-md)] text-[var(--ink)]">
              Site AFROPUNK
            </span>
            <span className="shrink-0 text-[var(--fs-rotulo)] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)] transition-colors group-hover:text-[var(--ink)]">
              sair
            </span>
          </Link>
        </>
      }
    >
      {children}
    </Moldura>
  );
}

/** Faixa de erro do GA4. */
export function ErroGA4({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return <ErroMeta titulo={titulo} detalhe={detalhe} />;
}
