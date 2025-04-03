-- Função para permitir administradores executar consultas SQL diretamente
-- IMPORTANTE: Use essa função com extremo cuidado, pois ela pode comprometer a segurança se usada incorretamente
-- Essa função só deve ser chamada em contexto administrativo, após autenticação e verificação de permissões

-- O código abaixo deve ser executado como superusuário no Supabase
CREATE OR REPLACE FUNCTION public.executar_query_admin(query_sql text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com as permissões do criador (superusuário)
AS $$
DECLARE
  resultado JSONB;
BEGIN
  -- Validar se o usuário tem permissão para executar consultas administrativas
  -- Sugerimos implementar esse controle através de RLS ou outra abordagem de segurança
  IF (SELECT COUNT(*) FROM usuarios WHERE id = auth.uid() AND master = 'S') = 0 THEN
    RAISE EXCEPTION 'Permissão negada: Apenas administradores podem executar consultas SQL diretas';
  END IF;

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
GRANT EXECUTE ON FUNCTION public.executar_query_admin TO authenticated;

-- Nota: Esta função deve ser implementada junto com políticas de RLS complementares 
-- para garantir que apenas administradores possam executá-la, mesmo tendo 
-- concedido permissão para todos os usuários autenticados.

-- Exemplo de uso:
-- SELECT * FROM executar_query_admin('SELECT * FROM usuarios ORDER BY nome_completo');
