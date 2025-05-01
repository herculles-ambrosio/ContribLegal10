# Controle de status da tabela empresa

## SQL para criação da tabela

```sql
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
```

## Lógica de validação do status da empresa

Os campos de status da empresa funcionam da seguinte forma:

- **ATIVO**: Acesso completo ao sistema (usuários podem consultar e cadastrar documentos)
- **INATIVO**: Usuários podem apenas visualizar documentos (sem cadastrar novos)
- **BLOQUEADO**: Bloqueia completamente o acesso ao sistema

## Modificações realizadas

1. Criada tabela "empresa" no Supabase
2. Implementada verificação de status da empresa durante o login
3. Modificada a página de dashboard para redirecionar conforme o status
4. Adicionado alerta na página do contribuinte quando o status é "INATIVO"
5. Criada página administrativa para gerenciar empresas (/admin/empresas)
6. Desenvolvidos componentes UI para suportar a interface de gerenciamento (Tooltip, Modal, etc.)

Esta implementação permite controlar o acesso ao sistema de forma centralizada através da tabela empresa.
