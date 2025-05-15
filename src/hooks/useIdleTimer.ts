import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import toast from 'react-hot-toast';

type UseIdleTimerProps = {
  timeout?: number; // Tempo em milissegundos
  onIdle?: () => void;
};

export const useIdleTimer = ({
  timeout = 3 * 60 * 1000, // 3 minutos em milissegundos por padrão
  onIdle,
}: UseIdleTimerProps = {}) => {
  const [isIdle, setIsIdle] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let idleTimer: NodeJS.Timeout | null = null;

    // Lista de eventos para resetar o timer
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown',
    ];

    // Função para resetar o timer
    const resetTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      
      if (isIdle) setIsIdle(false);
      
      idleTimer = setTimeout(() => {
        setIsIdle(true);
        
        if (onIdle) {
          onIdle();
        } else {
          // Comportamento padrão: fazer logout e redirecionar
          handleLogout();
        }
      }, timeout);
    };

    // Função de logout
    const handleLogout = async () => {
      try {
        await logout();
        toast.success('Sessão encerrada por inatividade');
        router.push('/login');
      } catch (error) {
        console.error('Erro ao fazer logout por inatividade:', error);
      }
    };

    // Registrar eventos
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Iniciar o timer
    resetTimer();

    // Limpar eventos e timer ao desmontar
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [timeout, onIdle, isIdle, router]);

  return { isIdle };
}; 