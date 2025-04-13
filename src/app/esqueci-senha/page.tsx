'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FaUser, FaExclamationTriangle } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function EsqueciSenha() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Por favor, informe seu email');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      
      if (error) {
        if (error.message.includes('User not found')) {
          throw new Error('Email não encontrado. Verifique se o email está correto.');
        } else {
          throw error;
        }
      }
      
      setSuccess(true);
      toast.success('Email de recuperação enviado com sucesso! Verifique sua caixa de entrada.');
      
    } catch (error: any) {
      console.error('Erro ao enviar email de recuperação:', error);
      setError(error.message || 'Ocorreu um erro ao enviar o email de recuperação');
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
            <h1 className="text-3xl font-bold text-center text-white">Recuperar Senha</h1>
          </div>
          
          {error && (
            <div className="bg-red-900/20 border-l-4 border-red-500 p-4 mb-6 text-white rounded">
              <div className="flex items-center">
                <FaExclamationTriangle className="mr-2 text-red-400" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {success ? (
            <div className="text-center space-y-6">
              <p className="text-white">
                Um email com instruções para redefinir sua senha foi enviado para {email}.
                Por favor, verifique sua caixa de entrada e siga as instruções.
              </p>
              <Button
                variant="primary"
                fullWidth
                className="py-3 text-base font-medium shadow-lg hover:shadow-blue-500/50 transition-all duration-300"
                animated
                onClick={() => router.push('/login')}
              >
                Voltar para o Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  Enviar Email de Recuperação
                </Button>
              </div>
            </form>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-blue-100">
              Lembrou sua senha? <Link href="/login" className="text-white font-semibold hover:underline">Voltar para o Login</Link>
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  );
} 