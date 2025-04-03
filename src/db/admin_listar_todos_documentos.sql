-- Função para listar TODOS os documentos para administradores
-- IMPORTANTE: Esta função executa com SECURITY DEFINER, o que significa que
-- ela ignora as políticas de RLS e executa com as permissões do criador (superusuário)

-- O código abaixo deve ser executado como superusuário no Supabase
CREATE OR REPLACE FUNCTION public.admin_listar_todos_documentos()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com as permissões do criador (superusuário)
AS $$
BEGIN
  -- Validar se o usuário tem permissão para acessar todos os documentos (é administrador)
  IF (SELECT COUNT(*) FROM usuarios WHERE id = auth.uid() AND master = 'S') = 0 THEN
    RAISE EXCEPTION 'Permissão negada: Apenas administradores podem listar todos os documentos';
  END IF;

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
GRANT EXECUTE ON FUNCTION public.admin_listar_todos_documentos TO authenticated;

-- Nota: Esta função deve ser implementada junto com políticas de RLS complementares 
-- para garantir que apenas administradores possam executá-la, mesmo tendo 
-- concedido permissão para todos os usuários autenticados.
