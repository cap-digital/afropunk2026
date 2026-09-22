/**
 * Imposto do Meta sobre a verba de mídia.
 *
 * O cliente paga um boleto ao Meta e 12,5% dele ficam no imposto: de R$ 1.000
 * pagos, só R$ 875 entram na conta para virar impressão. A Marketing API só
 * conhece esses R$ 875 — é o que `spend` devolve, e é o que este projeto chama
 * de GASTO PLATAFORMA.
 *
 * O que o cliente reconhece como "investimento", porém, é o boleto: se o painel
 * mostrasse só o gasto plataforma, a leitura seria a de que parte da verba não
 * foi impulsionada. Por isso todo número rotulado como investimento no Meta
 * aparece com o imposto de volta, e o gasto plataforma fica na linha de apoio.
 *
 * A volta é DIVISÃO, não acréscimo: 875 × 1,125 dá 984,38, e o boleto era 1.000.
 * O imposto incide sobre o bruto, então o bruto é 875 ÷ 0,875.
 *
 * Duas fronteiras, e elas são o que impede o número de virar mentira:
 *
 *  1. Nenhuma métrica de eficiência usa o valor com imposto. CPM, CPC, CPA e
 *     ROAS continuam sobre o gasto plataforma — é ele que comprou a entrega, e
 *     inflar o denominador pioraria artificialmente todo benchmark da conta.
 *  2. Onde o investido aparece ao lado do ROAS como insumo dele (conjunto,
 *     criativo), o valor fica na plataforma e o rótulo diz isso. Grosar só um
 *     dos dois lados faria a conta visível na tela não fechar.
 *
 * Nada disto se aplica ao Google Ads: lá o custo da API já é o valor pago.
 */
export const IMPOSTO_META = 0.125;

/** Gasto plataforma → valor pago pelo cliente. R$ 875 → R$ 1.000. */
export const comImposto = (gastoPlataforma: number) =>
  (gastoPlataforma || 0) / (1 - IMPOSTO_META);
