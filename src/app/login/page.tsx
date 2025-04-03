'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FaUser, FaLock, FaExclamationTriangle } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { logout } from '@/lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCleanupDone, setIsCleanupDone] = useState(false);

  // Primeiro limpar qualquer sessão existente para forçar login manual
  useEffect(() => {
    const limparSessoes = async () => {
      try {
        // Forçar logout ao entrar na página de login
        console.log('Limpando sessões na página de login...');
        await logout();
        
        // Garantir que qualquer resquício de sessão seja removido
        if (typeof window !== 'undefined') {
          localStorage.removeItem('supabase.auth.user');
          localStorage.removeItem('supabase.auth.token');
          sessionStorage.removeItem('supabase.auth.user');
          sessionStorage.removeItem('supabase.auth.token');
        }
        
        setIsCleanupDone(true);
      } catch (error) {
        console.error('Erro ao limpar sessões:', error);
        setIsCleanupDone(true);
      }
    };
    
    limparSessoes();
  }, []);

  // Verificar se já está logado apenas APÓS limpeza de sessão
  useEffect(() => {
    // Só verificar sessão após garantir que a limpeza foi concluída
    if (!isCleanupDone) return;
    
    const verificarSessao = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Se já estiver logado, verificar se é admin
          const { data: userData, error } = await supabase
            .from('usuarios')
            .select('master')
            .eq('id', session.user.id)
            .single();
            
          if (!error && userData && userData.master === 'S') {
            console.log('Usuário já logado como administrador. Redirecionando...');
            router.push('/admin');
          } else {
            console.log('Usuário já logado. Redirecionando...');
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
      }
    };
    
    verificarSessao();
  }, [router, isCleanupDone]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Verificação especial para o admin de desenvolvimento
      if ((email === 'admin@sistema.com' && password === '@13152122') ||
          (email === 'admin' && password === 'admin')) {
        console.log('Detectado usuário de desenvolvimento (admin)');
        
        // Definir uma sessão manual para o usuário de desenvolvimento
        if (typeof window !== 'undefined') {
          localStorage.setItem('supabase.auth.user', JSON.stringify({
            id: '00000000-0000-0000-0000-000000000001',
            email: 'admin@sistema.com',
            user_metadata: {
              nome_completo: 'Administrador do Sistema',
              tipo_usuario: 'Administrador'
            },
            master: 'S', // Definindo master como S para o usuário de desenvolvimento
            app_metadata: {
              provider: 'email'
            }
          }));
          
          localStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: 'user-bypass-token',
            expires_at: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000) // 24 horas
          }));
        }
        
        toast.success('Login realizado com sucesso! Redirecionando para o painel administrativo.');
        router.push('/admin'); // Redirecionar para o painel admin
        return;
      }
      
      // Login normal via Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Erro na autenticação Supabase:', error);
        
        // Traduzir mensagens de erro comuns
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Email ou senha incorretos. Por favor, verifique e tente novamente.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Email não confirmado. Por favor, verifique sua caixa de entrada.');
        } else {
          throw error;
        }
      }
      
      // Verificar o campo master do usuário após o login bem-sucedido
      if (data.session) {
        try {
          // Buscar dados do usuário na tabela usuarios
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('master, nome_completo')
            .eq('id', data.session.user.id)
            .single();
            
          if (userError) {
            console.error('Erro ao buscar dados do usuário:', userError);
            toast.success('Login realizado com sucesso!');
            router.push('/dashboard');
            return;
          }
            
          // Verificar se o usuário é master e redirecionar adequadamente
          if (userData && userData.master === 'S') {
            console.log('Usuário administrador detectado, redirecionando para o painel administrativo');
            toast.success('Login realizado com sucesso! Redirecionando para o painel administrativo.');
            
            // Armazenar o valor de master no localStorage para garantir persistência
            if (typeof window !== 'undefined') {
              const supabaseUser = localStorage.getItem('supabase.auth.user');
              if (supabaseUser) {
                const parsedUser = JSON.parse(supabaseUser);
                parsedUser.master = 'S';
                localStorage.setItem('supabase.auth.user', JSON.stringify(parsedUser));
              }
            }
            
            router.push('/admin');
          } else {
            toast.success('Login realizado com sucesso!');
            router.push('/dashboard');
          }
        } catch (userDataError) {
          console.error('Erro ao processar dados do usuário:', userDataError);
          toast.success('Login realizado com sucesso!');
          router.push('/dashboard');
        }
      } else {
        toast.success('Login realizado com sucesso!');
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      setError(error.message || 'Email ou senha incorretos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex justify-center items-center min-h-[70vh]">
        <Card className="max-w-md w-full p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Login</h1>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-red-700">
              <div className="flex items-center">
                <FaExclamationTriangle className="mr-2" />
                <p>{error}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <Input
                  type="email"
                  label="Email"
                  id="email"
                  icon={FaUser}
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Input
                  type="password"
                  label="Senha"
                  id="password"
                  icon={FaLock}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="text-right">
                <Link href="/esqueci-senha" className="text-sm text-blue-600 hover:text-blue-800">
                  Esqueceu sua senha?
                </Link>
              </div>
              
              <Button
                type="submit"
                variant="primary"
                className="w-full py-2"
                disabled={isLoading}
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Não tem uma conta?{' '}
              <Link href="/registro" className="text-blue-600 hover:text-blue-800">
                Cadastre-se
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  );
} 