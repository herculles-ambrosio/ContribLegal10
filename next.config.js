/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Desabilita a verificação do ESLint durante o build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignora erros de typescript durante o build também
    ignoreBuildErrors: true,
  },
  // Configurações adicionais para garantir compatibilidade
  output: 'standalone',
  poweredByHeader: false,
  
  // Configurar diretório src como pasta base
  distDir: '.next',
  
  // Define onde o Next.js deve procurar pela pasta app ou pages
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: [],
    allowedDevOrigins: ['192.168.1.225'],
  },
  
  // No Next.js 15, você define a pasta raiz de aplicação assim
  reactStrictMode: true,
  sassOptions: {
    includePaths: ['./src'],
  },
};

module.exports = nextConfig; 