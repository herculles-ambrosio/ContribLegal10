-- Criação da tabela que armazena as faixas de números da sorte
CREATE TABLE IF NOT EXISTS public.faixas_numero_sorte (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  descricao TEXT NOT NULL,
  valor_de DECIMAL(10, 2) NOT NULL,
  valor_ate DECIMAL(10, 2) NOT NULL,
  quantidade_numeros INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.faixas_numero_sorte IS 'Tabela de configuração para as faixas de valores e quantidades de números da sorte';

-- Insere dados iniciais para as faixas
INSERT INTO public.faixas_numero_sorte (descricao, valor_de, valor_ate, quantidade_numeros)
VALUES 
  ('Faixa 1 - Até R$ 100,00', 0.00, 100.00, 1),
  ('Faixa 2 - Entre R$ 101,00 e R$ 200,00', 101.00, 200.00, 3),
  ('Faixa 3 - Entre R$ 201,00 e R$ 500,00', 201.00, 500.00, 5);

-- Criação da tabela que armazena os números da sorte atribuídos a cada documento
CREATE TABLE IF NOT EXISTS public.numeros_sorte_documento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  numero_sorte TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_numeros_sorte_documento_doc_id ON public.numeros_sorte_documento(documento_id);

COMMENT ON TABLE public.numeros_sorte_documento IS 'Tabela de relação entre documentos e os números da sorte atribuídos';

-- Função para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar o campo updated_at na tabela faixas_numero_sorte
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.faixas_numero_sorte
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Função para determinar a quantidade de números da sorte baseado no valor do documento
CREATE OR REPLACE FUNCTION public.obter_quantidade_numeros_sorte(valor DECIMAL)
RETURNS INTEGER AS $$
DECLARE
  quantidade INTEGER;
BEGIN
  SELECT fnc.quantidade_numeros INTO quantidade
  FROM public.faixas_numero_sorte fnc
  WHERE valor >= fnc.valor_de AND valor <= fnc.valor_ate
  LIMIT 1;
  
  RETURN COALESCE(quantidade, 0);
END;
$$ LANGUAGE plpgsql; 