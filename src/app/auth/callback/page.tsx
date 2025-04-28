'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Verificar se há um hash na URL
        const hash = window.location.hash;
        if (!hash) {
          router.push('/login');
          return;
        }

        // Extrair o tipo do token
        const params = new URLSearchParams(hash.substring(1));
        const type = params.get('type');

        if (type === 'recovery') {
          // Se for recuperação de senha, redirecionar para a página de redefinição
          router.push('/redefinir-senha');
        } else {
          // Para outros casos, redirecionar para o login
          router.push('/login');
        }
      } catch (error) {
        console.error('Erro no callback de autenticação:', error);
        router.push('/login');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processando autenticação...</p>
      </div>
    </div>
  );
} 