'use client';

import { ReactNode, useCallback, useState } from 'react';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import toast from 'react-hot-toast';

type IdleTimerProviderProps = {
  children: ReactNode;
  timeout?: number; // Tempo em milissegundos
};

export default function IdleTimerProvider({
  children,
  timeout = 3 * 60 * 1000, // 3 minutos em milissegundos por padrão
}: IdleTimerProviderProps) {
  const router = useRouter();
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  
  const handleIdle = useCallback(async () => {
    try {
      await logout();
      toast.success('Sessão encerrada por inatividade');
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout por inatividade:', error);
    }
  }, [router]);

  useIdleTimer({
    timeout,
    onIdle: handleIdle,
  });

  return (
    <>
      {children}
    </>
  );
} 