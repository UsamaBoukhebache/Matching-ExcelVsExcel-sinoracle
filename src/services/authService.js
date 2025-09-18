// filepath: src/services/authService.js
// Servicio de autenticación más seguro

class AuthService {
  constructor() {
    this.adminCredentials = null;
    this.loadCredentials();
  }

  // Cargar credenciales desde variables de entorno
  loadCredentials() {
    this.adminCredentials = {
      username: process.env.REACT_APP_ADMIN_USERNAME ,
      password: process.env.REACT_APP_ADMIN_PASSWORD
    };
  }

  // Función de hash simple (en producción usar bcrypt o similar)
  simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // Verificar credenciales de admin
  async verifyAdminCredentials(username, password) {
    // Añadir un pequeño delay para simular autenticación real
    await new Promise(resolve => setTimeout(resolve, 500));

    const isValidUsername = username === this.adminCredentials.username;
    const isValidPassword = password === this.adminCredentials.password;

    if (isValidUsername && isValidPassword) {
      // Generar token simple (en producción usar JWT real)
      const token = this.generateToken(username);
      
      return {
        success: true,
        user: {
          id: 0,
          username: "admin",
          nombre: "Administrador",
          isAdmin: true,
          token: token
        }
      };
    }

    return {
      success: false,
      message: "Credenciales de administrador incorrectas"
    };
  }

  // Generar token simple
  generateToken(username) {
    const timestamp = Date.now();
    const data = `${username}-${timestamp}`;
    return btoa(data); // Base64 encode
  }

  // Verificar si el token es válido
  verifyToken(token) {
    try {
      const decoded = atob(token);
      const [username, timestamp] = decoded.split('-');
      const tokenAge = Date.now() - parseInt(timestamp);
      
      // Token válido por 24 horas
      return tokenAge < (24 * 60 * 60 * 1000) && username === this.adminCredentials.username;
    } catch (error) {
      return false;
    }
  }

  // Logout
  logout() {
    localStorage.removeItem('userSession');
    localStorage.removeItem('adminToken');
  }

  // Verificar si hay una sesión admin válida
  checkAdminSession() {
    try {
      const session = localStorage.getItem('userSession');
      if (!session) return null;

      const userSession = JSON.parse(session);
      if (!userSession.isAdmin || !userSession.token) return null;

      // Verificar que el token siga siendo válido
      if (!this.verifyToken(userSession.token)) {
        this.logout();
        return null;
      }

      return userSession;
    } catch (error) {
      this.logout();
      return null;
    }
  }
}

export default new AuthService();
