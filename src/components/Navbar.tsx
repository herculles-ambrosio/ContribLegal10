import Link from 'next/link';
import { FaHome, FaUser, FaSignOutAlt, FaSignInAlt, FaUserPlus, FaFileAlt, FaUsersCog } from 'react-icons/fa';
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

  useEffect(() => {
    const verificarTipoUsuario = async () => {
      if (isAuthenticated) {
        try {
          // Obter dados do usuário
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) return;
          
          // Buscar dados do usuário no banco
          const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (error) {
            console.error('Erro ao buscar dados do usuário:', error);
            return;
          }
          
          if (usuario) {
            setTipoUsuario(usuario.tipo_usuario || '');
            setNomeUsuario(usuario.nome_completo || '');
            setUserRole(usuario.role || '');
            setIsMaster(usuario.master === 'S');
          }
        } catch (error) {
          console.error('Erro ao verificar tipo de usuário:', error);
        }
      }
    };
    
    verificarTipoUsuario();
  }, [isAuthenticated]);

  return (
    <nav className="bg-blue-600 text-white py-4 shadow-md">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <Image 
            src="/LOGO CL.jpeg" 
            alt="Contribuinte Legal" 
            width={90} 
            height={90} 
            className="rounded-md shadow-md" 
            style={{ objectFit: 'contain' }}
            priority
          />
        </Link>

        <div className="flex space-x-6 items-center">
          <Link href="/" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
            <FaHome />
            <span>Início</span>
          </Link>
          
          {isAuthenticated ? (
            <>
              {nomeUsuario && (
                <span className="mr-4 font-medium">Olá, {nomeUsuario}</span>
              )}
              
              <Link href="/meus-documentos" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
                <FaFileAlt />
                <span>Meus Documentos</span>
              </Link>
              
              <Link href="/contribuinte" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
                <FaUser />
                <span>Contribuinte</span>
              </Link>
              
              {isMaster && (
                <Link href="/admin" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
                  <FaUsersCog />
                  <span>Painel Admin</span>
                </Link>
              )}
              
              <Link href="/logout" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
                <FaSignOutAlt />
                <span>Sair</span>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
                <FaSignInAlt />
                <span>Entrar</span>
              </Link>
              
              <Link href="/registro" className="flex items-center space-x-1 hover:text-blue-200 transition-colors">
                <FaUserPlus />
                <span>Cadastrar</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
} 