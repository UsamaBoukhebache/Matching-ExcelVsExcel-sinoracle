<?php
// =====================================================
// GUARDAR RESULTADO DE UN MATCH
// POST /php/save-match.php
// =====================================================

require_once 'db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
}

$input = getJsonInput();

// Validar datos requeridos
$sesion_id = $input['sesion_id'] ?? null;
$indice_producto = $input['indice_producto'] ?? null;
$codiprod_sugerido = $input['codiprod_sugerido'] ?? null;
$puntuacion_total = $input['puntuacion_total'] ?? null;
$puntuacion_detallada = $input['puntuacion_detallada'] ?? null;
$es_multiple = $input['es_multiple'] ?? false;
$es_no_match = $input['es_no_match'] ?? false;

if ($sesion_id === null || $indice_producto === null) {
    jsonResponse([
        'success' => false, 
        'message' => 'sesion_id e indice_producto son requeridos'
    ], 400);
}

try {
    // Convertir puntuación detallada a JSON si es array
    $puntuacion_json = is_array($puntuacion_detallada) ? json_encode($puntuacion_detallada) : $puntuacion_detallada;
    
    // Usar REPLACE INTO para insertar o actualizar
    $stmt = $pdo->prepare("
        REPLACE INTO matching_resultados 
        (sesion_id, indice_producto, codiprod_sugerido, puntuacion_total, 
         puntuacion_detallada, es_multiple, es_no_match, fecha_match) 
        VALUES 
        (:sesion_id, :indice_producto, :codiprod_sugerido, :puntuacion_total, 
         :puntuacion_detallada, :es_multiple, :es_no_match, CURRENT_TIMESTAMP)
    ");
    
    $stmt->execute([
        ':sesion_id' => $sesion_id,
        ':indice_producto' => $indice_producto,
        ':codiprod_sugerido' => $codiprod_sugerido,
        ':puntuacion_total' => $puntuacion_total,
        ':puntuacion_detallada' => $puntuacion_json,
        ':es_multiple' => $es_multiple ? 1 : 0,
        ':es_no_match' => $es_no_match ? 1 : 0
    ]);
    
    jsonResponse([
        'success' => true,
        'message' => 'Match guardado exitosamente'
    ]);
    
} catch(PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Error al guardar match',
        'error' => $e->getMessage()
    ], 500);
}
?>
