import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const userData = await request.json();
    
    // Garantir que novos usuários tenham tipo_usuario "Usuário" e role "contribuinte" por padrão
    if (!userData.tipo_usuario) {
      userData.tipo_usuario = 'Usuário';
    }
    
    if (!userData.role) {
      userData.role = 'contribuinte';
    }

    // Garantir que novos usuários tenham master = 'N' por padrão
    userData.master = 'N';

    // Criar registro do usuário na tabela personalizada usando service role
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('usuarios')
      .insert([userData])
      .select()
      .single();

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError);
      return NextResponse.json(
        { error: `Erro ao criar perfil: ${profileError.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: profileData });
  } catch (error: any) {
    console.error('Erro no registro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 