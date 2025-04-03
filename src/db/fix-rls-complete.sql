-- Script completo para corrigir problemas de autenticação e acesso relacionados ao RLS
-- Este script deve ser executado no SQL Editor do Supabase com uma conexão Service Role

-- ========================================================================
-- PARTE 1: DESABILITAR TEMPORARIAMENTE O RLS PARA DIAGNÓSTICO
-- ========================================================================

-- Desabilitar temporariamente RLS nas tabelas principais para permitir login e diagnóstico
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE documentos DISABLE ROW LEVEL SECURITY;

-- ========================================================================
-- PARTE 2: CORREÇÃO DAS FUNÇÕES ADMIN
-- ========================================================================

-- Atualizar a função admin_listar_todos_usuarios para retornar JSONB
-- Isso evita problemas com o RLS quando retornamos tipo usuarios diretamente
CREATE OR REPLACE FUNCTION public.admin_listar_todos_usuarios()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Retorna todos os usuários como JSONB, ignorando o RLS
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
      'master', master,
      'tipo_usuario', tipo_usuario
    )
  FROM 
    usuarios
  ORDER BY 
    nome_completo;
END;
$$;

-- Atualizar permissão
GRANT EXECUTE ON FUNCTION public.admin_listar_todos_usuarios() TO authenticated;

-- Atualizar a função admin_listar_todos_documentos para mais robustez
CREATE OR REPLACE FUNCTION public.admin_listar_todos_documentos()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- Atualizar permissão
GRANT EXECUTE ON FUNCTION public.admin_listar_todos_documentos() TO authenticated;

-- ========================================================================
-- PARTE 3: PREPARAR A TABELA USUARIOS
-- ========================================================================

-- Garantir que a coluna master existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'master'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN master CHAR(1) DEFAULT 'N';
  END IF;
END $$;

-- Garantir que todos os usuários tenham valor no campo master
UPDATE usuarios SET master = 'N' WHERE master IS NULL;

-- Garantir que o administrador tenha master = 'S'
UPDATE usuarios 
SET master = 'S' 
WHERE id = '00000000-0000-0000-0000-000000000001' 
   OR email = 'admin@sistema.com';

-- Verificar se existe um usuário administrador, criar se não existir
DO $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM usuarios 
    WHERE email = 'admin@sistema.com' OR id = '00000000-0000-0000-0000-000000000001'
  ) INTO admin_exists;
  
  IF NOT admin_exists THEN
    -- Inserir usuário admin
    INSERT INTO usuarios (
      id, email, nome_completo, cpf_cnpj, 
      role, master, tipo_usuario
    ) VALUES (
      '00000000-0000-0000-0000-000000000001',
      'admin@sistema.com',
      'Administrador do Sistema',
      '12345678901',
      'admin',
      'S',
      'Administrador'
    );
  END IF;
END $$;

-- ========================================================================
-- PARTE 4: RECRIAR TODAS AS POLÍTICAS RLS CORRETAMENTE
-- ========================================================================

-- Limpar políticas existentes que possam estar com problemas
DROP POLICY IF EXISTS "Admins podem ver todos os usuários" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON usuarios;
DROP POLICY IF EXISTS "Admins podem atualizar todos os usuários" ON usuarios;
DROP POLICY IF EXISTS "Inserção de novos usuários" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON usuarios;
DROP POLICY IF EXISTS "Usuários veem seus próprios documentos" ON documentos;
DROP POLICY IF EXISTS "Admins podem ver todos os documentos" ON documentos;
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios documentos" ON documentos;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios documentos" ON documentos;
DROP POLICY IF EXISTS "Admins podem atualizar todos os documentos" ON documentos;

-- Trigger para garantir o campo master preenchido
CREATE OR REPLACE FUNCTION assegurar_master_preenchido()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.master IS NULL THEN
    NEW.master := 'N';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assegurar_master ON usuarios;
CREATE TRIGGER trigger_assegurar_master
BEFORE INSERT OR UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION assegurar_master_preenchido();

-- POLÍTICAS PARA TABELA USUARIOS

-- 1. Política para permitir que todos os usuários possam ser criados (signup)
CREATE POLICY "Permitir criação de usuários" ON usuarios
FOR INSERT 
WITH CHECK (true);

-- 2. Política para permitir que usuários vejam seu próprio perfil
CREATE POLICY "Usuários veem seu próprio perfil" ON usuarios
FOR SELECT
USING (auth.uid() = id);

-- 3. Política para permitir que usuários atualizem seu próprio perfil
CREATE POLICY "Usuários atualizam seu próprio perfil" ON usuarios
FOR UPDATE
USING (auth.uid() = id);

-- 4. Política para permitir que administradores vejam todos os usuários
CREATE POLICY "Admins veem todos os usuários" ON usuarios
FOR SELECT
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- 5. Política para permitir que administradores atualizem todos os usuários
CREATE POLICY "Admins atualizam todos os usuários" ON usuarios
FOR UPDATE
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- 6. Política para permitir que administradores excluam usuários
CREATE POLICY "Admins podem excluir usuários" ON usuarios
FOR DELETE
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- POLÍTICAS PARA TABELA DOCUMENTOS

-- 1. Política para permitir que usuários vejam seus próprios documentos
CREATE POLICY "Usuários veem seus documentos" ON documentos
FOR SELECT
USING (auth.uid() = usuario_id);

-- 2. Política para permitir que usuários criem seus próprios documentos
CREATE POLICY "Usuários criam seus documentos" ON documentos
FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

-- 3. Política para permitir que usuários atualizem seus próprios documentos
CREATE POLICY "Usuários atualizam seus documentos" ON documentos
FOR UPDATE
USING (auth.uid() = usuario_id);

-- 4. Política para permitir que usuários excluam seus próprios documentos
CREATE POLICY "Usuários excluem seus documentos" ON documentos
FOR DELETE
USING (auth.uid() = usuario_id);

-- 5. Política para permitir que administradores vejam todos os documentos
CREATE POLICY "Admins veem todos os documentos" ON documentos
FOR SELECT
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- 6. Política para permitir que administradores atualizem todos os documentos
CREATE POLICY "Admins atualizam todos os documentos" ON documentos
FOR UPDATE
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- 7. Política para permitir que administradores excluam documentos
CREATE POLICY "Admins podem excluir documentos" ON documentos
FOR DELETE
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- ========================================================================
-- PARTE 5: REATIVAR RLS COM AS NOVAS POLÍTICAS
-- ========================================================================

-- Reativar o RLS nas tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY; 