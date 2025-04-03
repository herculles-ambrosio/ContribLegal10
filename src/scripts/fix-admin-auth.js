// Script para consertar o usuário administrador
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fixAdminUser() {
  try {
    console.log('Iniciando correção do usuário administrador...');
    
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
      
    if (profileError) {
      throw new Error(`Erro ao buscar perfil: ${profileError.message}`);
    }
    
    console.log('Perfil encontrado:', { 
      id: profileData.id,
      email: profileData.email,
      tipo: profileData.tipo_usuario
    });
    
    // 1. Criar novo usuário na auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@sistema.com',
      password: '@13152122',
      email_confirm: true,
      user_metadata: {
        nome_completo: 'Administrador do Sistema',
        tipo_usuario: 'Administrador Sistema'
      }
    });
    
    if (authError) {
      throw new Error(`Erro ao criar usuário auth: ${authError.message}`);
    }
    
    const newUserId = authUser.user.id;
    console.log('Novo usuário criado na auth:', { 
      id: newUserId,
      email: authUser.user.email
    });
    
    // 2. Atualizar a referência de id na tabela usuarios
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ id: newUserId })
      .eq('id', profileData.id)
      .select()
      .single();
      
    if (updateError) {
      // Se falhar, precisamos deletar o usuário na auth para evitar duplicidade
      console.error('Erro ao atualizar perfil:', updateError);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
    }
    
    console.log('Perfil atualizado com novo ID:', { 
      oldId: profileData.id,
      newId: updateData.id,
      email: updateData.email
    });
    
    // 3. Testar login
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: 'admin@sistema.com',
      password: '@13152122'
    });
    
    if (signInError) {
      console.error('Erro no teste de login:', signInError);
    } else {
      console.log('Teste de login bem-sucedido!');
      console.log('- ID do usuário logado:', signInData.user.id);
    }
    
    console.log('\nInstruções para login:');
    console.log('- CNPJ: 30466125000172');
    console.log('- Senha: @13152122');
    console.log('\nProcesso finalizado com sucesso!');
  } catch (error) {
    console.error('Erro ao consertar usuário administrador:', error);
  }
}

// Executar a função
fixAdminUser(); 