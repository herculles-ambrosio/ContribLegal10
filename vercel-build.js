const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Verifica se estamos no ambiente de build do Vercel
const isVercel = process.env.VERCEL === '1';

if (isVercel) {
  console.log('🔄 Preparando ambiente de build no Vercel...');
  
  // Verifica se o diretório app já existe na raiz
  if (!fs.existsSync('app')) {
    console.log('📁 Criando link simbólico para src/app na raiz...');
    
    try {
      // Cria um link simbólico do src/app para app na raiz
      fs.symlinkSync('src/app', 'app', 'dir');
      console.log('✅ Link simbólico criado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao criar link simbólico:', error);
      process.exit(1);
    }
  } else {
    console.log('ℹ️ Diretório app já existe na raiz.');
  }
}

// Continua com o build normal
console.log('🚀 Iniciando build do Next.js...');
execSync('next build', { stdio: 'inherit' }); 