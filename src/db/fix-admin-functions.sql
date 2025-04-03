-- Script para atualizar ou criar as funções necessárias para o painel administrativo
-- Esse script deve ser executado no SQL Editor do Supabase com uma conexão Service Role

-- 1. Função para listar TODOS os usuários para administradores
CREATE OR REPLACE FUNCTION public.admin_listar_todos_usuarios()
RETURNS SETOF usuarios
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com as permissões do criador (superusuário)
AS $$
BEGIN
  -- Validação se o usuário é administrador
  -- Essa validação pode ser comentada durante o troubleshooting inicial
  /*
  IF (SELECT COUNT(*) FROM usuarios WHERE id = auth.uid() AND master = 'S') = 0 THEN
    RAISE EXCEPTION 'Permissão negada: Apenas administradores podem listar todos os usuários';
  END IF;
  */
  
  -- Retorna todos os usuários, ignorando o RLS
  RETURN QUERY
  SELECT * FROM usuarios ORDER BY nome_completo;
END;
$$;

-- Concede permissão para função ser chamada por usuários autenticados
GRANT EXECUTE ON FUNCTION public.admin_listar_todos_usuarios() TO authenticated;

-- 2. Função para executar queries SQL arbitrárias (use com cuidado!)
CREATE OR REPLACE FUNCTION public.executar_query_admin(query_sql text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com as permissões do criador (superusuário)
AS $$
DECLARE
  resultado JSONB;
BEGIN
  -- Validação se o usuário é administrador
  -- Essa validação pode ser comentada durante o troubleshooting inicial
  /*
  IF (SELECT COUNT(*) FROM usuarios WHERE id = auth.uid() AND master = 'S') = 0 THEN
    RAISE EXCEPTION 'Permissão negada: Apenas administradores podem executar queries SQL diretas';
  END IF;
  */
  
  -- Executa a consulta e converte o resultado para JSONB
  EXECUTE 'SELECT to_jsonb(array_agg(row_to_json(t))) FROM (' || query_sql || ') t' INTO resultado;
  
  -- Retornar um array vazio se não houver resultados
  IF resultado IS NULL THEN
    resultado := '[]'::jsonb;
  END IF;
  
  RETURN resultado;
EXCEPTION WHEN OTHERS THEN
  -- Registra o erro e retorna informações úteis
  RAISE NOTICE 'Erro ao executar consulta SQL: %', SQLERRM;
  RETURN jsonb_build_object(
    'error', true,
    'message', SQLERRM,
    'query', query_sql
  );
END;
$$;

-- Concede permissão para função ser chamada por usuários autenticados
GRANT EXECUTE ON FUNCTION public.executar_query_admin(text) TO authenticated;

-- 3. Função para listar TODOS os documentos para administradores
CREATE OR REPLACE FUNCTION public.admin_listar_todos_documentos()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com as permissões do criador (superusuário)
AS $$
BEGIN
  -- Validação se o usuário é administrador
  -- Essa validação pode ser comentada durante o troubleshooting inicial
  /*
  IF (SELECT COUNT(*) FROM usuarios WHERE id = auth.uid() AND master = 'S') = 0 THEN
    RAISE EXCEPTION 'Permissão negada: Apenas administradores podem listar todos os documentos';
  END IF;
  */
  
  -- Retorna todos os documentos com informações de usuário, ignorando o RLS
  RETURN QUERY
  SELECT 
    jsonb_build_object(
      'id', d.id,
      'usuario_id', d.usuario_id,
      'tipo', d.tipo,
      'numero_documento', d.numero_documento,
      'data_emissao', d.data_emissao,
      'valor', d.valor,
      'arquivo_url', d.arquivo_url,
      'numero_sorteio', d.numero_sorteio,
      'status', d.status,
      'created_at', d.created_at,
      'usuarios', jsonb_build_object(
        'nome_completo', u.nome_completo,
        'email', u.email,
        'cpf_cnpj', u.cpf_cnpj
      )
    )
  FROM 
    documentos d
  JOIN 
    usuarios u ON d.usuario_id = u.id
  ORDER BY 
    d.created_at DESC;
END;
$$;

-- Concede permissão para função ser chamada por usuários autenticados
GRANT EXECUTE ON FUNCTION public.admin_listar_todos_documentos() TO authenticated;

-- 4. Criar ou atualizar políticas de RLS para tabela usuarios

-- Política para permitir que administradores vejam todos os usuários
DROP POLICY IF EXISTS "Admins podem ver todos os usuários" ON "usuarios";
CREATE POLICY "Admins podem ver todos os usuários" ON "usuarios"
FOR SELECT
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- Política para permitir que usuários vejam seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON "usuarios";
CREATE POLICY "Usuários podem ver seu próprio perfil" ON "usuarios"
FOR SELECT
USING (auth.uid() = id);

-- Política para permitir que administradores atualizem qualquer usuário
DROP POLICY IF EXISTS "Admins podem atualizar todos os usuários" ON "usuarios";
CREATE POLICY "Admins podem atualizar todos os usuários" ON "usuarios"
FOR UPDATE
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- CORREÇÃO: Adicionar política de inserção de usuários
DROP POLICY IF EXISTS "Inserção de novos usuários" ON "usuarios";
CREATE POLICY "Inserção de novos usuários" ON "usuarios"
FOR INSERT
WITH CHECK (true);

-- CORREÇÃO: Política para permitir que usuários atualizem seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON "usuarios";
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON "usuarios"
FOR UPDATE
USING (auth.uid() = id);

-- Certifique-se de que o RLS está habilitado na tabela
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Garantir que todo usuário tenha o campo master preenchido
UPDATE usuarios SET master = 'N' WHERE master IS NULL; 