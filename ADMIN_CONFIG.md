# Configuração do Painel Administrativo

Este documento descreve como configurar corretamente o painel administrativo para acessar **todos** os documentos e usuários, contornando as restrições de RLS (Row Level Security) do Supabase.

## Problema

O painel administrativo precisa acessar todos os documentos e usuários do sistema, independentemente do usuário logado. No entanto, as políticas de RLS (Row Level Security) do Supabase podem impedir que administradores vejam dados de outros usuários.

Os erros comuns são:
- "FALHA: Não foi possível carregar nenhum documento. Possivelmente um problema de permissões (RLS)."
- "ATENÇÃO: O admin deve ver TODOS os documentos de TODOS os usuários!"
- "FALHA: Não foi possível carregar a lista de usuários mesmo após múltiplas tentativas."
- "ATENÇÃO: O admin deve ver TODOS os usuários do sistema!"
- "Erro ao executar query via RPC: {}"
- "Erro na resposta REST: No API key found in request"

## Solução

### 1. Configuração das Variáveis de Ambiente

Adicione a chave de serviço do Supabase (service role key) ao seu arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANTE:** 
- Em um ambiente de produção, o prefixo `NEXT_PUBLIC_` expõe a chave de serviço ao navegador, o que representa um risco de segurança.
- Idealmente, essa chave deveria ser usada apenas em um ambiente de servidor (API Routes do Next.js ou um backend separado).
- Para maior segurança em produção, considere:
  1. Implementar API routes serverless que façam as chamadas administrativas
  2. Usar autenticação de dois fatores para administradores 
  3. Limitar os endereços IP de onde os administradores podem acessar

### 2. Implementação das Funções SQL no Supabase

Execute os seguintes scripts SQL no SQL Editor do Supabase:

1. `src/db/fix-admin-functions.sql` - Cria todas as funções necessárias e configura as políticas RLS

### 3. Configuração de Políticas de RLS

Verifique se as políticas de RLS do Supabase estão corretamente configuradas. O script `fix-admin-functions.sql` já deve ter configurado:

#### Para a tabela 'usuarios':

```sql
-- Política para permitir que administradores vejam todos os usuários
CREATE POLICY "Admins podem ver todos os usuários" ON "usuarios"
FOR SELECT
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- Política para permitir que usuários vejam seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil" ON "usuarios"
FOR SELECT
USING (auth.uid() = id);

-- Política para permitir que administradores atualizem qualquer usuário
CREATE POLICY "Admins podem atualizar todos os usuários" ON "usuarios"
FOR UPDATE
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');
```

## Estratégias de Fallback

O código implementa várias estratégias de fallback para garantir que os administradores possam acessar todos os dados:

1. Primeiro, tenta usar a função RPC específica para administradores
2. Se falhar, tenta recuperar dados via SQL direto usando a service role key
3. Em seguida, tenta usar o método padrão do Supabase cliente
4. Como alternativa, tenta um fetch direto com a apikey nos headers
5. Por fim, como último recurso, tenta carregar IDs e depois buscar cada registro individualmente

## Depuração

Se ainda houver problemas:

1. Verifique os logs do console para mensagens de erro detalhadas
2. Confirme se as funções SQL foram criadas corretamente no Supabase
3. Verifique se o usuário logado tem realmente a flag `master = 'S'` no banco de dados
4. Confirme se a chave de serviço (`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`) está corretamente configurada no ambiente
5. Verifique se os headers das requisições incluem a apikey corretamente

## Segurança

**ATENÇÃO**: As soluções implementadas oferecem acesso administrativo completo ao banco de dados. Certifique-se de:

1. Validar rigorosamente quem é administrador antes de conceder esse acesso
2. Em ambientes de produção, não utilize o prefixo `NEXT_PUBLIC_` para a chave de serviço
3. Implementar um modelo de acesso baseado em API Routes do Next.js para operações administrativas em produção
4. Auditar regularmente as operações realizadas por administradores
