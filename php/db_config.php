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

// =====================================================
// CONFIGURACIÓN DE BASE DE DATOS - DOS BASES DE DATOS
// =====================================================
// 1. MENU_MD → Para autenticación (usuarios, tokens SSO)
// 2. MATCHING → Para datos de matching (sesiones, archivos, resultados)
// Última actualización: 18/12/2025 - Corregido nombre de base de datos
// =====================================================

$isLocal = strpos($_SERVER['HTTP_HOST'], 'localhost') !== false;

// 🔐 CONEXIÓN A MENU_MD (Autenticación)
if ($isLocal) {
    $authHost = 'localhost';
    $authDbname = 'MENU_MD';
    $authUsername = 'root';
    $authPassword = '';
} else {
    $authHost = '10.0.0.7';
    $authDbname = 'MENU_MD';
    $authUsername = 'usama';
    $authPassword = 'Usama.md.2015';
}

try {
    $pdoAuth = new PDO("mysql:host=$authHost;dbname=$authDbname;charset=utf8", $authUsername, $authPassword);
    $pdoAuth->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdoAuth->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Error de conexión a la base de datos de autenticación'
    ]);
    exit();
}

// 📊 CONEXIÓN A MATCHING (Datos de Matching)
// La base de datos se llama MATCHING (TODO EN MAYÚSCULAS)
$matchingHost = '10.0.0.7';
$matchingDbname = 'MATCHING';
$matchingUsername = 'usama';
$matchingPassword = 'Usama.md.2015';

try {
    $pdo = new PDO("mysql:host=$matchingHost;dbname=$matchingDbname;charset=utf8", $matchingUsername, $matchingPassword);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Error de conexión a la base de datos MATCHING',
        'error' => $e->getMessage(),
        'database' => $matchingDbname,
        'host' => $matchingHost
    ]);
    exit();
}

// =====================================================
// FUNCIONES HELPER
// =====================================================

/**
 * Obtiene la conexión a la base de datos de AUTENTICACIÓN (MENU_MD)
 * Usar para: usuarios, tokens SSO, logs de acceso
 * @return PDO
 */
function getAuthDB() {
    global $pdoAuth;
    return $pdoAuth;
}

/**
 * Obtiene la conexión a la base de datos de MATCHING
 * Usar para: sesiones, archivos, resultados, mapeos
 * @return PDO
 */
function getMatchingDB() {
    global $pdo;
    return $pdo;
}

/**
 * Obtiene JSON del body de la petición
 * @return array|null
 */
function getJsonInput() {
    $json = file_get_contents('php://input');
    return json_decode($json, true);
}

/**
 * Responde con JSON y termina la ejecución
 * @param mixed $data Datos a enviar
 * @param int $statusCode Código HTTP
 */
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

/**
 * Verifica que el usuario esté autenticado (desde sesión PHP)
 * @return array|null Retorna datos del usuario o null
 */
function verifyAuth() {
    session_start();
    
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['username'])) {
        return null;
    }
    
    return [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'nombre' => $_SESSION['nombre'] ?? $_SESSION['username']
    ];
}
?>
