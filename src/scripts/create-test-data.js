// Script para criar dados de teste
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

async function createTestData() {
  try {
    console.log('Iniciando criação de dados de teste...');
    
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
    
    // Verificar se a tabela documentos existe
    const { error: tableError } = await supabaseAdmin
      .from('documentos')
      .select('count', { count: 'exact', head: true });
    
    if (tableError) {
      console.log('Criando tabela documentos...');
      
      // Criar tabela documentos se não existir
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.documentos (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          usuario_id UUID NOT NULL REFERENCES auth.users(id),
          tipo TEXT NOT NULL,
          numero_documento TEXT NOT NULL,
          data_emissao DATE NOT NULL,
          valor DECIMAL(15,2) NOT NULL,
          arquivo_url TEXT NOT NULL,
          numero_sorteio TEXT,
          status TEXT DEFAULT 'AGUARDANDO VALIDAÇÃO',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
        );
      `;
      
      await supabaseAdmin.rpc('exec_sql', { sql_query: createTableSQL }).catch(e => {
        console.error('Erro ao criar tabela via RPC:', e);
        console.log('Pulando criação de tabela. Tentando inserir dados mesmo assim...');
      });
    }
    
    // Buscar o usuário administrador
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('cpf_cnpj', '30466125000172')
      .single();
    
    if (adminError) {
      console.error('Erro ao buscar usuário administrador:', adminError);
      throw new Error('Usuário administrador não encontrado');
    }
    
    console.log('Usuário administrador encontrado:', adminUser.id);
    
    // Verificar se já existem documentos para não duplicar
    const { data: existingDocs, error: existingError } = await supabaseAdmin
      .from('documentos')
      .select('numero_documento');
      
    const existingDocNumbers = existingDocs?.map(doc => doc.numero_documento) || [];
    console.log('Documentos existentes:', existingDocNumbers);
    
    // Criar documentos adicionais para o administrador
    const documentosAdmin = [];
    
    // Adicionar documentos do tipo nota_servico
    for (let i = 1; i <= 5; i++) {
      const docNumber = `NS-${100+i}`;
      if (!existingDocNumbers.includes(docNumber)) {
        documentosAdmin.push({
          id: uuidv4(),
          usuario_id: adminUser.id,
          tipo: 'nota_servico',
          numero_documento: docNumber,
          data_emissao: new Date().toISOString().split('T')[0],
          valor: 1000 + (i * 500),
          arquivo_url: `documentos/admin/nota_servico_${i}.pdf`,
          numero_sorteio: `SORTEIO-${Math.floor(Math.random() * 100000)}`,
          status: i % 3 === 0 ? 'VALIDADO' : i % 3 === 1 ? 'INVÁLIDO' : 'AGUARDANDO VALIDAÇÃO'
        });
      }
    }
    
    // Adicionar documentos do tipo nota_venda
    for (let i = 1; i <= 7; i++) {
      const docNumber = `NV-${200+i}`;
      if (!existingDocNumbers.includes(docNumber)) {
        documentosAdmin.push({
          id: uuidv4(),
          usuario_id: adminUser.id,
          tipo: 'nota_venda',
          numero_documento: docNumber,
          data_emissao: new Date().toISOString().split('T')[0],
          valor: 2000 + (i * 750),
          arquivo_url: `documentos/admin/nota_venda_${i}.pdf`,
          numero_sorteio: `SORTEIO-${Math.floor(Math.random() * 100000)}`,
          status: i % 3 === 0 ? 'VALIDADO' : i % 3 === 1 ? 'INVÁLIDO' : 'AGUARDANDO VALIDAÇÃO'
        });
      }
    }
    
    // Adicionar documentos do tipo imposto
    for (let i = 1; i <= 4; i++) {
      const docNumber = `IM-${300+i}`;
      if (!existingDocNumbers.includes(docNumber)) {
        documentosAdmin.push({
          id: uuidv4(),
          usuario_id: adminUser.id,
          tipo: 'imposto',
          numero_documento: docNumber,
          data_emissao: new Date().toISOString().split('T')[0],
          valor: 500 + (i * 250),
          arquivo_url: `documentos/admin/imposto_${i}.pdf`,
          numero_sorteio: `SORTEIO-${Math.floor(Math.random() * 100000)}`,
          status: i % 3 === 0 ? 'VALIDADO' : i % 3 === 1 ? 'INVÁLIDO' : 'AGUARDANDO VALIDAÇÃO'
        });
      }
    }
    
    console.log(`Preparando inserção de ${documentosAdmin.length} novos documentos`);
    
    // Inserir documentos em lotes de 5 para evitar problemas
    const batchSize = 5;
    for (let i = 0; i < documentosAdmin.length; i += batchSize) {
      const batch = documentosAdmin.slice(i, i + batchSize);
      console.log(`Inserindo lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(documentosAdmin.length/batchSize)}`);
      
      const { data: docsInserted, error: docsError } = await supabaseAdmin
        .from('documentos')
        .insert(batch)
        .select();
      
      if (docsError) {
        console.error(`Erro ao inserir lote ${Math.floor(i/batchSize) + 1}:`, docsError);
      } else {
        console.log(`Lote ${Math.floor(i/batchSize) + 1}: ${docsInserted.length} documentos inseridos`);
      }
    }
    
    // Verificar quantos documentos existem agora
    const { data: countData, error: countError } = await supabaseAdmin
      .from('documentos')
      .select('*');
    
    if (countError) {
      console.error('Erro ao contar documentos:', countError);
    } else {
      console.log(`Total de documentos na tabela: ${countData.length}`);
      
      // Calcular estatísticas
      const tipoCount = {
        nota_servico: countData.filter(d => d.tipo === 'nota_servico').length,
        nota_venda: countData.filter(d => d.tipo === 'nota_venda').length,
        imposto: countData.filter(d => d.tipo === 'imposto').length
      };
      
      const valorTotal = countData.reduce((sum, doc) => {
        let valor = 0;
        if (typeof doc.valor === 'string') {
          valor = parseFloat(doc.valor.replace(',', '.')) || 0;
        } else if (typeof doc.valor === 'number') {
          valor = doc.valor;
        }
        return sum + valor;
      }, 0);
      
      console.log('Estatísticas dos documentos:');
      console.log('- Tipo nota_servico:', tipoCount.nota_servico);
      console.log('- Tipo nota_venda:', tipoCount.nota_venda);
      console.log('- Tipo imposto:', tipoCount.imposto);
      console.log('- Valor total: R$', valorTotal.toFixed(2));
    }
    
    console.log('Processo concluído com sucesso!');
  } catch (error) {
    console.error('Erro ao criar dados de teste:', error);
  }
}

// Executar a função
createTestData(); 