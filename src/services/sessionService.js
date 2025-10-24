// =====================================================
// SERVICIO DE API PARA SESIONES DE MATCHING
// Maneja toda la comunicación con el backend PHP
// =====================================================

const API_BASE_URL = 
  import.meta.env.MODE === "development"
    ? "https://www.mercadinamica.es/v2/matching-app/php" // Local con XAMPP
    : "https://www.mercadinamica.es/v2/matching-app/php"; // Producción IONOS

class SessionService {
  
  // =====================================================
  // CREAR NUEVA SESIÓN
  // =====================================================
  async createSession(usuarioId, nombreSesion, pesosConfig, totalProductos) {
    try {
      const response = await fetch(`${API_BASE_URL}/create-session.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuarioId,
          nombre_sesion: nombreSesion,
          pesos_config: pesosConfig,
          total_productos: totalProductos
        })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creando sesión:', error);
      return { success: false, message: 'Error de conexión' };
    }
  }
  
  // =====================================================
  // SUBIR ARCHIVO EXCEL (COMPRIMIDO)
  // =====================================================
  async uploadFile(sesionId, tipoArchivo, nombreArchivo, datos, columnasMapeadas) {
    try {
      const response = await fetch(`${API_BASE_URL}/upload-file.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sesion_id: sesionId,
          tipo_archivo: tipoArchivo, // 'referencia' o 'sugerencias'
          nombre_archivo: nombreArchivo,
          datos: datos, // Array de productos
          columnas_mapeadas: columnasMapeadas
        })
      });
      
      const data = await response.json();
      console.log('📤 Archivo subido:', data.stats);
      return data;
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      return { success: false, message: 'Error de conexión' };
    }
  }
  
  // =====================================================
  // OBTENER TODAS LAS SESIONES DEL USUARIO
  // =====================================================
  async getSessions(usuarioId) {
    try {
      const response = await fetch(`${API_BASE_URL}/get-sessions.php?usuario_id=${usuarioId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error obteniendo sesiones:', error);
      return { success: false, message: 'Error de conexión' };
    }
  }
  
  // =====================================================
  // CARGAR SESIÓN COMPLETA (con archivos y resultados)
  // =====================================================
  async loadSession(sesionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/load-session.php?sesion_id=${sesionId}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('📥 Sesión cargada:', {
          productos: data.archivos.referencia?.productos || 0,
          resultados: data.total_resultados,
          progreso: `${data.sesion.indice_actual}/${data.sesion.total_productos}`
        });
      }
      
      return data;
    } catch (error) {
      console.error('Error cargando sesión:', error);
      return { success: false, message: 'Error de conexión' };
    }
  }
  
  // =====================================================
  // GUARDAR RESULTADO DE UN MATCH (INMEDIATO)
  // =====================================================
  async saveMatch(sesionId, indiceProducto, match) {
    try {
      const response = await fetch(`${API_BASE_URL}/save-match.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sesion_id: sesionId,
          indice_producto: indiceProducto,
          codiprod_sugerido: match.codiprodSugerido || null,
          puntuacion_total: match.puntuacionTotal || null,
          puntuacion_detallada: match.detalles ? JSON.stringify(match.detalles) : null,
          es_multiple: match.esMultiple || false,
          es_no_match: match.esNoMatch || false
        })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error guardando match:', error);
      return { success: false, message: 'Error de conexión' };
    }
  }
  
  // =====================================================
  // ACTUALIZAR PROGRESO DE LA SESIÓN
  // =====================================================
  async updateProgress(sesionId, progreso) {
    try {
      const response = await fetch(`${API_BASE_URL}/update-progress.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sesion_id: sesionId,
          indice_actual: progreso.indiceActual,
          productos_matcheados: progreso.productosMatcheados,
          productos_no_match: progreso.productosNoMatch,
          estado: progreso.estado // Opcional
        })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error actualizando progreso:', error);
      return { success: false, message: 'Error de conexión' };
    }
  }
  
  // =====================================================
  // ELIMINAR SESIÓN
  // =====================================================
  async deleteSession(sesionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/delete-session.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion_id: sesionId })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error eliminando sesión:', error);
      return { success: false, message: 'Error de conexión' };
    }
  }
  
  // =====================================================
  // AUTO-SAVE: Guardar match y actualizar progreso cada N matches
  // =====================================================
  matchCounter = 0;
  SYNC_INTERVAL = 5; // Sync de progreso cada 5 matches
  
  async autoSave(sesionId, indiceProducto, match, progreso) {
    // 1. SIEMPRE guardar el match individual (inmediato)
    const matchResult = await this.saveMatch(sesionId, indiceProducto, match);
    
    if (!matchResult.success) {
      console.warn('⚠️ Error guardando match:', matchResult.message);
    }
    
    // 2. Incrementar contador
    this.matchCounter++;
    
    // 3. Sync de progreso cada N matches
    if (this.matchCounter >= this.SYNC_INTERVAL) {
      console.log(`🔄 Sync de progreso (cada ${this.SYNC_INTERVAL} matches)`);
      await this.updateProgress(sesionId, progreso);
      this.matchCounter = 0; // Reset contador
    }
    
    return matchResult;
  }
  
  // =====================================================
  // FORCE SYNC: Forzar sync de progreso (al cerrar, cambiar navegación)
  // =====================================================
  async forceSync(sesionId, progreso) {
    console.log('💾 Sync forzado de progreso');
    this.matchCounter = 0; // Reset contador
    return await this.updateProgress(sesionId, progreso);
  }
}

export default new SessionService();
