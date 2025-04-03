This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
