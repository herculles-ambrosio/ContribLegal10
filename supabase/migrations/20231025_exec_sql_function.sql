-- Função para executar consultas SQL dinâmicas
-- Esta função só deve ser usada por administradores
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com os privilégios do criador da função
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Verifica se a consulta começa com SELECT (medida de segurança)
    IF NOT starts_with(upper(trim(sql_query)), 'SELECT') THEN
        RAISE EXCEPTION 'Apenas consultas SELECT são permitidas';
    END IF;

    -- Executa a consulta e captura o resultado como JSONB
    EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql_query || ') t' INTO result;
    
    -- Se o resultado for nulo (sem dados), retorna um array vazio
    IF result IS NULL THEN
        result := '[]'::JSONB;
    END IF;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Em caso de erro, retorna um objeto com a mensagem de erro
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

-- Garante que apenas usuários com a role 'service_role' podem executar essa função
REVOKE ALL ON FUNCTION exec_sql(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role; 