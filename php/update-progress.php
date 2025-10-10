<?php
// =====================================================
// ACTUALIZAR PROGRESO DE LA SESIÓN
// POST /php/update-progress.php
// =====================================================

require_once 'db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
}

$input = getJsonInput();

// Validar datos requeridos
$sesion_id = $input['sesion_id'] ?? null;
$indice_actual = $input['indice_actual'] ?? null;
$productos_matcheados = $input['productos_matcheados'] ?? null;
$productos_no_match = $input['productos_no_match'] ?? null;
$estado = $input['estado'] ?? null; // Opcional: 'en_progreso', 'completada', 'pausada'

if ($sesion_id === null) {
    jsonResponse([
        'success' => false, 
        'message' => 'sesion_id es requerido'
    ], 400);
}

try {
    // Construir query dinámicamente según campos presentes
    $fields = [];
    $params = [':sesion_id' => $sesion_id];
    
    if ($indice_actual !== null) {
        $fields[] = "indice_actual = :indice_actual";
        $params[':indice_actual'] = $indice_actual;
    }
    
    if ($productos_matcheados !== null) {
        $fields[] = "productos_matcheados = :productos_matcheados";
        $params[':productos_matcheados'] = $productos_matcheados;
    }
    
    if ($productos_no_match !== null) {
        $fields[] = "productos_no_match = :productos_no_match";
        $params[':productos_no_match'] = $productos_no_match;
    }
    
    if ($estado !== null) {
        $fields[] = "estado = :estado";
        $params[':estado'] = $estado;
        
        // Si se marca como completada, guardar timestamp
        if ($estado === 'completada') {
            $fields[] = "fecha_completada = CURRENT_TIMESTAMP";
        }
    }
    
    if (empty($fields)) {
        jsonResponse([
            'success' => false,
            'message' => 'No hay campos para actualizar'
        ], 400);
    }
    
    $sql = "UPDATE matching_sesiones SET " . implode(", ", $fields) . " WHERE id = :sesion_id";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    jsonResponse([
        'success' => true,
        'message' => 'Progreso actualizado exitosamente',
        'affected_rows' => $stmt->rowCount()
    ]);
    
} catch(PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Error al actualizar progreso',
        'error' => $e->getMessage()
    ], 500);
}
?>
