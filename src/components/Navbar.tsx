'use client';

import Link from 'next/link';
import { FaHome, FaUser, FaSignOutAlt, FaSignInAlt, FaUserPlus, FaFileAlt, FaUsersCog, FaChevronDown, FaBars, FaTimes } from 'react-icons/fa';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getUsuarioLogado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type NavbarProps = {
  isAuthenticated?: boolean;
};

export default function Navbar({ isAuthenticated = false }: NavbarProps) {
  const [tipoUsuario, setTipoUsuario] = useState<string>('');
  const [nomeUsuario, setNomeUsuario] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isMaster, setIsMaster] = useState<boolean>(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [hoveredTab, setHoveredTab] = useState<string>('');
  const [mounted, setMounted] = useState(false);

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
      {/* Modern Glassmorphism Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[9999]">
        <div className="flex justify-center pt-4">
          <div className="relative">
            {/* Subtle glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-lg opacity-30"></div>
            
            {/* Main navbar container */}
            <div className="relative flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20 py-2 px-3 rounded-2xl shadow-xl">
              {/* Animated shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer rounded-2xl"></div>
              
              {/* Logo Section */}
              <div className="relative">
                <Link href="/" className="flex items-center group px-3 py-2">
                  <div className="relative">
                    <Image 
                      src="/LOGO CL.jpeg" 
                      alt="Contribuinte Legal" 
                      width={40} 
                      height={40} 
                      className="rounded-xl shadow-lg transition-all duration-300 group-hover:scale-105" 
                      style={{ objectFit: 'contain' }}
                      priority
                    />
                    {/* Subtle logo glow */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                  </div>
                </Link>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center relative">
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
                        className="relative cursor-pointer text-sm font-medium px-5 py-2.5 rounded-xl transition-all duration-300 text-gray-700 hover:text-gray-900 group"
                      >
                        {/* Active State Background */}
                        {isActive && (
                          <div className="absolute inset-0 bg-white/40 rounded-xl shadow-md">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl"></div>
                          </div>
                        )}

                        {/* Hover Effect */}
                        {isHovered && !isActive && (
                          <div className="absolute inset-0 bg-white/20 rounded-xl transition-all duration-300"></div>
                        )}

                        {/* Content */}
                        <div className="relative z-10 flex items-center space-x-2">
                          <Icon className={`transition-all duration-300 ${isActive ? 'text-blue-600' : 'group-hover:scale-110'}`} />
                          <span>{link.label}</span>
                        </div>

                        {/* Active indicator */}
                        {isActive && (
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full">
                            <div className="absolute w-6 h-3 bg-blue-500/20 rounded-full blur-sm -top-1 -left-2.5"></div>
                          </div>
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Auth Section */}
              <div className="hidden lg:flex items-center ml-4">
                {isAuthenticated ? (
                  <div className="user-dropdown relative">
                    <button
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all duration-300 group border border-white/20"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-lg">
                          {getInitials(nomeUsuario)}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-sm text-gray-700">Olá, {nomeUsuario.split(' ')[0]}</div>
                        <div className="text-xs text-gray-500">{isMaster ? 'Admin' : 'Contribuinte'}</div>
                      </div>
                      <FaChevronDown className={`text-sm transition-transform duration-300 ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Modern Dropdown */}
                    {isUserDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden z-50">
                        {/* Dropdown Header */}
                        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 border-b border-gray-200/50">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold shadow-lg">
                              {getInitials(nomeUsuario)}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-800">{nomeUsuario}</div>
                              <div className="text-sm text-gray-600">{isMaster ? 'Administrator' : 'Contribuinte'}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Dropdown Content */}
                        <div className="p-2">
                          <Link
                            href="/contribuinte"
                            className="flex items-center space-x-3 px-3 py-2.5 text-gray-700 hover:bg-gray-100/50 hover:text-gray-900 rounded-lg transition-all duration-300 group"
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            <FaUser className="text-blue-500" />
                            <span>Meu Painel</span>
                          </Link>
                          
                          <Link
                            href="/meus-documentos"
                            className="flex items-center space-x-3 px-3 py-2.5 text-gray-700 hover:bg-gray-100/50 hover:text-gray-900 rounded-lg transition-all duration-300 group"
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            <FaFileAlt className="text-purple-500" />
                            <span>Meus Documentos</span>
                          </Link>

                          {isMaster && (
                            <Link
                              href="/admin"
                              className="flex items-center space-x-3 px-3 py-2.5 text-gray-700 hover:bg-gray-100/50 hover:text-gray-900 rounded-lg transition-all duration-300 group"
                              onClick={() => setIsUserDropdownOpen(false)}
                            >
                              <FaUsersCog className="text-green-500" />
                              <span>Painel Admin</span>
                            </Link>
                          )}
                          
                          <hr className="my-2 border-gray-200/50" />
                          
                          <Link
                            href="/logout"
                            className="flex items-center space-x-3 px-3 py-2.5 text-red-600 hover:bg-red-50/50 hover:text-red-700 rounded-lg transition-all duration-300 group"
                            onClick={() => setIsUserDropdownOpen(false)}
                          >
                            <FaSignOutAlt />
                            <span>Sair</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Link
                      href="/login"
                      className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 transition-all duration-300 group"
                    >
                      <FaSignInAlt className="transition-transform duration-300 group-hover:scale-110" />
                      <span className="font-medium text-gray-700">Entrar</span>
                    </Link>
                    
                    <Link
                      href="/registro"
                      className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 group shadow-lg text-white"
                    >
                      <FaUserPlus className="transition-transform duration-300 group-hover:scale-110" />
                      <span className="font-medium">Cadastrar</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2.5 rounded-xl hover:bg-white/20 transition-all duration-300 ml-2"
              >
                {isMobileMenuOpen ? (
                  <FaTimes className="text-lg text-gray-700" />
                ) : (
                  <FaBars className="text-lg text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modern Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="mobile-menu lg:hidden fixed inset-x-0 top-full bg-white/90 backdrop-blur-xl border-t border-white/20 z-40">
            <div className="py-4 px-4 max-w-md mx-auto">
              {/* Mobile Navigation Links */}
              <div className="space-y-2 mb-6">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.id}
                      href={link.href}
                      className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-100/50 hover:text-gray-900 rounded-xl transition-all duration-300 group"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="text-lg group-hover:scale-110 transition-transform" />
                      <span className="font-medium">{link.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Mobile Auth Section */}
              {isAuthenticated ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-white/20">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {getInitials(nomeUsuario)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{nomeUsuario}</div>
                      <div className="text-sm text-gray-600">{isMaster ? 'Administrator' : 'Contribuinte'}</div>
                    </div>
                  </div>
                  
                  <Link
                    href="/logout"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-red-50/50 text-red-600 hover:bg-red-100/50 hover:text-red-700 rounded-xl transition-all duration-300 border border-red-200/50"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <FaSignOutAlt />
                    <span className="font-medium">Sair</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/login"
                    className="flex items-center justify-center space-x-2 px-4 py-3 border border-white/20 bg-white/10 text-gray-700 rounded-xl hover:bg-white/20 transition-all duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <FaSignInAlt />
                    <span className="font-medium">Entrar</span>
                  </Link>
                  
                  <Link
                    href="/registro"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <FaUserPlus />
                    <span className="font-medium">Cadastrar</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Styles */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>
    </>
  );
} 