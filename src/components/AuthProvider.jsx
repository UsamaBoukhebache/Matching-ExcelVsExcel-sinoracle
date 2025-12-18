import { useEffect, useState } from 'react';

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
    
    // Escuchar eventos de logout de otras pestañas/apps
    const handleStorageChange = (e) => {
      if (e.key === 'mercadinamica_logout') {
        console.log('🚪 Logout detectado desde otra app - Cerrando sesión...');
        // Redirigir inmediatamente al login
        window.location.href = 'https://www.mercadinamica.es/v2/Menu-MD/#/login';
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const checkAuth = async () => {
    try {
      // 1. Verificar si hay token SSO en la URL
      const urlParams = new URLSearchParams(window.location.search);
      const ssoToken = urlParams.get('sso_token');

      if (ssoToken) {
        console.log('🔑 Token SSO recibido:', ssoToken);
        
        // Validar token y crear sesión
        const response = await fetch(`./check_auth.php?sso_token=${ssoToken}`, {
          credentials: 'include'
        });
        
        console.log('📊 Status HTTP:', response.status);
        const data = await response.json();
        console.log('📊 Respuesta:', data);
        
        if (data.authenticated) {
          console.log('✅ Token válido, sesión creada');
          // Limpiar token de la URL
          window.history.replaceState({}, document.title, window.location.pathname);
          setLoading(false);
          return;
        } else {
          console.error('❌ Token inválido');
          throw new Error('Token SSO inválido');
        }
      }

      // 2. Si no hay token, verificar si ya existe sesión
      console.log('🔍 Verificando sesión existente...');
      const response = await fetch('./check_auth.php', {
        credentials: 'include'
      });
      
      console.log('📊 Status HTTP:', response.status);
      
      if (response.status === 401) {
        // No hay sesión, redirigir al login
        console.log('❌ No hay sesión, redirigiendo al login...');
        window.location.href = 'https://www.mercadinamica.es/v2/Menu-MD/#/login';
        return;
      }
      
      const data = await response.json();
      console.log('📊 Respuesta sesión:', data);

      if (!data.authenticated) {
        console.log('❌ No autenticado, redirigiendo al login...');
        window.location.href = data.login_url || 'https://www.mercadinamica.es/v2/Menu-MD/#/login';
      } else {
        console.log('✅ Sesión válida:', data.user);
      }
    } catch (err) {
      console.error('💥 ERROR:', err);
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      
      // Redirigir al login inmediatamente
      window.location.href = 'https://www.mercadinamica.es/v2/Menu-MD/#/login';
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem'
      }}>
        🔐 Verificando sesión...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: 'red'
      }}>
        ❌ {error}
      </div>
    );
  }

  return <>{children}</>;
}

export function useAuth() {
  // Hook para acceder a los datos del usuario desde cualquier componente
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('./check_auth.php', {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.authenticated && data.user) {
          console.log('👤 Usuario obtenido para header:', data.user);
          setUser(data.user);
        } else {
          console.log('⚠️ No se pudo obtener usuario para header');
        }
      } catch (err) {
        console.error('❌ Error obteniendo usuario:', err);
      }
    };

    fetchUser();
  }, []);

  return user;
}
