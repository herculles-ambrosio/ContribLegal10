// Script para verificar o usuário administrador
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkAdminUser() {
  try {
    console.log('Verificando usuário administrador...');
    
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
    
    // Verificar na tabela de usuários
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('cpf_cnpj', '30466125000172')
      .single();
      
    console.log('Perfil na tabela usuarios:', { profileData, profileError });
    
    if (profileData && profileData.email) {
      // Verificar na autenticação do Supabase
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      console.log('Total de usuários na auth:', authData?.users?.length);
      
      const adminUser = authData?.users?.find(user => user.email === profileData.email);
      
      if (adminUser) {
        console.log('Usuário encontrado na auth:');
        console.log('- ID:', adminUser.id);
        console.log('- Email:', adminUser.email);
        console.log('- Criado em:', new Date(adminUser.created_at).toLocaleString());
        console.log('- Dados adicionais:', adminUser.user_metadata);
        
        // Testar login com esse usuário
        const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
          email: 'admin@sistema.com',
          password: '@13152122'
        });
        
        console.log('Teste de login:', { 
          success: !!signInData?.user,
          error: signInError,
          user: signInData?.user ? {
            id: signInData.user.id,
            email: signInData.user.email,
            role: signInData.user.role
          } : null
        });
      } else {
        console.log('Usuário existe na tabela usuarios mas NÃO na autenticação!');
        console.log('É necessário recriar o usuário na autenticação.');
      }
    } else {
      console.log('Usuário administrador não encontrado na tabela usuarios.');
    }
    
  } catch (error) {
    console.error('Erro ao verificar o usuário administrador:', error);
  }
}

// Executar a função
checkAdminUser(); 