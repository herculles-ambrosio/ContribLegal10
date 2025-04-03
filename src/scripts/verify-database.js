// Script para verificar o estado do banco de dados e confirmar que as políticas RLS estão corretas
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function verifyDatabase() {
  try {
    console.log('🔍 Iniciando verificação do banco de dados e políticas RLS...');
    console.log('======================================================================');
    
    // Configuração do cliente Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Configuração incompleta! Verifique as variáveis de ambiente.');
      return;
    }
    
    // Cliente normal para testar como usuário comum
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Cliente com role de serviço para contornar RLS e verificar configurações
    const supabaseAdmin = supabaseServiceKey 
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;
    
    if (!supabaseAdmin) {
      console.warn('⚠️ SERVICE_ROLE_KEY não disponível. A verificação será limitada.');
    }
    
    // Verificar formato das tabelas principais
    console.log('📋 Verificando estrutura da tabela usuarios...');
    const { data: usuariosInfo, error: usuariosInfoError } = await supabaseAdmin?.rpc('executar_query_admin', {
      query_sql: `
        SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'usuarios'
        ORDER BY ordinal_position
      `
    }) || { data: null, error: { message: 'SERVICE_ROLE_KEY não disponível' } };
    
    if (usuariosInfoError) {
      console.error('❌ Erro ao verificar estrutura da tabela usuarios:', usuariosInfoError.message);
    } else if (usuariosInfo) {
      console.log('✅ Estrutura da tabela usuarios:');
      console.table(usuariosInfo);
      
      // Verificar se existe coluna master
      const masterColuna = usuariosInfo.find(col => col.column_name === 'master');
      if (masterColuna) {
        console.log('✅ Coluna "master" existe na tabela usuarios.');
      } else {
        console.error('❌ Coluna "master" NÃO existe na tabela usuarios!');
      }
    }
    
    // Verificar políticas RLS nas tabelas principais
    console.log('\n📋 Verificando políticas RLS...');
    const { data: rlsPolicies, error: rlsPoliciesError } = await supabaseAdmin?.rpc('executar_query_admin', {
      query_sql: `
        SELECT 
          schemaname, 
          tablename, 
          policyname, 
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM 
          pg_policies
        WHERE 
          schemaname = 'public' AND 
          (tablename = 'usuarios' OR tablename = 'documentos')
        ORDER BY
          tablename, cmd
      `
    }) || { data: null, error: { message: 'SERVICE_ROLE_KEY não disponível' } };
    
    if (rlsPoliciesError) {
      console.error('❌ Erro ao verificar políticas RLS:', rlsPoliciesError.message);
    } else if (rlsPolicies) {
      console.log('✅ Políticas RLS configuradas:');
      console.table(rlsPolicies);
      
      // Verificar se existem políticas para todas as operações necessárias
      const usuariosOperations = new Set(rlsPolicies
        .filter(p => p.tablename === 'usuarios')
        .map(p => p.cmd));
        
      const documentosOperations = new Set(rlsPolicies
        .filter(p => p.tablename === 'documentos')
        .map(p => p.cmd));
      
      console.log('\n📊 Resumo de operações cobertas por políticas RLS:');
      console.log('📋 Tabela usuarios:');
      console.log('  - SELECT:', usuariosOperations.has('SELECT') ? '✅' : '❌');
      console.log('  - INSERT:', usuariosOperations.has('INSERT') ? '✅' : '❌');
      console.log('  - UPDATE:', usuariosOperations.has('UPDATE') ? '✅' : '❌');
      console.log('  - DELETE:', usuariosOperations.has('DELETE') ? '✅' : '❌');
      
      console.log('📋 Tabela documentos:');
      console.log('  - SELECT:', documentosOperations.has('SELECT') ? '✅' : '❌');
      console.log('  - INSERT:', documentosOperations.has('INSERT') ? '✅' : '❌');
      console.log('  - UPDATE:', documentosOperations.has('UPDATE') ? '✅' : '❌');
      console.log('  - DELETE:', documentosOperations.has('DELETE') ? '✅' : '❌');
    }
    
    // Verificar status de RLS nas tabelas
    console.log('\n📋 Verificando status de RLS...');
    const { data: rlsStatus, error: rlsStatusError } = await supabaseAdmin?.rpc('executar_query_admin', {
      query_sql: `
        SELECT 
          table_schema,
          table_name,
          row_level_security
        FROM 
          information_schema.tables 
        WHERE 
          table_schema = 'public' AND
          (table_name = 'usuarios' OR table_name = 'documentos')
      `
    }) || { data: null, error: { message: 'SERVICE_ROLE_KEY não disponível' } };
    
    if (rlsStatusError) {
      console.error('❌ Erro ao verificar status de RLS:', rlsStatusError.message);
    } else if (rlsStatus) {
      console.log('✅ Status de RLS nas tabelas:');
      console.table(rlsStatus);
    }
    
    // Verificar funções admin
    console.log('\n📋 Verificando funções administrativas...');
    const { data: adminFunctions, error: adminFunctionsError } = await supabaseAdmin?.rpc('executar_query_admin', {
      query_sql: `
        SELECT 
          routine_name,
          data_type AS return_type,
          security_type
        FROM 
          information_schema.routines
        WHERE 
          routine_schema = 'public' AND
          routine_name LIKE 'admin%'
      `
    }) || { data: null, error: { message: 'SERVICE_ROLE_KEY não disponível' } };
    
    if (adminFunctionsError) {
      console.error('❌ Erro ao verificar funções administrativas:', adminFunctionsError.message);
    } else if (adminFunctions) {
      console.log('✅ Funções administrativas:');
      console.table(adminFunctions);
      
      // Verificar se as funções usam SECURITY DEFINER
      const securityDefinerCount = adminFunctions.filter(f => f.security_type === 'DEFINER').length;
      if (securityDefinerCount === adminFunctions.length) {
        console.log('✅ Todas as funções admin usam SECURITY DEFINER corretamente.');
      } else {
        console.warn(`⚠️ Apenas ${securityDefinerCount} de ${adminFunctions.length} funções admin usam SECURITY DEFINER!`);
      }
    }
    
    // Verificar usuário admin
    console.log('\n📋 Verificando usuário administrador...');
    const { data: adminUsers, error: adminUsersError } = await supabaseAdmin?.rpc('executar_query_admin', {
      query_sql: `
        SELECT id, email, nome_completo, master, created_at
        FROM usuarios
        WHERE master = 'S'
      `
    }) || { data: null, error: { message: 'SERVICE_ROLE_KEY não disponível' } };
    
    if (adminUsersError) {
      console.error('❌ Erro ao verificar usuários administradores:', adminUsersError.message);
    } else if (adminUsers) {
      if (adminUsers.length === 0) {
        console.error('❌ NENHUM usuário administrador encontrado!');
      } else {
        console.log(`✅ ${adminUsers.length} usuário(s) administrador(es) encontrado(s):`);
        console.table(adminUsers);
      }
    }
    
    console.log('\n✨ Verificação do banco de dados concluída!');
    console.log('======================================================================');
    
    // Sugestões baseadas em análise
    console.log('\n📝 RECOMENDAÇÕES:');
    if (!supabaseAdmin) {
      console.log('▶ Configure a variável NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local para diagnósticos completos.');
    }
    
    if (!adminUsers || adminUsers.length === 0) {
      console.log('▶ Execute o script fix-rls-complete.sql para criar/configurar o usuário administrador.');
    }
    
    if (usuariosInfo && !usuariosInfo.find(col => col.column_name === 'master')) {
      console.log('▶ A coluna "master" está ausente na tabela "usuarios" - execute o script fix-rls-complete.sql.');
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado durante a verificação:', error);
  }
}

verifyDatabase(); 