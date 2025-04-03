'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUsuarioLogado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const redirecionarUsuario = async () => {
      try {
        // Primeiro verificar se há sessão válida
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('Sessão não encontrada, redirecionando para login');
          toast.error('Você precisa estar logado para acessar esta página');
          router.push('/login');
          return;
        }
        
        console.log('Sessão encontrada, verificando usuário');
        
        // Buscar dados diretamente da tabela usuarios
        const { data: usuario, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (error) {
          console.error('Erro ao buscar dados do usuário:', error);
          
          // Tentar fallback para getUsuarioLogado
          const usuarioFallback = await getUsuarioLogado();
          if (!usuarioFallback) {
            console.log('Não foi possível obter dados do usuário, redirecionando para login');
            toast.error('Erro ao verificar suas informações. Por favor, faça login novamente.');
            router.push('/login');
            return;
          }
          
          // Verificar a role do usuário do fallback
          console.log('Dados do usuário via fallback:', {
            master: usuarioFallback.master,
            tipo: usuarioFallback.tipo_usuario
          });
          
          if (usuarioFallback.master === 'S') {
            console.log('Usuário administrador detectado (fallback), redirecionando para o painel administrativo');
            router.push('/admin');
            return;
          }
          
          // Para usuários não-admin, redirecionar para o painel do contribuinte
          console.log('Redirecionando para painel do contribuinte (fallback)');
          router.push('/contribuinte');
          return;
        }
        
        // Usuário encontrado, verificar master
        console.log('Dados do usuário encontrados:', {
          master: usuario.master,
          nome: usuario.nome_completo
        });
        
        // Verificar se o usuário é administrador
        if (usuario.master === 'S') {
          console.log('Usuário administrador detectado, redirecionando para o painel administrativo');
          router.push('/admin');
          return;
        }

        // Para usuários não-admin, redirecionar para o painel do contribuinte
        console.log('Redirecionando para painel do contribuinte');
        router.push('/contribuinte');
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        toast.error('Erro ao verificar suas informações');
        router.push('/');
      } finally {
        setIsChecking(false);
      }
    };

    redirecionarUsuario();
  }, [router]);

  // Exibe um indicador de carregamento enquanto verifica
  return (
    <div className="min-h-screen flex items-center justify-center">
      {isChecking && (
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando seu painel...</p>
        </div>
      )}
    </div>
  );
} 