<?php
// =====================================================
// CREAR NUEVA SESIÓN DE MATCHING
// POST /php/create-session.php
// =====================================================

require_once 'db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
}

$input = getJsonInput();

// Validar datos requeridos
$usuario_id = $input['usuario_id'] ?? null;
$nombre_sesion = $input['nombre_sesion'] ?? null;
$pesos_config = $input['pesos_config'] ?? null;
$total_productos = $input['total_productos'] ?? 0;

if (!$usuario_id || !$nombre_sesion) {
    jsonResponse([
        'success' => false, 
        'message' => 'usuario_id y nombre_sesion son requeridos'
    ], 400);
}

try {
    // Convertir pesos a JSON si viene como array
    $pesos_json = is_array($pesos_config) ? json_encode($pesos_config) : $pesos_config;
    
    // Insertar sesión
    $stmt = $pdo->prepare("
        INSERT INTO matching_sesiones 
        (usuario_id, nombre_sesion, pesos_config, total_productos, estado) 
        VALUES (:usuario_id, :nombre_sesion, :pesos_config, :total_productos, 'en_progreso')
    ");
    
    $stmt->execute([
        ':usuario_id' => $usuario_id,
        ':nombre_sesion' => $nombre_sesion,
        ':pesos_config' => $pesos_json,
        ':total_productos' => $total_productos
    ]);
    
    $sesion_id = $pdo->lastInsertId();
    
    // Registrar en historial
    $stmt = $pdo->prepare("
        INSERT INTO matching_historial (sesion_id, accion, detalles) 
        VALUES (:sesion_id, 'crear', :detalles)
    ");
    
    $stmt->execute([
        ':sesion_id' => $sesion_id,
        ':detalles' => json_encode(['productos' => $total_productos])
    ]);
    
    jsonResponse([
        'success' => true,
        'message' => 'Sesión creada exitosamente',
        'sesion_id' => $sesion_id
    ]);
    
} catch(PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Error al crear sesión',
        'error' => $e->getMessage()
    ], 500);
}
?>
