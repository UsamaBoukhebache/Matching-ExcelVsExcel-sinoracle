<?php
// =====================================================
// GUARDAR MAPEO DE MARCAS EDITADAS
// POST /php/save-brand-mapping.php
// =====================================================

require_once 'db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
}

$input = getJsonInput();

$sesion_id = $input['sesion_id'] ?? null;
$mapeo_marcas = $input['mapeo_marcas'] ?? null;

if (!$sesion_id || !is_array($mapeo_marcas)) {
    jsonResponse([
        'success' => false,
        'message' => 'Faltan parámetros requeridos (sesion_id y mapeo_marcas)'
    ], 400);
}

try {
    // Convertir el mapeo de marcas a JSON
    $mapeoMarcasJson = json_encode($mapeo_marcas, JSON_UNESCAPED_UNICODE);
    
    // Actualizar la sesión con el mapeo de marcas
    $stmt = $pdo->prepare("
        UPDATE matching_sesiones 
        SET mapeo_marcas = :mapeo_marcas
        WHERE id = :sesion_id
    ");
    
    $stmt->execute([
        ':mapeo_marcas' => $mapeoMarcasJson,
        ':sesion_id' => $sesion_id
    ]);
    
    jsonResponse([
        'success' => true,
        'message' => 'Mapeo de marcas guardado correctamente',
        'total_marcas_editadas' => count($mapeo_marcas)
    ]);
    
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Error en la base de datos: ' . $e->getMessage()
    ], 500);
}
