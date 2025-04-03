-- Script para corrigir as políticas de RLS para solucionar problemas de autenticação
-- Esse script deve ser executado no SQL Editor do Supabase com uma conexão Service Role

-- 1. Adicionar políticas ausentes na tabela usuarios

-- Política para permitir que usuários sejam inseridos na tabela (sem esta política, o signup não funciona)
DROP POLICY IF EXISTS "Inserção de novos usuários" ON "usuarios";
CREATE POLICY "Inserção de novos usuários" ON "usuarios"
FOR INSERT
WITH CHECK (true);

-- Política para permitir que usuários atualizem seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON "usuarios";
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON "usuarios"
FOR UPDATE
USING (auth.uid() = id);

-- 2. Verificar se existem todas as políticas necessárias para documentos

-- Garantir que exista uma política para usuários verem apenas seus próprios documentos
DROP POLICY IF EXISTS "Usuários veem seus próprios documentos" ON "documentos";
CREATE POLICY "Usuários veem seus próprios documentos" ON "documentos"
FOR SELECT
USING (auth.uid() = usuario_id);

-- Garantir que administradores possam ver todos os documentos
DROP POLICY IF EXISTS "Admins podem ver todos os documentos" ON "documentos";
CREATE POLICY "Admins podem ver todos os documentos" ON "documentos"
FOR SELECT
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- Garantir que usuários possam inserir documentos associados a eles mesmos
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios documentos" ON "documentos";
CREATE POLICY "Usuários podem inserir seus próprios documentos" ON "documentos"
FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

-- Garantir que usuários possam atualizar apenas seus próprios documentos
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios documentos" ON "documentos";
CREATE POLICY "Usuários podem atualizar seus próprios documentos" ON "documentos"
FOR UPDATE
USING (auth.uid() = usuario_id);

-- Garantir que administradores possam atualizar qualquer documento
DROP POLICY IF EXISTS "Admins podem atualizar todos os documentos" ON "documentos";
CREATE POLICY "Admins podem atualizar todos os documentos" ON "documentos"
FOR UPDATE
USING ((SELECT master FROM usuarios WHERE id = auth.uid()) = 'S');

-- 3. Garantir que o RLS está habilitado em todas as tabelas relevantes
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- 4. Adicionar campo 'master' com valor padrão para evitar erros
-- Verificar se a coluna master existe, se não, adicioná-la
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

-- 5. Adicionar trigger para garantir que novos usuários tenham o campo master preenchido
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

-- Garantir que usuários existentes tenham o campo master preenchido
UPDATE usuarios SET master = 'N' WHERE master IS NULL;

-- Confirmar que o administrador tem master = 'S'
UPDATE usuarios SET master = 'S' WHERE id = '00000000-0000-0000-0000-000000000001' OR email = 'admin@sistema.com'; 