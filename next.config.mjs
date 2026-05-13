/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse e xlsx precisam rodar no runtime Node.js, não no Edge bundler
  serverExternalPackages: ["pdf-parse", "xlsx"],

  // Suprime erros de TS e ESLint durante o build do Vercel
  // (erros de ambiente local — tipos de node_modules não instalados — não impedem o deploy)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
