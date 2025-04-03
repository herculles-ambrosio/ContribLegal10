import { supabase } from './supabase';

// Função segura para acessar localStorage/sessionStorage
const safeStorage = {
  getLocalItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (error) {
      console.error(`Erro ao acessar localStorage [${key}]:`, error);
      return null;
    }
  },
  
  setLocalItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`Erro ao definir localStorage [${key}]:`, error);
    }
  },
  
  removeLocalItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Erro ao remover localStorage [${key}]:`, error);
    }
  },
  
  getSessionItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return sessionStorage.getItem(key);
      }
      return null;
    } catch (error) {
      console.error(`Erro ao acessar sessionStorage [${key}]:`, error);
      return null;
    }
  },
  
  setSessionItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`Erro ao definir sessionStorage [${key}]:`, error);
    }
  },
  
  removeSessionItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Erro ao remover sessionStorage [${key}]:`, error);
    }
  }
};

// Verificar sessão manual do usuário
const checkUserManualSession = () => {
  try {
    // Verificar localStorage
    const userLocalStorage = safeStorage.getLocalItem('supabase.auth.user');
    const tokenLocalStorage = safeStorage.getLocalItem('supabase.auth.token');
    
    if (userLocalStorage && tokenLocalStorage) {
      const user = JSON.parse(userLocalStorage);
      const token = JSON.parse(tokenLocalStorage);
      
      // Verificar se é um usuário válido e se o token não expirou
      if (token.access_token === 'user-bypass-token') {
        const expiresAt = token.expires_at * 1000; // Converter para milissegundos
        
        if (expiresAt > Date.now()) {
          console.log('Sessão manual do usuário encontrada e válida');
          
          // Verificar e preservar a role que foi definida manualmente
          const userMaster = user.master || 'N';
          const tipoUsuario = 'Usuário';
          
          console.log('Status master detectado na sessão manual:', userMaster);
          
          return {
            user: {
              id: '00000000-0000-0000-0000-000000000001',
              email: user.email,
              user_metadata: {
                nome_completo: user.user_metadata?.nome_completo || 'Usuário do Sistema',
                tipo_usuario: tipoUsuario
              },
              master: userMaster,
              app_metadata: {
                provider: 'email'
              }
            }
          };
        } else {
          console.log('Sessão manual do usuário expirada');
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao verificar sessão manual do usuário:', error);
    return null;
  }
};

export const getUsuarioLogado = async () => {
  // Primeiro verificar se tem sessão manual do usuário
  const userSession = typeof window !== 'undefined' ? checkUserManualSession() : null;
  
  if (userSession) {
    // Determinar o tipo de usuário com base no master
    const tipoUsuario = userSession.user.master === 'S' ? 'Administrador' : 'Usuário';
    
    console.log('Retornando informações da sessão manual:', { 
      master: userSession.user.master,
      tipo: tipoUsuario
    });
    
    return {
      ...userSession.user,
      tipo_usuario: tipoUsuario,
      master: userSession.user.master,
      cpf_cnpj: '12345678901',
      nome_completo: userSession.user.user_metadata?.nome_completo || 'Usuário do Sistema'
    };
  }
  
  try {
    // Se não, verificar a sessão normal do Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return null;
    }
    
    // Buscar informações adicionais do usuário no banco de dados
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (error || !usuario) {
      console.error('Erro ao buscar informações do usuário:', error);
      return null;
    }
    
    // Definir o tipo de usuário com base no master
    const tipoUsuario = usuario.master === 'S' ? 'Administrador' : 'Contribuinte';
    
    console.log('Retornando informações do Supabase:', { 
      master: usuario.master,
      tipo: tipoUsuario,
      nome: usuario.nome_completo
    });
    
    return {
      ...session.user,
      ...usuario,
      tipo_usuario: tipoUsuario
    };
  } catch (error) {
    console.error('Erro ao verificar usuário logado:', error);
    return null;
  }
};

export const logout = async () => {
  // Limpar tanto a sessão do Supabase quanto a sessão manual do usuário
  if (typeof window !== 'undefined') {
    safeStorage.removeLocalItem('supabase.auth.user');
    safeStorage.removeLocalItem('supabase.auth.token');
    safeStorage.removeSessionItem('supabase.auth.user');
    safeStorage.removeSessionItem('supabase.auth.token');
  }
  
  try {
    return await supabase.auth.signOut();
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    return { error };
  }
}; 