import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { email, cpf_cnpj } = await request.json();
    
    if (!email && !cpf_cnpj) {
      return NextResponse.json(
        { error: 'Email ou CPF/CNPJ é necessário para verificação' },
        { status: 400 }
      );
    }

    // Verifica se email existe
    let emailExists = false;
    if (email) {
      const { data: emailData, error: emailError } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      
      if (emailError) {
        console.error('Erro ao verificar email:', emailError);
        return NextResponse.json(
          { error: `Erro ao verificar email: ${emailError.message}` },
          { status: 500 }
        );
      }
      
      emailExists = !!emailData;
    }
    
    // Verifica se CPF/CNPJ existe
    let cpfCnpjExists = false;
    if (cpf_cnpj) {
      const { data: cpfCnpjData, error: cpfCnpjError } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('cpf_cnpj', cpf_cnpj)
        .maybeSingle();
      
      if (cpfCnpjError) {
        console.error('Erro ao verificar CPF/CNPJ:', cpfCnpjError);
        return NextResponse.json(
          { error: `Erro ao verificar CPF/CNPJ: ${cpfCnpjError.message}` },
          { status: 500 }
        );
      }
      
      cpfCnpjExists = !!cpfCnpjData;
    }
    
    return NextResponse.json({
      emailExists,
      cpfCnpjExists
    });
  } catch (error: any) {
    console.error('Erro na verificação de usuário existente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 