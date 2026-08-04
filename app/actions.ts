"use server";

import { revalidatePath } from "next/cache";

/**
 * Descarta o cache ISR de todas as rotas e força uma leitura nova da
 * Marketing API. Chamado pelo botão "Atualizar" no cabeçalho.
 */
export async function atualizarDados() {
  revalidatePath("/", "layout");
}
