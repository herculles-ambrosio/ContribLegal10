-- Criação da tabela empresa
CREATE TABLE IF NOT EXISTS public.empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_razao_social TEXT NOT NULL,
    cnpj TEXT NOT NULL UNIQUE,
    endereco TEXT,
    bairro TEXT,
    municipio TEXT,
    cep TEXT,
    uf TEXT,
    status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO', 'BLOQUEADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criação de um gatilho para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.empresa
FOR EACH ROW
EXECUTE FUNCTION trigger_set_updated_at();

-- Comentários para documentação da tabela
COMMENT ON TABLE public.empresa IS 'Tabela para armazenar informações das empresas clientes do Contribuinte Legal';
COMMENT ON COLUMN public.empresa.status IS 'Controla o acesso ao sistema: ATIVO (acesso completo), INATIVO (apenas consultas), BLOQUEADO (sem acesso)'; 