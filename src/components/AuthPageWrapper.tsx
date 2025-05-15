'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import IdleTimerProvider from './IdleTimerProvider';

// Rotas públicas que não devem ter o timer de inatividade
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/registro',
  '/esqueci-senha',
  '/redefinir-senha',
  '/auth/callback'
];

type AuthPageWrapperProps = {
  children: ReactNode;
};

export default function AuthPageWrapper({ children }: AuthPageWrapperProps) {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  
  // Prevenindo execução durante SSR
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    return <>{children}</>;
  }
  
  // Verificar se estamos em uma rota autenticada
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  
  if (isPublicRoute) {
    return <>{children}</>;
  }
  
  // Se estamos em uma rota autenticada, envolvemos com o provedor de inatividade
  return (
    <IdleTimerProvider>
      {children}
    </IdleTimerProvider>
  );
} 