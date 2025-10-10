<?php
// =====================================================
// ELIMINAR SESIÓN (y todos sus datos relacionados)
// DELETE /php/delete-session.php
// =====================================================

require_once 'db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
}

$input = getJsonInput();
$sesion_id = $input['sesion_id'] ?? null;

if (!$sesion_id) {
    jsonResponse([
        'success' => false, 
        'message' => 'sesion_id es requerido'
    ], 400);
}

try {
    // Verificar que la sesión existe
    $stmt = $pdo->prepare("SELECT id, nombre_sesion FROM matching_sesiones WHERE id = :sesion_id");
    $stmt->execute([':sesion_id' => $sesion_id]);
    $sesion = $stmt->fetch();
    
    if (!$sesion) {
        jsonResponse([
            'success' => false,
            'message' => 'Sesión no encontrada'
        ], 404);
    }
    
    // Registrar en historial antes de eliminar
    $stmt = $pdo->prepare("
        INSERT INTO matching_historial (sesion_id, accion, detalles) 
        VALUES (:sesion_id, 'eliminar', :detalles)
    ");
    $stmt->execute([
        ':sesion_id' => $sesion_id,
        ':detalles' => json_encode(['nombre' => $sesion['nombre_sesion']])
    ]);
    
    // Eliminar sesión (CASCADE eliminará archivos y resultados automáticamente)
    $stmt = $pdo->prepare("DELETE FROM matching_sesiones WHERE id = :sesion_id");
    $stmt->execute([':sesion_id' => $sesion_id]);
    
    jsonResponse([
        'success' => true,
        'message' => 'Sesión eliminada exitosamente'
    ]);
    
} catch(PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Error al eliminar sesión',
        'error' => $e->getMessage()
    ], 500);
}
?>
