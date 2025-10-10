<?php
// =====================================================
// CARGAR DATOS DE UNA SESIÓN (con archivos descomprimidos)
// GET /php/load-session.php?sesion_id=1
// =====================================================

require_once 'db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
}

$sesion_id = $_GET['sesion_id'] ?? null;

if (!$sesion_id) {
    jsonResponse([
        'success' => false, 
        'message' => 'sesion_id es requerido'
    ], 400);
}

try {
    // Obtener información de la sesión
    $stmt = $pdo->prepare("
        SELECT * FROM matching_sesiones 
        WHERE id = :sesion_id
    ");
    $stmt->execute([':sesion_id' => $sesion_id]);
    $sesion = $stmt->fetch();
    
    if (!$sesion) {
        jsonResponse([
            'success' => false,
            'message' => 'Sesión no encontrada'
        ], 404);
    }
    
    // Decodificar pesos
    if ($sesion['pesos_config']) {
        $sesion['pesos_config'] = json_decode($sesion['pesos_config'], true);
    }
    
    // Obtener archivos (descomprimir datos)
    $stmt = $pdo->prepare("
        SELECT 
            tipo_archivo,
            nombre_archivo,
            datos_comprimidos,
            datos_size,
            columnas_mapeadas,
            fecha_subida
        FROM matching_archivos 
        WHERE sesion_id = :sesion_id
    ");
    $stmt->execute([':sesion_id' => $sesion_id]);
    $archivos_raw = $stmt->fetchAll();
    
    $archivos = [];
    foreach ($archivos_raw as $archivo) {
        // Descomprimir datos
        $datos_json = gzdecode($archivo['datos_comprimidos']);
        $datos = json_decode($datos_json, true);
        
        $archivos[$archivo['tipo_archivo']] = [
            'nombre' => $archivo['nombre_archivo'],
            'datos' => $datos,
            'columnas' => json_decode($archivo['columnas_mapeadas'], true),
            'fecha_subida' => $archivo['fecha_subida'],
            'productos' => count($datos)
        ];
    }
    
    // Obtener resultados de matching
    $stmt = $pdo->prepare("
        SELECT 
            indice_producto,
            codiprod_sugerido,
            puntuacion_total,
            puntuacion_detallada,
            es_multiple,
            es_no_match,
            fecha_match
        FROM matching_resultados 
        WHERE sesion_id = :sesion_id
        ORDER BY indice_producto ASC
    ");
    $stmt->execute([':sesion_id' => $sesion_id]);
    $resultados_raw = $stmt->fetchAll();
    
    // Convertir resultados a formato de objeto indexado
    $resultados = [];
    foreach ($resultados_raw as $resultado) {
        $resultados[$resultado['indice_producto']] = [
            'codiprodSugerido' => $resultado['codiprod_sugerido'],
            'puntuacionTotal' => floatval($resultado['puntuacion_total']),
            'detalles' => $resultado['puntuacion_detallada'] ? json_decode($resultado['puntuacion_detallada'], true) : null,
            'esMultiple' => boolval($resultado['es_multiple']),
            'esNoMatch' => boolval($resultado['es_no_match']),
            'fechaMatch' => $resultado['fecha_match']
        ];
    }
    
    jsonResponse([
        'success' => true,
        'sesion' => $sesion,
        'archivos' => $archivos,
        'resultados' => $resultados,
        'total_resultados' => count($resultados)
    ]);
    
} catch(PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Error al cargar sesión',
        'error' => $e->getMessage()
    ], 500);
}
?>
