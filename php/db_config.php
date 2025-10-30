<?php
// =====================================================
// CONFIGURACIÓN COMPARTIDA DE BASE DE DATOS
// Incluir este archivo en todos los endpoints PHP
// =====================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Configuración de base de datos según entorno
$isLocal = strpos($_SERVER['HTTP_HOST'], 'localhost') !== false;

if ($isLocal) {
    // Configuración en local se guarda en logroño
    $host = '10.0.0.7';
    $dbname = 'matching';
    $username = 'usama';
    $password = 'Usama.md.2015';
} else {
    // Configuración para producción IONOS
    $host = 'db5018270399.hosting-data.io';
    $dbname = 'dbs14486406';
    $username = 'dbu2851060';
    $password = 'Matching_2025_MercaDinamica';
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Error de conexión a la base de datos'
    ]);
    exit();
}

// Función auxiliar para obtener JSON del body
function getJsonInput() {
    $json = file_get_contents('php://input');
    return json_decode($json, true);
}

// Función auxiliar para responder con JSON
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}
?>
