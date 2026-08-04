/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Permite build/preview em um diretório separado (NEXT_DIST_DIR=.next-preview),
   * para não disputar o `.next` com um `next dev` rodando em paralelo.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
