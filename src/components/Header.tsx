'use client';

import Link from 'next/link';
import { FaHome, FaUser, FaSignOutAlt, FaSignInAlt, FaUserPlus, FaFileAlt, FaUsersCog, FaChevronDown, FaBars, FaTimes } from 'react-icons/fa';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getUsuarioLogado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type HeaderProps = {
  isAuthenticated?: boolean;
};

export default function Header({ isAuthenticated = false }: HeaderProps) {
  const [tipoUsuario, setTipoUsuario] = useState<string>('');
  const [nomeUsuario, setNomeUsuario] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isMaster, setIsMaster] = useState<boolean>(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [hoveredTab, setHoveredTab] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const verificarTipoUsuario = async () => {
      if (isAuthenticated) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) return;
          
          const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id as any)
            .single();
            
          if (error) {
            console.error('Erro ao buscar dados do usuário:', error);
            return;
          }
          
          if (usuario) {
            setTipoUsuario((usuario as any).tipo_usuario || '');
            setNomeUsuario((usuario as any).nome_completo || '');
            setUserRole((usuario as any).role || '');
            setIsMaster((usuario as any).master === 'S');
          }
        } catch (error) {
          console.error('Erro ao verificar tipo de usuário:', error);
        }
      }
    };
    
    verificarTipoUsuario();
  }, [isAuthenticated]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-dropdown')) {
        setIsUserDropdownOpen(false);
      }
      if (!target.closest('.mobile-menu')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setNomeUsuario('');
      setTipoUsuario('');
      setIsMaster(false);
      
      toast.success('Logout realizado com sucesso!');
      router.push('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao realizar logout');
    }
  };

  const navLinks = [
    { 
      href: '/', 
      icon: FaHome, 
      label: 'Início', 
      id: 'home'
    },
    ...(isAuthenticated ? [
      { 
        href: '/meus-documentos', 
        icon: FaFileAlt, 
        label: 'Meus Documentos', 
        id: 'docs'
      },
      { 
        href: '/contribuinte', 
        icon: FaUser, 
        label: 'Meu Painel', 
        id: 'panel'
      },
      ...(isMaster ? [{ 
        href: '/admin', 
        icon: FaUsersCog, 
        label: 'Admin', 
        id: 'admin'
      }] : [])
    ] : [])
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
  };

  if (!mounted) return null;

  return (
    <>
      {/* Premium Blue Header */}
      <header className="fixed top-0 left-0 right-0 z-[9999] pt-8">
        <div className="flex justify-center">
          <div className="relative max-w-7xl">
            {/* Intense Blue Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/40 via-blue-700/30 to-blue-800/40 rounded-3xl blur-2xl opacity-60 animate-pulse"></div>
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/30 to-blue-600/30 rounded-2xl blur-xl opacity-70"></div>
            
            {/* Main Navbar Container - Blue Theme */}
            <div className="relative flex items-center gap-4 bg-white/15 backdrop-blur-2xl border border-blue-200/30 py-4 px-6 rounded-2xl shadow-2xl min-h-[80px]">
              {/* Blue Shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/15 to-transparent animate-shimmer rounded-2xl"></div>
              
              {/* Logo Section - Larger */}
              <div className="relative flex-shrink-0">
                <Link href="/" className="flex items-center group px-4 py-3">
                  <div className="relative">
                    <Image 
                      src="/LOGO_CL_trans.png" 
                      alt="Contribuinte Legal" 
                      width={120} 
                      height={60} 
                      className="rounded-2xl shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" 
                      style={{ objectFit: 'contain' }}
                      priority
                    />
                    {/* Blue Logo Glow */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400/30 to-blue-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg"></div>
                    <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-blue-500/20 to-blue-700/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
                  </div>
                </Link>
              </div>

              {/* Desktop Navigation - Blue Theme */}
              <div className="hidden lg:flex items-center relative gap-2">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = activeTab === link.id;
                  const isHovered = hoveredTab === link.id;
                  
                  return (
                    <div key={link.id} className="relative">
                      <Link
                        href={link.href}
                        onClick={() => handleNavClick(link.id)}
                        onMouseEnter={() => setHoveredTab(link.id)}
                        onMouseLeave={() => setHoveredTab('')}
                        className="relative cursor-pointer text-base font-semibold px-8 py-4 rounded-2xl transition-all duration-300 text-gray-700 hover:text-gray-900 group"
                      >
                        {/* Active State Background - Blue */}
                        {isActive && (
                          <div className="absolute inset-0 bg-white/50 rounded-2xl shadow-lg">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/25 to-blue-600/25 rounded-2xl"></div>
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/15 to-blue-500/15 rounded-2xl blur-sm"></div>
                          </div>
                        )}

                        {/* Hover Effect - Blue */}
                        {isHovered && !isActive && (
                          <div className="absolute inset-0 bg-white/30 rounded-2xl transition-all duration-300">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 to-blue-600/15 rounded-2xl"></div>
                          </div>
                        )}

                        {/* Content - Larger */}
                        <div className="relative z-10 flex items-center space-x-3">
                          <Icon className={`text-lg transition-all duration-300 ${isActive ? 'text-blue-600' : 'group-hover:scale-125 group-hover:text-blue-500'}`} />
                          <span className="text-base font-medium">{link.label}</span>
                        </div>

                        {/* Active indicator - Blue */}
                        {isActive && (
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-600 rounded-full">
                            <div className="absolute w-8 h-4 bg-blue-500/40 rounded-full blur-md -top-1 -left-3"></div>
                            <div className="absolute w-4 h-2 bg-blue-600/50 rounded-full blur-sm -top-0.5 -left-1"></div>
                          </div>
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Auth Section - Blue Theme */}
              <div className="hidden lg:flex items-center ml-6 flex-shrink-0">
                {isAuthenticated ? (
                  <div className="user-dropdown relative">
                    <button
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      className="flex items-center space-x-4 px-6 py-3 rounded-2xl bg-white/25 hover:bg-white/35 transition-all duration-300 group border border-blue-200/25 min-w-[200px]"
                    >
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {getInitials(nomeUsuario)}
                        </div>
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/40 to-blue-600/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-semibold text-base text-gray-700">Olá, {nomeUsuario.split(' ')[0]}</div>
                        <div className="text-sm text-gray-500 font-medium">{isMaster ? 'Administrator' : 'Contribuinte'}</div>
                      </div>
                      <FaChevronDown className={`text-base transition-transform duration-300 ${isUserDropdownOpen ? 'rotate-180' : ''} text-gray-600`} />
                    </button>

                    {/* Enhanced Dropdown - Blue Theme */}
                    {isUserDropdownOpen && (
                      <div className="absolute right-0 top-full mt-3 w-80 bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-blue-200/30 overflow-hidden z-50">
                        {/* Dropdown Header - Blue */}
                        <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 p-6 border-b border-blue-200/50">
                          <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                              {getInitials(nomeUsuario)}
                            </div>
                            <div>
                              <div className="font-bold text-lg text-gray-800">{nomeUsuario}</div>
                              <div className="text-base text-gray-600 font-medium">{isMaster ? 'Administrator' : 'Contribuinte'}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Dropdown Content - Enhanced */}
                        <div className="p-4">
                          <Link
                            href="/contribuinte"
                            className="flex items-center space-x-4 px-4 py-4 text-gray-700 hover:bg-blue-50/60 hover:text-gray-900 rounded-2xl transition-all duration-300 group"
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            <FaUser className="text-xl text-blue-500" />
                            <span className="font-medium text-base">Meu Painel</span>
                          </Link>
                          
                          <Link
                            href="/meus-documentos"
                            className="flex items-center space-x-4 px-4 py-4 text-gray-700 hover:bg-blue-50/60 hover:text-gray-900 rounded-2xl transition-all duration-300 group"
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            <FaFileAlt className="text-xl text-blue-600" />
                            <span className="font-medium text-base">Meus Documentos</span>
                          </Link>

                          {isMaster && (
                            <Link
                              href="/admin"
                              className="flex items-center space-x-4 px-4 py-4 text-gray-700 hover:bg-blue-50/60 hover:text-gray-900 rounded-2xl transition-all duration-300 group"
                              onClick={() => setIsUserDropdownOpen(false)}
                            >
                              <FaUsersCog className="text-xl text-blue-700" />
                              <span className="font-medium text-base">Painel Admin</span>
                            </Link>
                          )}
                          
                          <hr className="my-4 border-blue-200/60" />
                          
                          <button
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              handleSignOut();
                            }}
                            className="flex items-center space-x-4 px-4 py-4 text-red-600 hover:bg-red-50/60 hover:text-red-700 rounded-2xl transition-all duration-300 group w-full text-left"
                          >
                            <FaSignOutAlt className="text-xl" />
                            <span className="font-medium text-base">Sair</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <Link
                      href="/login"
                      className="flex items-center space-x-3 px-6 py-3 rounded-2xl border border-blue-200/25 bg-white/15 hover:bg-white/25 transition-all duration-300 group text-base font-medium"
                    >
                      <FaSignInAlt className="text-lg transition-transform duration-300 group-hover:scale-110" />
                      <span className="font-semibold text-gray-700">Entrar</span>
                    </Link>
                    
                    <Link
                      href="/registro"
                      className="flex items-center space-x-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 transition-all duration-300 group shadow-xl text-white text-base font-semibold"
                    >
                      <FaUserPlus className="text-lg transition-transform duration-300 group-hover:scale-110" />
                      <span>Cadastrar</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button - Larger */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-4 rounded-2xl hover:bg-white/25 transition-all duration-300 ml-4"
              >
                {isMobileMenuOpen ? (
                  <FaTimes className="text-2xl text-gray-700" />
                ) : (
                  <FaBars className="text-2xl text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Mobile Menu - Blue Theme */}
        {isMobileMenuOpen && (
          <div className="mobile-menu lg:hidden fixed inset-x-0 top-full bg-white/95 backdrop-blur-2xl border-t border-blue-200/30 z-40">
            <div className="py-6 px-6 max-w-md mx-auto">
              {/* Mobile Navigation Links - Larger */}
              <div className="space-y-3 mb-8">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.id}
                      href={link.href}
                      className="flex items-center space-x-4 px-6 py-4 text-gray-700 hover:bg-blue-50/60 hover:text-gray-900 rounded-2xl transition-all duration-300 group text-base font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="text-xl group-hover:scale-110 transition-transform" />
                      <span className="font-semibold">{link.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Mobile Auth Section - Blue Theme */}
              {isAuthenticated ? (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4 px-6 py-4 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-2xl border border-blue-200/25">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {getInitials(nomeUsuario)}
                    </div>
                    <div>
                      <div className="font-bold text-base text-gray-800">{nomeUsuario}</div>
                      <div className="text-sm text-gray-600 font-medium">{isMaster ? 'Administrator' : 'Contribuinte'}</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="flex items-center justify-center space-x-3 px-6 py-4 bg-red-50/60 text-red-600 hover:bg-red-100/60 hover:text-red-700 rounded-2xl transition-all duration-300 border border-red-200/60 w-full text-base font-semibold"
                  >
                    <FaSignOutAlt className="text-lg" />
                    <span>Sair</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Link
                    href="/login"
                    className="flex items-center justify-center space-x-3 px-6 py-4 border border-blue-200/25 bg-white/15 text-gray-700 rounded-2xl hover:bg-white/25 transition-all duration-300 text-base font-semibold"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <FaSignInAlt className="text-lg" />
                    <span>Entrar</span>
                  </Link>
                  
                  <Link
                    href="/registro"
                    className="flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-2xl hover:from-blue-600 hover:to-blue-800 transition-all duration-300 shadow-xl text-base font-semibold"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <FaUserPlus className="text-lg" />
                    <span>Cadastrar</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Add larger margin to prevent content overlap */}
      <div className="h-32"></div>

      {/* Enhanced Styles */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-shimmer {
          animation: shimmer 4s ease-in-out infinite;
        }
      `}</style>
    </>
  );
} 