# ContribLegal10

Sistema para extração automática de dados de cupons fiscais a partir de QR Codes para uso em controle de gastos e prestações de contas.

## Funcionalidades

- Extração de dados de cupons fiscais (NFC-e) da SEFAZ-MG a partir do link QR Code
- Interface web para uso imediato
- API com suporte a CORS para integração com aplicativos móveis
- Exemplos de integração para React Native e Flutter

## Como usar

### Web

1. Acesse a página de ajuda em `/qrcode-helper`
2. Escaneie o QR Code do cupom fiscal
3. Cole o link gerado no campo e clique em "Extrair Dados"
4. Os dados do cupom fiscal (valor e data) serão exibidos na tela

### Integração com aplicativos móveis

Use a rota `/api/fiscal-receipt-mobile` para integrar com seu aplicativo móvel. Consulte a página `/mobile-example` para exemplos de código em React Native e Flutter.

## Tecnologias utilizadas

- Next.js 14
- React
- TypeScript
- Cheerio para web scraping
- TailwindCSS para estilização

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Executar em modo de desenvolvimento
npm run dev

# Fazer build para produção
npm run build

# Iniciar versão de produção
npm start
```

## Licença

Este projeto está licenciado sob a licença MIT.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Configuração do Painel Administrativo

Para o correto funcionamento do painel administrativo, siga estes passos:

1. Certifique-se de ter a variável `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` configurada no arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
```

> **IMPORTANTE:** Em um ambiente de produção, o prefixo NEXT_PUBLIC_ expõe a variável no navegador. Para máxima segurança, considere implementar uma API serverless intermediária.

2. Execute o script SQL `src/db/fix-admin-functions.sql` no SQL Editor do Supabase para criar as funções necessárias.

3. Verifique se as políticas de RLS (Row Level Security) estão corretamente configuradas para permitir que administradores visualizem todos os registros.

### Resolução de Problemas

Se você encontrar erros como:
- "Erro ao executar query via RPC: {}"
- "Erro na resposta REST: No API key found in request"

Verifique:
1. Se a variável `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` está corretamente configurada
2. Se as funções SQL foram criadas com sucesso
3. Se o usuário que está acessando tem a flag `master = 'S'` no banco de dados

Mais detalhes na documentação: [ADMIN_CONFIG.md](./ADMIN_CONFIG.md)

## Estrutura de Banco de Dados

### Tabelas Principais

- **usuarios**: Armazena os dados dos usuários registrados
- **documentos**: Armazena os documentos fiscais cadastrados pelos usuários
- **numeros_sorte_documento**: Armazena os números da sorte gerados para cada documento validado
- **faixas_numero_sorte**: Configura as faixas de valores para geração de números da sorte
- **empresa**: Armazena os dados da empresa cliente do Contribuinte Legal, incluindo status de ativação (ATIVO, INATIVO ou BLOQUEADO)

### Modelo de Dados

#### Tabela `empresa`

| Campo             | Tipo                 | Descrição                                                      |
|-------------------|----------------------|----------------------------------------------------------------|
| id                | UUID                 | Identificador único da empresa                                 |
| nome_razao_social | TEXT                 | Nome ou razão social da empresa                                |
| cnpj              | TEXT                 | CNPJ da empresa                                                |
| endereco          | TEXT                 | Endereço da empresa                                            |
| bairro            | TEXT                 | Bairro                                                         |
| municipio         | TEXT                 | Município                                                      |
| uf                | TEXT                 | Estado (UF)                                                    |
| cep               | TEXT                 | CEP                                                            |
| status            | TEXT                 | Status da empresa: ATIVO, INATIVO ou BLOQUEADO                 |
| created_at        | TIMESTAMP            | Data de criação do registro                                    |
| updated_at        | TIMESTAMP            | Data da última atualização                                     |

O status da empresa controla o acesso ao sistema:
- **ATIVO**: Acesso completo ao sistema
- **INATIVO**: Usuários podem apenas visualizar documentos (sem poder cadastrar novos)
- **BLOQUEADO**: Bloqueia completamente o acesso ao sistema
