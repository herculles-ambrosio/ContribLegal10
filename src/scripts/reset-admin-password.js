// Script para redefinir a senha do administrador
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function resetAdminPassword() {
  try {
    console.log('Iniciando redefinição de senha do administrador...');
    
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
    
    // 1. Encontrar o usuário admin na tabela usuarios
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
    
    // 2. Encontrar o usuário na auth usando o email
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const adminUser = authData?.users?.find(user => user.email === profileData.email);
    
    if (adminUser) {
      console.log('Usuário encontrado na autenticação:', {
        id: adminUser.id,
        email: adminUser.email
      });
      
      // 3. Atualizar a senha do usuário
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        adminUser.id,
        { 
          password: '@13152122',
          email_confirm: true
        }
      );
      
      if (updateError) {
        throw new Error(`Erro ao atualizar senha: ${updateError.message}`);
      }
      
      console.log('Senha atualizada com sucesso!');
      
      // 4. Testar o login com a nova senha
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: profileData.email,
        password: '@13152122'
      });
      
      if (signInError) {
        console.error('Erro no teste de login após redefinição:', signInError);
        throw new Error(`Erro no teste de login: ${signInError.message}`);
      }
      
      console.log('Teste de login bem-sucedido!');
      console.log('- ID do usuário logado:', signInData.user.id);
      
    } else {
      console.log('Usuário não encontrado na autenticação. Criando novo usuário...');
      
      // 5. Criar novo usuário na autenticação
      const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: profileData.email,
        password: '@13152122',
        email_confirm: true,
        user_metadata: {
          nome_completo: profileData.nome_completo,
          tipo_usuario: profileData.tipo_usuario
        }
      });
      
      if (authError) {
        throw new Error(`Erro ao criar usuário auth: ${authError.message}`);
      }
      
      console.log('Novo usuário criado na autenticação:', {
        id: newAuthUser.user.id,
        email: newAuthUser.user.email
      });
      
      // 6. Atualizar o ID do usuário na tabela usuarios
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from('usuarios')
        .update({ id: newAuthUser.user.id })
        .eq('id', profileData.id)
        .select()
        .single();
        
      if (updateError) {
        console.error('Erro ao atualizar perfil. Deletando usuário criado...');
        await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
        throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
      }
      
      console.log('Perfil atualizado com o novo ID do usuário.');
      
      // 7. Testar login
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: profileData.email,
        password: '@13152122'
      });
      
      if (signInError) {
        console.error('Erro no teste de login:', signInError);
        throw new Error(`Erro no teste de login: ${signInError.message}`);
      }
      
      console.log('Teste de login bem-sucedido!');
      console.log('- ID do usuário logado:', signInData.user.id);
    }
    
    console.log('\nInstruções para login:');
    console.log('- CNPJ: 30466125000172');
    console.log('- Senha: @13152122');
    console.log('\nProcesso de redefinição de senha finalizado com sucesso!');
    
  } catch (error) {
    console.error('Erro ao redefinir a senha do administrador:', error);
  }
}

// Executar a função
resetAdminPassword(); 