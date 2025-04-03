# Instruções para Correção dos Problemas de Autenticação

O sistema está apresentando erros de autenticação em loop devido a problemas com as políticas de RLS (Row Level Security). Este documento fornece instruções para solucionar o problema.

## ⚠️ SOLUÇÃO DE EMERGÊNCIA

Siga estas etapas para resolver o problema imediatamente:

1. Acesse o **Painel Administrativo do Supabase**
2. Vá para a seção **SQL Editor**
3. Execute o script **src/db/emergency-fix.sql**:
   ```sql
   -- Script de emergência para resolver problemas de autenticação
   ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
   ALTER TABLE documentos DISABLE ROW LEVEL SECURITY;
   
   -- Garantir que todos os usuários tenham valor no campo master
   UPDATE usuarios SET master = 'N' WHERE master IS NULL;
   
   -- Garantir que o administrador tenha master = 'S'
   UPDATE usuarios 
   SET master = 'S' 
   WHERE id = '00000000-0000-0000-0000-000000000001' 
      OR email = 'admin@sistema.com';
   ```
4. Reinicie o servidor da aplicação com `npm run dev`
5. Verifique se o login e acesso às informações de usuário já funcionam

## Explicação do Problema

Os erros aparecem em loop porque:

1. O RLS está bloqueando o acesso à tabela `usuarios`
2. Mesmo com políticas criadas, há problemas nas condições de filtragem
3. O loop ocorre porque tenta-se constantemente acessar dados que estão protegidos por RLS

## Solução Completa (Após Restaurar Acesso)

Após restaurar o acesso com a solução de emergência, você pode implementar corretamente as políticas RLS seguindo estas etapas:

1. Crie políticas adequadas para todas as operações nas tabelas
2. Implemente funções SECURITY DEFINER para operações administrativas
3. Configure corretamente a autenticação e a SERVICE_ROLE_KEY

Para uma solução completa que implementa o RLS de forma segura, execute o script `src/db/fix-rls-complete.sql` **apenas depois** que o acesso estiver funcionando.

## Prevenção de Problemas Futuros

- **Teste gradualmente**: Ative políticas RLS uma por uma, testando após cada alteração
- **Mantenha uma rota de escape**: Sempre tenha um método para desabilitar o RLS em emergências
- **Backup de políticas**: Mantenha documentação e scripts de todas as políticas de segurança

## Verificação do Sistema

Use o script de verificação para confirmar que todas as configurações estão corretas:

```
node src/scripts/verify-database.js
``` 