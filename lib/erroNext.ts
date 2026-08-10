/**
 * `notFound()` e `redirect()` do Next sinalizam por exceção: eles lançam um
 * erro marcado com `digest` que o framework intercepta acima da página.
 *
 * Isso colide com o `try/catch` que as páginas usam para transformar falha de
 * API em faixa de erro — o catch pega o sinal de controle antes do Next e a
 * rota, em vez de responder 404, renderiza "falha ao carregar". O sintoma é
 * silencioso: a página existe, responde 200 e mostra a mensagem errada.
 *
 * Por isso todo catch de página começa repassando o que for controle do Next.
 */
export function ehControleNext(e: unknown): boolean {
  if (typeof e !== "object" || e === null || !("digest" in e)) return false;
  const digest = (e as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest === "NEXT_NOT_FOUND" || digest.startsWith("NEXT_REDIRECT"))
  );
}
