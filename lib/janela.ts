import "server-only";
import { PISO_HISTORICO } from "./config";
import { inicioDasCampanhasAds } from "./googleAds";
import { getCampanhasAtivas } from "./meta";

/**
 * Quando a mídia desta edição começou.
 *
 * "Todo o período" tem um significado só no painel inteiro: do primeiro dia com
 * dado até hoje. Cada fonte chega nisso do seu jeito — o Meta tem
 * `date_preset=maximum`, o Google pergunta pela campanha mais antiga do escopo
 * — mas o GA4 não tem campanha nenhuma para consultar, e a propriedade guarda
 * também a edição 2025, que responde por perto de 80% do histórico. Puxar o
 * "primeiro dia com dado" do site traria o ano passado para dentro dos totais e
 * achataria os picos desta edição no gráfico.
 *
 * Então o site herda a janela da mídia: a primeira veiculação de 2026, nos dois
 * canais, é o dia em que passou a fazer sentido olhar o tráfego.
 *
 * As duas leituras são estruturais e cacheadas, e falham em silêncio de
 * propósito: Analytics não pode cair porque a credencial do Meta expirou. Com
 * as duas fora, sobra o piso — largo, e sem nenhum dia de entrega antes dele.
 */
export async function inicioDaMidia(): Promise<string> {
  const [google, meta] = await Promise.all([
    inicioDasCampanhasAds().catch(() => null),
    inicioDaMidiaMeta().catch(() => null),
  ]);

  // ISO compara bem como texto; quem começou antes manda.
  const dias = [google, meta].filter((d): d is string => Boolean(d)).sort();
  return dias[0] ?? PISO_HISTORICO;
}

/** Início da campanha mais antiga da edição no Meta. */
async function inicioDaMidiaMeta(): Promise<string | null> {
  const campanhas = await getCampanhasAtivas();
  const dias = campanhas
    .filter((c) => c.bucket !== null)
    // "2026-07-31T10:00:00-0300" → "2026-07-31". A data já vem no fuso da
    // conta, que é o mesmo recorte de dia que o resto do painel usa.
    .map((c) => c.start_time?.slice(0, 10))
    .filter((d): d is string => Boolean(d))
    .sort();
  return dias[0] ?? null;
}
