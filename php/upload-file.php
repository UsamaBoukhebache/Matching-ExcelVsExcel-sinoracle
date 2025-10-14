<?php
// =====================================================
// SUBIR ARCHIVO EXCEL A LA BASE DE DATOS (COMPRIMIDO)
// POST /php/upload-file.php
// =====================================================

require_once 'db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
}

$input = getJsonInput();

// Validar datos requeridos
$sesion_id = $input['sesion_id'] ?? null;
$tipo_archivo = $input['tipo_archivo'] ?? null; // 'referencia' o 'sugerencias'
$nombre_archivo = $input['nombre_archivo'] ?? null;
$datos = $input['datos'] ?? null; // Array de productos
$columnas_mapeadas = $input['columnas_mapeadas'] ?? null;

if (!$sesion_id || !$tipo_archivo || !$datos || !$columnas_mapeadas) {
    jsonResponse([
        'success' => false, 
        'message' => 'Faltan datos requeridos (sesion_id, tipo_archivo, datos, columnas_mapeadas)'
    ], 400);
}

try {
    // Convertir datos a JSON
    $datos_json = json_encode($datos);
    $datos_size = strlen($datos_json);
    
    // Comprimir datos con GZIP 
    $datos_comprimidos = gzencode($datos_json, 6);
    
    // Verificar si ya existe un archivo del mismo tipo para esta sesión
    $stmt = $pdo->prepare("
        SELECT id FROM matching_archivos 
        WHERE sesion_id = :sesion_id AND tipo_archivo = :tipo_archivo
    ");
    $stmt->execute([
        ':sesion_id' => $sesion_id,
        ':tipo_archivo' => $tipo_archivo
    ]);
    
    if ($stmt->fetch()) {
        // Actualizar archivo existente
        $stmt = $pdo->prepare("
            UPDATE matching_archivos 
            SET nombre_archivo = :nombre_archivo,
                datos_comprimidos = :datos_comprimidos,
                datos_size = :datos_size,
                columnas_mapeadas = :columnas_mapeadas,
                fecha_subida = CURRENT_TIMESTAMP
            WHERE sesion_id = :sesion_id AND tipo_archivo = :tipo_archivo
        ");
    } else {
        // Insertar nuevo archivo
        $stmt = $pdo->prepare("
            INSERT INTO matching_archivos 
            (sesion_id, tipo_archivo, nombre_archivo, datos_comprimidos, datos_size, columnas_mapeadas) 
            VALUES (:sesion_id, :tipo_archivo, :nombre_archivo, :datos_comprimidos, :datos_size, :columnas_mapeadas)
        ");
    }
    
    $columnas_json = is_array($columnas_mapeadas) ? json_encode($columnas_mapeadas) : $columnas_mapeadas;
    
    $stmt->execute([
        ':sesion_id' => $sesion_id,
        ':tipo_archivo' => $tipo_archivo,
        ':nombre_archivo' => $nombre_archivo,
        ':datos_comprimidos' => $datos_comprimidos,
        ':datos_size' => $datos_size,
        ':columnas_mapeadas' => $columnas_json
    ]);
    
    $compresion_ratio = round(($datos_size / strlen($datos_comprimidos)) * 100, 1);
    
    jsonResponse([
        'success' => true,
        'message' => 'Archivo subido exitosamente',
        'stats' => [
            'size_original' => $datos_size,
            'size_comprimido' => strlen($datos_comprimidos),
            'compresion_ratio' => $compresion_ratio . '%',
            'productos' => count($datos)
        ]
    ]);
    
} catch(PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Error al subir archivo',
        'error' => $e->getMessage()
    ], 500);
}
?>
