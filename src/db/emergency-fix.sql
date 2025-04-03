-- Script de emergência para resolver problemas de autenticação
-- Execute isso IMEDIATAMENTE no SQL Editor do Supabase

-- PARTE 1: DESABILITAR COMPLETAMENTE O RLS PARA RESTAURAR ACESSO
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE documentos DISABLE ROW LEVEL SECURITY;

-- PARTE 2: GARANTIR QUE O CAMPO MASTER ESTEJA CORRETO
-- Garantir que todos os usuários tenham valor no campo master
UPDATE usuarios SET master = 'N' WHERE master IS NULL;

-- Garantir que o administrador tenha master = 'S'
UPDATE usuarios 
SET master = 'S' 
WHERE id = '00000000-0000-0000-0000-000000000001' 
   OR email = 'admin@sistema.com';

-- PARTE 3: VERIFICAR SE AS FUNÇÕES ADMIN EXISTEM E ESTÃO CORRETAS
DO $$
BEGIN
  -- Verificar se a função admin_listar_todos_usuarios existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'admin_listar_todos_usuarios'
  ) THEN
    -- Criar uma versão simplificada da função que retorna JSONB
    CREATE OR REPLACE FUNCTION public.admin_listar_todos_usuarios()
    RETURNS SETOF jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        jsonb_build_object(
          'id', id,
          'email', email,
          'nome_completo', nome_completo,
          'cpf_cnpj', cpf_cnpj,
          'master', master
        )
      FROM 
        usuarios
      ORDER BY 
        nome_completo;
    END;
    $$;
    
    -- Conceder permissão
    GRANT EXECUTE ON FUNCTION public.admin_listar_todos_usuarios() TO authenticated;
  END IF;
  
  -- Verificar se a função executar_query_admin existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'executar_query_admin'
  ) THEN
    -- Criar uma versão simplificada da função
    CREATE OR REPLACE FUNCTION public.executar_query_admin(query_sql text)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      resultado JSONB;
    BEGIN
      EXECUTE 'SELECT to_jsonb(array_agg(row_to_json(t))) FROM (' || query_sql || ') t' INTO resultado;
      IF resultado IS NULL THEN
        resultado := '[]'::jsonb;
      END IF;
      RETURN resultado;
    END;
    $$;
    
    -- Conceder permissão
    GRANT EXECUTE ON FUNCTION public.executar_query_admin(text) TO authenticated;
  END IF;
END $$; 