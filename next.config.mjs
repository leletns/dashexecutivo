/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse e xlsx precisam rodar no runtime Node.js, não no Edge bundler
  serverExternalPackages: ["pdf-parse", "xlsx", "bcryptjs"],

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // A tela de login nunca pode ser servida de cache (CDN/navegador): o
  // usuário precisa sempre receber a versão mais recente do formulário.
  async headers() {
    return [
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
