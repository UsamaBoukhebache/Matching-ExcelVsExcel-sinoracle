<?php
// =====================================================
// OBTENER SESIONES DEL USUARIO
// GET /php/get-sessions.php?usuario_id=1
// =====================================================

require_once 'db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
}

$usuario_id = $_GET['usuario_id'] ?? null;

if (!$usuario_id) {
    jsonResponse([
        'success' => false, 
        'message' => 'usuario_id es requerido'
    ], 400);
}

try {
    $stmt = $pdo->prepare("
        SELECT 
            s.id,
            s.nombre_sesion,
            s.estado,
            s.indice_actual,
            s.productos_matcheados,
            s.productos_no_match,
            s.total_productos,
            s.pesos_config,
            s.fecha_creacion,
            s.ultima_actualizacion,
            s.fecha_completada,
            COUNT(DISTINCT ma.id) as archivos_subidos
        FROM matching_sesiones s
        LEFT JOIN matching_archivos ma ON s.id = ma.sesion_id
        WHERE s.usuario_id = :usuario_id
        GROUP BY s.id
        ORDER BY s.ultima_actualizacion DESC
    ");
    
    $stmt->execute([':usuario_id' => $usuario_id]);
    $sesiones = $stmt->fetchAll();
    
    // Decodificar pesos_config de cada sesión
    foreach ($sesiones as &$sesion) {
        if ($sesion['pesos_config']) {
            $sesion['pesos_config'] = json_decode($sesion['pesos_config'], true);
        }
    }
    
    jsonResponse([
        'success' => true,
        'sesiones' => $sesiones
    ]);
    
} catch(PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Error al obtener sesiones',
        'error' => $e->getMessage()
    ], 500);
}
?>
