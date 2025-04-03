'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        await logout();
        toast.success('Você foi desconectado com sucesso');
      } catch (error) {
        console.error('Erro ao desconectar:', error);
        toast.error('Erro ao desconectar');
      } finally {
        router.push('/');
      }
    };
    
    handleLogout();
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
} 