'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FaUser, FaLock, FaExclamationTriangle, FaKey } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { logout } from '@/lib/auth';
import Image from 'next/image';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Começa como true para mostrar carregamento
  const [error, setError] = useState('');
  
  // Uma única função useEffect para forçar o logout e garantir que não há sessão ativa
  useEffect(() => {
    async function limparSessaoForçada() {
      console.log("Iniciando limpeza forçada de sessão...");
      
      // Se estamos em um navegador, limpar storage
      if (typeof window !== 'undefined') {
        try {
          // Desconectar qualquer sessão do Supabase
          await supabase.auth.signOut();
          
          // Limpar localStorage e sessionStorage
          localStorage.clear();
          sessionStorage.clear();
          
          // Para ter certeza, remover itens específicos do Supabase
          localStorage.removeItem('supabase.auth.token');
          localStorage.removeItem('supabase.auth.user');
          sessionStorage.removeItem('supabase.auth.token');
          sessionStorage.removeItem('supabase.auth.user');
          
          console.log("Limpeza de sessão concluída com sucesso");
        } catch (err) {
          console.error("Erro ao limpar sessão:", err);
        }
      }
      
      // Independente do sucesso da limpeza, permitir interação após 800ms
      setTimeout(() => {
        setIsLoading(false);
        console.log("Página de login pronta para interação");
      }, 800);
    }
    
    // Executar a limpeza ao montar o componente
    limparSessaoForçada();
    
    // Impedir qualquer redirecionamento automático adicionando um bloqueio temporário
    const preventRedirect = (e: BeforeUnloadEvent) => {
      if (isLoading) {
        e.preventDefault();
        return (e.returnValue = '');
      }
    };
    
    // Adicionar evento para bloquear saídas enquanto carrega
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', preventRedirect);
    }
    
    // Limpar evento ao desmontar
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', preventRedirect);
      }
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Verificar se não há nenhuma sessão ativa antes de tentar login
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        // Se houver uma sessão ativa, forçar logout novamente
        await supabase.auth.signOut();
        console.log('Sessão existente removida antes do login');
      }
      
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
        <Card className="max-w-md w-full p-6 shadow-xl" variant="blue-gradient">
          <div className="flex flex-col items-center mb-8">
            <Image 
              src="/LOGO_CL_trans.png" 
              alt="Contribuinte Legal" 
              width={180} 
              height={70} 
              className="mb-6" 
              priority
              style={{ objectFit: 'contain' }}
            />
            <h1 className="text-3xl font-bold text-center text-white">Login</h1>
          </div>
          
          {error && (
            <div className="bg-red-900/20 border-l-4 border-red-500 p-4 mb-6 text-white rounded">
              <div className="flex items-center">
                <FaExclamationTriangle className="mr-2 text-red-400" />
                <p>{error}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-6">
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
                  variant="dark"
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
                  variant="dark"
                />
              </div>
              
              <div className="text-right">
                <Link href="/esqueci-senha" className="text-sm text-blue-200 hover:text-white transition-colors">
                  Esqueceu sua senha?
                </Link>
              </div>
            </div>
            
            <div className="pt-2">
              <Button 
                type="submit" 
                variant="primary" 
                fullWidth
                isLoading={isLoading}
                className="py-3 text-base font-medium shadow-lg hover:shadow-blue-500/50 transition-all duration-300"
                animated
              >
                Entrar
              </Button>
            </div>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-blue-100">
              Não tem uma conta? <Link href="/registro" className="text-white font-semibold hover:underline">Cadastre-se</Link>
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  );
} 