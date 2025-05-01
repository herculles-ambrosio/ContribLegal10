'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FaUsers, FaBuilding, FaClipboardList, FaChartBar, FaTrophy, FaSignOutAlt, FaBars, FaTimes, FaCog } from 'react-icons/fa';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import { logout } from '@/lib/auth';
import toast from 'react-hot-toast';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [adminName, setAdminName] = useState('Administrador');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const verificarAutenticacao = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error('Você precisa estar logado como administrador');
          router.push('/login');
          return;
        }
        
        // Verificar se o usuário é administrador
        const { data, error } = await supabase
          .from('usuarios')
          .select('master, nome_completo')
          .eq('id', session.user.id)
          .single();
          
        if (error || !data || data.master !== 'S') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }
        
        setAdminName(data.nome_completo || 'Administrador');
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        toast.error('Erro ao verificar autenticação');
        router.push('/login');
      }
    };
    
    verificarAutenticacao();
    
    // Adicionar listener para o tamanho da tela
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    // Executar uma vez no carregamento
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [router]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logout realizado com sucesso');
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  const menuItems = [
    {
      title: 'Usuários',
      icon: FaUsers,
      href: '/admin/usuarios',
      active: pathname?.includes('/admin/usuarios'),
    },
    {
      title: 'Empresas',
      icon: FaBuilding,
      href: '/admin/empresas',
      active: pathname?.includes('/admin/empresas'),
    },
    {
      title: 'Documentos',
      icon: FaClipboardList,
      href: '/admin/documentos',
      active: pathname?.includes('/admin/documentos'),
    },
    {
      title: 'Números da Sorte',
      icon: FaTrophy,
      href: '/admin/numeros-sorte',
      active: pathname?.includes('/admin/numeros-sorte'),
    },
    {
      title: 'Relatórios',
      icon: FaChartBar,
      href: '/admin/relatorios',
      active: pathname?.includes('/admin/relatorios'),
    },
    {
      title: 'Configurações',
      icon: FaCog,
      href: '/admin/configuracoes',
      active: pathname?.includes('/admin/configuracoes'),
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-md">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="mr-3 p-2 rounded-lg hover:bg-blue-800 transition-colors md:hidden"
            >
              {isSidebarOpen ? <FaTimes /> : <FaBars />}
            </button>
            <Link href="/admin" className="flex items-center">
              <Image
                src="/LOGO_CL_trans.png"
                alt="Contribuinte Legal"
                width={120}
                height={45}
                style={{ objectFit: 'contain' }}
                priority
              />
              <span className="ml-2 text-lg font-semibold hidden sm:inline">Admin</span>
            </Link>
          </div>
          
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-blue-800 transition-colors md:hidden"
          >
            {isMobileMenuOpen ? <FaTimes className="h-6 w-6" /> : <FaBars className="h-6 w-6" />}
          </button>
          
          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-sm">
              Olá, {adminName}
            </div>
            <Button
              variant="outlineLight"
              size="sm"
              onClick={handleLogout}
              icon={FaSignOutAlt}
            >
              Sair
            </Button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-blue-800 bg-blue-900">
            <div className="px-4 py-3 flex flex-col">
              <div className="py-2 text-sm">
                Olá, {adminName}
              </div>
              <Button
                variant="outlineLight"
                size="sm"
                onClick={handleLogout}
                icon={FaSignOutAlt}
                fullWidth
              >
                Sair
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="flex">
        {/* Sidebar */}
        {isSidebarOpen && (
          <aside className="w-64 bg-white shadow-lg fixed inset-y-0 left-0 z-20 transform transition-transform duration-300 md:translate-x-0 pt-16 md:relative md:pt-0">
            <div className="h-full overflow-y-auto">
              <nav className="px-4 py-4">
                <ul className="space-y-1">
                  {menuItems.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 ${
                          item.active ? 'bg-blue-100 font-medium' : ''
                        }`}
                      >
                        <item.icon className={`w-5 h-5 mr-3 ${item.active ? 'text-blue-600' : 'text-gray-500'}`} />
                        <span>{item.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className={`flex-1 p-6 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
} 