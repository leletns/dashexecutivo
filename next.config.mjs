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
};

export default nextConfig;
