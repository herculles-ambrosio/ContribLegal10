// Script para gerar o SQL para inserir o administrador
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function generateAdminSQL() {
  try {
    console.log('Iniciando geração do SQL para administrador...');
    
    const sql = `
-- Verificar se o administrador já existe
DO $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'admin@sistema.com') INTO admin_exists;
  
  IF NOT admin_exists THEN
    -- Inserir usuário na tabela auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
      'authenticated',
      'authenticated',
      'admin@sistema.com',
      '$2a$10$RUyuIQTBNl6xiVcBzUHm8uZrBzaxlnkSRBvT0QiuEr2E7mqg9sYEO',  -- senha: @13152122
      NOW(),
      NULL,
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"nome_completo": "Administrador do Sistema", "tipo_usuario": "Administrador Sistema"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
    
    RAISE NOTICE 'Administrador inserido na tabela auth.users';
  ELSE
    RAISE NOTICE 'Administrador já existe na tabela auth.users';
  END IF;
  
  -- Verificar se o perfil do administrador já existe
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE cpf_cnpj = '30466125000172') THEN
    -- Inserir perfil do administrador
    INSERT INTO public.usuarios (
      id,
      email,
      nome_completo,
      cpf_cnpj,
      telefone,
      endereco,
      cidade,
      estado,
      cep,
      role,
      tipo_usuario
    )
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      'admin@sistema.com',
      'Administrador do Sistema',
      '30466125000172',
      '0000000000',
      'Endereço do Sistema',
      'Cidade do Sistema',
      'MG',
      '00000000',
      'admin',
      'Administrador Sistema'
    );
    
    RAISE NOTICE 'Perfil do administrador inserido na tabela public.usuarios';
  ELSE
    RAISE NOTICE 'Perfil do administrador já existe na tabela public.usuarios';
  END IF;
END $$;
    `;
    
    console.log('SQL gerado com sucesso:');
    console.log(sql);
    
    // Configuração do cliente Supabase com service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Executar o SQL
    console.log('Executando SQL no Supabase...');
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Erro ao executar SQL:', error);
    } else {
      console.log('SQL executado com sucesso:', data);
    }
    
    console.log('\nInstruções para login do administrador:');
    console.log('- CNPJ: 30466125000172');
    console.log('- Senha: @13152122');
    
  } catch (error) {
    console.error('Erro ao gerar SQL para administrador:', error);
  }
}

// Executar a função
generateAdminSQL(); 