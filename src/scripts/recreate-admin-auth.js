// Script para recriar o usuário administrador na auth do Supabase
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function recreateAdminAuth() {
  try {
    console.log('Iniciando recriação do usuário administrador na autenticação...');
    
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
    
    // Verificar se o usuário admin existe na tabela usuarios
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('cpf_cnpj', '30466125000172')
      .single();
      
    console.log('Perfil na tabela usuarios:', { 
      id: profileData?.id,
      email: profileData?.email,
      tipo: profileData?.tipo_usuario,
      erro: profileError
    });
    
    if (!profileData) {
      throw new Error('Usuário não encontrado na tabela usuarios');
    }
    
    // Verificar se o usuário já existe na autenticação
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = authData?.users?.find(user => user.email === profileData.email);
    
    if (existingAuthUser) {
      console.log('Usuário já existe na autenticação. Deletando...');
      await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
      console.log('Usuário deletado da autenticação');
    }
    
    // Recriar o usuário na autenticação
    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: profileData.email,
      password: '@13152122',
      email_confirm: true,
      user_metadata: {
        nome_completo: profileData.nome_completo,
        tipo_usuario: profileData.tipo_usuario
      },
      // Importante: usar o mesmo ID que está na tabela usuarios
      id: profileData.id
    });
    
    if (authError) {
      throw authError;
    }
    
    console.log('Usuário recriado na autenticação:');
    console.log('- ID:', newAuthUser.user.id);
    console.log('- Email:', newAuthUser.user.email);
    console.log('- Criado em:', new Date(newAuthUser.user.created_at).toLocaleString());
    
    // Testar login com o usuário recriado
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: profileData.email,
      password: '@13152122'
    });
    
    if (signInError) {
      console.error('Erro no teste de login:', signInError);
    } else {
      console.log('Teste de login bem-sucedido!');
      console.log('- ID do usuário logado:', signInData.user.id);
    }
    
    console.log('Processo finalizado com sucesso!');
  } catch (error) {
    console.error('Erro ao recriar usuário administrador na autenticação:', error);
  }
}

// Executar a função
recreateAdminAuth(); 