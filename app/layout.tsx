import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

/*
 * Duas famílias, dois papéis — e a divisão é funcional, não decorativa.
 *
 * POPPINS é geométrica: o "o" é um círculo, o "a" é de andar único. Isso dá
 * presença em caixa alta e em corpo grande, que é onde ela trabalha aqui —
 * marca, título de página, título de cartão, faixa de seção. Em número ela é
 * ruim: os dígitos são largos, o "1" é um traço quase sem serifa e as colunas
 * de tabela deixam de alinhar visualmente.
 *
 * INTER é o oposto: desenhada para interface, tem `tabular-nums` de verdade,
 * dígitos de mesma largura e altura-x alta, que é o que segura legibilidade em
 * 8px. Fica com tudo que é dado — KPI, eixo, célula, rótulo, corpo.
 *
 * A regra prática: se é NOME de alguma coisa, é Poppins. Se é MEDIDA, é Inter.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--fonte-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  // 500/600 para títulos, 700/800 para a marca em caixa alta. Sem 400: em
  // Poppins o regular fica frouxo ao lado do Inter e a hierarquia some.
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--fonte-poppins",
});

export const metadata: Metadata = {
  title: "AFROPUNK 2026 · Dashboard de Mídia",
  description:
    "Performance das campanhas AFROPUNK 2026 por praça — Rio de Janeiro, Recife e Salvador.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${poppins.variable}`}>
      {/* O corpo é Inter: dado é o padrão, e Poppins entra por classe onde há
          nome a dizer. O contrário obrigaria a marcar cada número da tela. */}
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
