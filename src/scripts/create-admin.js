// Script para criar usuário administrador
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function createAdminUser() {
  try {
    console.log('Iniciando criação do usuário administrador...');
    
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
    
    // Verificar se o usuário admin já existe
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, cpf_cnpj, tipo_usuario')
      .eq('cpf_cnpj', '30466125000172')
      .single();
      
    console.log('Verificação de usuário existente:', { existingUser, checkError });
    
    if (!existingUser) {
      console.log('Criando novo usuário administrador...');
      
      // Criar usuário na autenticação do Supabase
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: 'admin@sistema.com',
        password: '@13152122',
        email_confirm: true,
        user_metadata: {
          nome_completo: 'Administrador do Sistema',
          tipo_usuario: 'Administrador Sistema'
        }
      });
      
      console.log('Criação de usuário auth:', { authUser, authError });
      
      if (authError) {
        throw authError;
      }
      
      if (!authUser.user) {
        throw new Error('Falha ao criar usuário auth');
      }
      
      // Criar perfil do usuário
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('usuarios')
        .insert({
          id: authUser.user.id,
          email: 'admin@sistema.com',
          nome_completo: 'Administrador do Sistema',
          cpf_cnpj: '30466125000172',
          telefone: '0000000000',
          endereco: 'Endereço do Sistema',
          cidade: 'Cidade do Sistema',
          estado: 'MG',
          cep: '00000000',
          role: 'admin',
          tipo_usuario: 'Administrador Sistema'
        })
        .select()
        .single();
        
      console.log('Criação de perfil:', { profileData, profileError });
      
      if (profileError) {
        throw profileError;
      }
      
      console.log('Usuário administrador criado com sucesso!');
      console.log('- ID:', profileData.id);
      console.log('- Email:', profileData.email);
      console.log('- CNPJ:', profileData.cpf_cnpj);
      console.log('- Tipo:', profileData.tipo_usuario);
    } else {
      console.log('Usuário administrador já existe:');
      console.log('- ID:', existingUser.id);
      console.log('- Email:', existingUser.email);
      console.log('- CNPJ:', existingUser.cpf_cnpj);
      console.log('- Tipo:', existingUser.tipo_usuario);
    }
    
    console.log('Processo finalizado com sucesso!');
  } catch (error) {
    console.error('Erro ao executar a criação do administrador:', error);
  }
}

// Executar a função
createAdminUser(); 