// Script para testar a autenticação após correção do RLS
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testAuthentication() {
  try {
    console.log('Iniciando teste de autenticação após correção de RLS...');
    
    // Configuração do cliente Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Configuração incompleta! Certifique-se de definir NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Teste 1: Login com usuário de teste
    console.log('\n🔍 TESTE 1: Login com usuário de teste');
    const email = 'teste@example.com';
    const password = 'senha123';
    
    console.log(`Tentando login com ${email}...`);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (signInError) {
      console.error('❌ Erro no login:', signInError.message);
    } else {
      console.log('✅ Login bem-sucedido!');
      console.log('  ID do usuário:', signInData.user.id);
      
      // Teste 2: Buscar dados do usuário logado
      console.log('\n🔍 TESTE 2: Buscar dados do usuário');
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', signInData.user.id)
        .single();
      
      if (userError) {
        console.error('❌ Erro ao buscar dados do usuário:', userError.message);
      } else {
        console.log('✅ Dados do usuário obtidos com sucesso!');
        console.log('  Nome:', userData.nome_completo);
        console.log('  Master:', userData.master || 'N');
        
        // Teste 3: Atualizar um campo do perfil
        console.log('\n🔍 TESTE 3: Atualizar campo do perfil do usuário');
        const novoTelefone = `${Math.floor(Math.random() * 10000000000)}`;
        const { error: updateError } = await supabase
          .from('usuarios')
          .update({ telefone: novoTelefone })
          .eq('id', signInData.user.id);
        
        if (updateError) {
          console.error('❌ Erro ao atualizar perfil:', updateError.message);
        } else {
          console.log('✅ Perfil atualizado com sucesso!');
          console.log('  Novo telefone:', novoTelefone);
        }
      }
    }
    
    // Teste 4: Criar um novo usuário
    console.log('\n🔍 TESTE 4: Criar novo usuário de teste');
    const newEmail = `teste${Math.floor(Math.random() * 10000)}@example.com`;
    const newPassword = 'senha123';
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: {
        data: {
          nome_completo: 'Usuário de Teste',
        }
      }
    });
    
    if (signUpError) {
      console.error('❌ Erro ao criar usuário:', signUpError.message);
    } else {
      console.log('✅ Usuário criado com sucesso!');
      console.log('  Email:', newEmail);
      console.log('  ID:', signUpData.user.id);
      
      // Inserir na tabela usuarios
      const { error: insertError } = await supabase
        .from('usuarios')
        .insert([
          {
            id: signUpData.user.id,
            email: newEmail,
            nome_completo: 'Usuário de Teste',
            cpf_cnpj: Math.floor(Math.random() * 10000000000).toString(),
          }
        ]);
      
      if (insertError) {
        console.error('❌ Erro ao inserir registro na tabela usuarios:', insertError.message);
      } else {
        console.log('✅ Registro inserido na tabela usuarios com sucesso!');
      }
    }
    
    console.log('\n✨ Testes de autenticação concluídos!');
    
  } catch (error) {
    console.error('Erro inesperado durante os testes:', error);
  }
}

testAuthentication(); 