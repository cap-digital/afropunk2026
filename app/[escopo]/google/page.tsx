import { notFound } from "next/navigation";
import { Etiqueta, Shell, subtituloEscopo } from "@/components/Shell";
import { Cartao } from "@/components/ui";
import { Losangos } from "@/components/Marca";
import { ehEscopoValido, ESCOPOS, nomeDoEscopo, type EscopoSlug } from "@/lib/config";

export const revalidate = 3600;

export function generateStaticParams() {
  return ESCOPOS.map((escopo) => ({ escopo }));
}

/**
 * Placeholder estrutural do Google Ads.
 * A organização espelha a do Meta — as mesmas subpáginas, no mesmo escopo de
 * praça. Falta apenas a credencial: quando ela chegar, a camada de dados é
 * ligada no mesmo padrão de lib/meta.ts e estas telas passam a ler dados reais.
 */
const SUBPAGINAS = [
  {
    titulo: "Visão geral",
    itens: ["Investimento e impressões por dia", "CTR, CPC e CPM médios", "Conversões e ROAS"],
  },
  {
    titulo: "Campanhas",
    itens: ["Search, Performance Max e YouTube", "Orçamento diário e consumo", "Parcela de impressões"],
  },
  {
    titulo: "Criativos",
    itens: ["Anúncios responsivos de pesquisa", "Ativos de imagem e vídeo", "Desempenho por ativo"],
  },
  {
    titulo: "Público",
    itens: ["Idade, gênero e afinidade", "Desktop, mobile e tablet", "Distribuição geográfica"],
  },
  {
    titulo: "Palavras-chave",
    itens: ["Termos de busca com maior volume", "Custo por palavra-chave", "Índice de qualidade"],
  },
  {
    titulo: "Meta × Google",
    itens: ["Mesma janela, mesmas métricas", "Custo por ingresso por canal", "Divisão do investimento"],
  },
];

export default function GoogleAds({ params }: { params: { escopo: string } }) {
  if (!ehEscopoValido(params.escopo)) notFound();
  const escopo = params.escopo as EscopoSlug;

  return (
    <Shell
      escopo={escopo}
      titulo="Google Ads"
      sub={subtituloEscopo(escopo, "aguardando credencial da API")}
      acoes={<Etiqueta variante="contorno">Não conectado</Etiqueta>}
    >
      <div className="flex flex-col gap-3">
        <div className="cartao flex items-center gap-6 px-5 py-5">
          <Losangos qtd={6} cor="var(--surface-3)" />
          <div className="min-w-0 flex-1">
            <h2 className="marca text-[25px] leading-none">Google Ads ainda não está rodando</h2>
            <p className="mt-2 max-w-[92ch] text-[13px] leading-relaxed text-[var(--ink-2)]">
              Não há campanha no ar nem acesso à API. O dashboard já está montado para receber
              o canal com a mesma estrutura do Meta — escopo de praça na capa, subpáginas por
              tipo de análise — então ligar os dados não muda layout nem navegação.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 border-l border-[var(--border)] pl-6">
            <p className="rotulo">O que falta</p>
            <ul className="flex flex-col gap-1 text-[12px] text-[var(--ink-2)]">
              <li>· Developer token (nível básico)</li>
              <li>· ID da conta do cliente</li>
              <li>· OAuth 2.0 com refresh token</li>
            </ul>
          </div>
        </div>

        <Cartao
          titulo={`Subpáginas previstas · ${nomeDoEscopo(escopo)}`}
          sub="Mesma organização do Meta Ads, para que a leitura entre canais seja direta"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SUBPAGINAS.map((b) => (
              <div
                key={b.titulo}
                className="flex flex-col gap-2 rounded-[4px] border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3"
              >
                <h3 className="text-[13px] font-semibold text-[var(--ink)]">{b.titulo}</h3>
                <ul className="flex flex-col gap-1">
                  {b.itens.map((i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-[12px] text-[var(--ink-muted)]"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[5px] block h-1.5 w-1.5 shrink-0 rotate-45 bg-[var(--surface-3)]"
                      />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Cartao>
      </div>
    </Shell>
  );
}
