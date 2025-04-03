-- Função para listar TODOS os usuários para administradores
-- IMPORTANTE: Esta função executa com SECURITY DEFINER, o que significa que
-- ela ignora as políticas de RLS e executa com as permissões do criador (superusuário)

-- O código abaixo deve ser executado como superusuário no Supabase
CREATE OR REPLACE FUNCTION public.admin_listar_todos_usuarios()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com as permissões do criador (superusuário)
AS $$
BEGIN
  -- Validar se o usuário tem permissão para acessar todos os usuários (é administrador)
  IF (SELECT COUNT(*) FROM usuarios WHERE id = auth.uid() AND master = 'S') = 0 THEN
    RAISE EXCEPTION 'Permissão negada: Apenas administradores podem listar todos os usuários';
  END IF;

  -- Retorna todos os usuários, ignorando o RLS
  RETURN QUERY
  SELECT 
    jsonb_build_object(
      'id', id,
      'email', email,
      'nome_completo', nome_completo,
      'cpf_cnpj', cpf_cnpj,
      'telefone', telefone,
      'endereco', endereco,
      'cidade', cidade,
      'estado', estado,
      'cep', cep,
      'created_at', created_at,
      'role', role,
      'master', master
    )
  FROM 
    usuarios
  ORDER BY 
    nome_completo;
END;
$$;

-- Concede permissão para função ser chamada por usuários autenticados
GRANT EXECUTE ON FUNCTION public.admin_listar_todos_usuarios TO authenticated;

-- Nota: Esta função deve ser implementada junto com políticas de RLS complementares 
-- para garantir que apenas administradores possam executá-la, mesmo tendo 
-- concedido permissão para todos os usuários autenticados.
