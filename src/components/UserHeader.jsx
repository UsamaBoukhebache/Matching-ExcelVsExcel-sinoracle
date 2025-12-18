import './UserHeader.css';

export function UserHeader({ user }) {
  const handleLogout = async () => {
    try {
      console.log('🚪 Cerrando sesión local...');
      
      // Cerrar sesión local
      await fetch('./logout.php', {
        credentials: 'include'
      });
      
      // Emitir evento de logout para sincronizar con otras apps/pestañas
      localStorage.setItem('mercadinamica_logout', Date.now().toString());
      console.log('📡 Evento de logout emitido a todas las apps');
      
      // Redirigir al menú
      window.location.href = 'https://www.mercadinamica.es/v2/Menu-MD/#/login';
    } catch (error) {
      console.error('❌ Error cerrando sesión:', error);
      // Redirigir de todos modos
      window.location.href = 'https://www.mercadinamica.es/v2/Menu-MD/#/login';
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="user-header">
      <div className="user-info">
        <div className="user-icon">👤</div>
        <div className="user-details">
          <div className="user-name">{user.nombre}</div>
          <div className="user-username">@{user.username}</div>
        </div>
      </div>
      <button className="logout-btn" onClick={handleLogout}>
        🚪 Cerrar Sesión
      </button>
    </div>
  );
}
