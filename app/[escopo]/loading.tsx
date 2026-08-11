import { EsqueletoDash } from "@/components/Esqueleto";

/**
 * Fronteira de carregamento das páginas de praça.
 *
 * Sem ela o App Router segura a navegação até o componente de servidor
 * resolver — 1 a 3s aqui, mais na hospedagem — mantendo a tela ANTERIOR no
 * lugar, sem sinal nenhum. O clique parecia não ter funcionado, e a pessoa
 * clicava de novo. Com a fronteira, a troca é imediata.
 */
export default function Carregando() {
  return <EsqueletoDash />;
}
