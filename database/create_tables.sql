-- 1. TABLA DE SESIONES DE MATCHING
CREATE TABLE IF NOT EXISTS matching_sesiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre_sesion VARCHAR(255) NOT NULL,
    estado ENUM('en_progreso', 'completada', 'pausada') DEFAULT 'en_progreso',
    
    -- Progreso de la sesión
    indice_actual INT DEFAULT 0,
    productos_matcheados INT DEFAULT 0,
    productos_no_match INT DEFAULT 0,
    total_productos INT DEFAULT 0,
    
    -- Configuración de pesos (almacenado como JSON)
    pesos_config TEXT,
    
    -- Timestamps
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fecha_completada TIMESTAMP NULL,
    
    -- Índices para búsquedas rápidas
    INDEX idx_usuario (usuario_id),
    INDEX idx_estado (estado),
    INDEX idx_fecha_creacion (fecha_creacion),
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABLA DE ARCHIVOS EXCEL (con compresión)
CREATE TABLE IF NOT EXISTS matching_archivos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sesion_id INT NOT NULL,
    tipo_archivo ENUM('referencia', 'sugerencias') NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    
    -- Datos comprimidos (GZIP)
    datos_comprimidos MEDIUMBLOB NOT NULL,
    datos_size INT NOT NULL COMMENT 'Tamaño sin comprimir en bytes',
    
    -- Mapeo de columnas (JSON)
    columnas_mapeadas TEXT NOT NULL,
    
    -- Timestamps
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_sesion (sesion_id),
    UNIQUE KEY unique_sesion_tipo (sesion_id, tipo_archivo),
    
    FOREIGN KEY (sesion_id) REFERENCES matching_sesiones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABLA DE RESULTADOS DE MATCHING
CREATE TABLE IF NOT EXISTS matching_resultados (
    sesion_id INT NOT NULL,
    indice_producto INT NOT NULL,
    
    -- Resultado del match
    codiprod_sugerido VARCHAR(500) DEFAULT NULL COMMENT 'Puede ser múltiple separado por comas',
    puntuacion_total DECIMAL(6,2) DEFAULT NULL,
    puntuacion_detallada TEXT DEFAULT NULL COMMENT 'JSON con desglose de puntos',
    
    -- Flags
    es_multiple BOOLEAN DEFAULT FALSE,
    es_no_match BOOLEAN DEFAULT FALSE,
    tiene_comentario BOOLEAN DEFAULT FALSE COMMENT 'Si es NO MATCH con comentario',
    
    -- Timestamp
    fecha_match TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Clave primaria compuesta
    PRIMARY KEY (sesion_id, indice_producto),
    
    -- Índices
    INDEX idx_fecha (fecha_match),
    INDEX idx_no_match (es_no_match),
    
    FOREIGN KEY (sesion_id) REFERENCES matching_sesiones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABLA DE HISTORIAL DE SESIONES (opcional, para auditoría)
CREATE TABLE IF NOT EXISTS matching_historial (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sesion_id INT NOT NULL,
    accion VARCHAR(100) NOT NULL COMMENT 'crear, pausar, reanudar, completar, exportar',
    detalles TEXT COMMENT 'JSON con información adicional',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_sesion (sesion_id),
    INDEX idx_accion (accion),
    
    FOREIGN KEY (sesion_id) REFERENCES matching_sesiones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

