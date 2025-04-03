import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from './ui/Button';
import { FaUser, FaBars, FaTimes, FaSignOutAlt } from 'react-icons/fa';
import { usePathname } from 'next/navigation';
import { getUsuarioLogado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Image from 'next/image';

type HeaderProps = {
  isAuthenticated?: boolean;
};

export default function Header({ isAuthenticated = false }: HeaderProps) {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState<string | null>(null);
  const [userMaster, setUserMaster] = useState('N');
  const pathname = usePathname();
  const router = useRouter();

  // Função para determinar o tipo de usuário com base no master
  const getTipoUsuario = (master: string) => {
    return master === 'S' ? 'Administrador' : 'Contribuinte';
  };

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        // Obter o usuário do Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) return;
        
        console.log('ID do usuário logado:', session.user.id);
        
        // Buscar dados completos do usuário na tabela 'usuarios'
        const { data: usuario, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (error) {
          console.error('Erro ao buscar dados do usuário:', error);
          
          // Fallback: usar getUsuarioLogado se a consulta direta falhar
          const usuarioFallback = await getUsuarioLogado();
          if (usuarioFallback) {
            setNomeUsuario(usuarioFallback.nome_completo || 'Usuário');
            const tipo = getTipoUsuario(usuarioFallback.master || 'N');
            setTipoUsuario(tipo);
            setUserMaster(usuarioFallback.master || 'N');
            
            console.log('Dados do usuário (fallback):', { 
              nome: usuarioFallback.nome_completo,
              master: usuarioFallback.master,
              tipo: tipo
            });
          }
          return;
        }
        
        if (usuario) {
          // Definir nome do usuário
          setNomeUsuario(usuario.nome_completo || 'Usuário');
          
          // Definir tipo de usuário baseado no master
          const tipo = getTipoUsuario(usuario.master || 'N');
          setTipoUsuario(tipo);
          
          // Definir master do usuário
          setUserMaster(usuario.master || 'N');
          
          console.log('Dados finais do usuário:', { 
            nome: usuario.nome_completo,
            master: usuario.master,
            tipo: tipo
          });
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        
        // Fallback: usar getUsuarioLogado se ocorrer qualquer erro
        try {
          const usuarioFallback = await getUsuarioLogado();
          if (usuarioFallback) {
            setNomeUsuario(usuarioFallback.nome_completo || 'Usuário');
            const tipo = getTipoUsuario(usuarioFallback.master || 'N');
            setTipoUsuario(tipo);
            setUserMaster(usuarioFallback.master || 'N');
          }
        } catch (fallbackError) {
          console.error('Erro ao usar fallback para dados do usuário:', fallbackError);
        }
      }
    };

    if (isAuthenticated) {
      carregarUsuario();
    }
  }, [isAuthenticated]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Limpar estados do usuário
      setNomeUsuario('');
      setUserMaster('N');
      setTipoUsuario(null);
      
      toast.success('Logout realizado com sucesso!');
      router.push('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao realizar logout');
    }
  };

  return (
    <header className="bg-white shadow-sm py-4">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image 
              src="/LOGO CL.jpeg" 
              alt="Contribuinte Legal" 
              width={280} 
              height={280} 
              className="rounded-md shadow-md" 
              style={{ objectFit: 'contain' }}
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {!isAuthenticated && (
              <>
                <Link href="/" className={`text-gray-700 hover:text-blue-600 ${pathname === '/' ? 'font-medium text-blue-600' : ''}`}>
                  Início
                </Link>
                <Link href="/como-funciona" className={`text-gray-700 hover:text-blue-600 ${pathname === '/como-funciona' ? 'font-medium text-blue-600' : ''}`}>
                  Como Funciona
                </Link>
                <Link href="/sorteios" className={`text-gray-700 hover:text-blue-600 ${pathname === '/sorteios' ? 'font-medium text-blue-600' : ''}`}>
                  Sorteios
                </Link>
                <Link href="/faq" className={`text-gray-700 hover:text-blue-600 ${pathname === '/faq' ? 'font-medium text-blue-600' : ''}`}>
                  FAQ
                </Link>
              </>
            )}
            
            {isAuthenticated && (
              <Link href="/" className={`text-gray-700 hover:text-blue-600 ${pathname === '/' ? 'font-medium text-blue-600' : ''}`}>
                Início
              </Link>
            )}

            {isAuthenticated ? (
              <div className="relative flex items-center space-x-4">
                <Link href="/dashboard" className="text-gray-700 hover:text-blue-600">
                  Meu Painel
                </Link>
                
                {userMaster !== 'S' && (
                  <Link href="/meus-documentos" className={`text-gray-700 hover:text-blue-600 ${pathname.includes('/meus-documentos') ? 'font-medium text-blue-600' : ''}`}>
                    Meus Documentos
                  </Link>
                )}
                
                {/* User Menu */}
                <div className="flex items-center space-x-2 text-sm border-l pl-4 border-gray-200">
                  <FaUser className="text-gray-500" />
                  <span className="text-gray-700">
                    <span className="font-semibold">{tipoUsuario || 'Contribuinte'}:</span> {nomeUsuario}
                  </span>
                  <button 
                    onClick={handleSignOut}
                    className="text-gray-500 hover:text-red-500 inline-flex items-center"
                  >
                    <FaSignOutAlt className="ml-1" />
                    <span className="ml-1">Sair</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="secondary">Login</Button>
                </Link>
                <Link href="/registro">
                  <Button variant="primary">Cadastrar</Button>
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-700 focus:outline-none"
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <FaTimes className="h-6 w-6" />
            ) : (
              <FaBars className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-gray-100">
            <nav className="flex flex-col space-y-4">
              <Link href="/" className={`text-gray-700 hover:text-blue-600 ${pathname === '/' ? 'font-medium text-blue-600' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                Início
              </Link>
              
              {!isAuthenticated && (
                <>
                  <Link href="/como-funciona" className={`text-gray-700 hover:text-blue-600 ${pathname === '/como-funciona' ? 'font-medium text-blue-600' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                    Como Funciona
                  </Link>
                  <Link href="/sorteios" className={`text-gray-700 hover:text-blue-600 ${pathname === '/sorteios' ? 'font-medium text-blue-600' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                    Sorteios
                  </Link>
                  <Link href="/faq" className={`text-gray-700 hover:text-blue-600 ${pathname === '/faq' ? 'font-medium text-blue-600' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                    FAQ
                  </Link>
                </>
              )}

              {isAuthenticated ? (
                <>
                  <div className="pt-4 mt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-2 mb-4">
                      <FaUser className="text-gray-500" />
                      <span className="text-gray-700 font-medium">
                        <span className="font-semibold">{tipoUsuario || 'Contribuinte'}:</span> {nomeUsuario}
                      </span>
                    </div>
                    <div className="flex flex-col space-y-4">
                      <Link href="/dashboard" className="text-gray-700 hover:text-blue-600" onClick={() => setMobileMenuOpen(false)}>
                        Meu Painel
                      </Link>
                      
                      {userMaster !== 'S' && (
                        <Link href="/meus-documentos" className={`text-gray-700 hover:text-blue-600 ${pathname.includes('/meus-documentos') ? 'font-medium text-blue-600' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                          Meus Documentos
                        </Link>
                      )}
                      
                      <button 
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOut();
                        }}
                        className="text-red-500 hover:text-red-700 inline-flex items-center"
                      >
                        <FaSignOutAlt className="mr-2" />
                        Sair
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col space-y-2 pt-4 mt-4 border-t border-gray-100">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="secondary" className="w-full">Login</Button>
                  </Link>
                  <Link href="/registro" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="primary" className="w-full">Cadastrar</Button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
} 