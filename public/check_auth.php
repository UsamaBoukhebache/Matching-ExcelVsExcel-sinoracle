<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

// Capturar todos los errores
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    http_response_code(500);
    echo json_encode([
        'authenticated' => false,
        'error' => 'PHP Error',
        'details' => "$errstr en $errfile línea $errline"
    ]);
    exit();
});

try {
    require_once(__DIR__ . '/auth_lib.php');
    require_once(__DIR__ . '/sso_token_manager.php');
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'authenticated' => false,
        'error' => 'Error cargando archivos',
        'details' => $e->getMessage()
    ]);
    exit();
}

header('Content-Type: application/json');
header('Access-Control-Allow-Credentials: true');

// Crear instancia de auth
$auth = new MercadinamicaAuth();

// 1. Si viene con token SSO, validarlo y crear sesión
if (isset($_GET['sso_token'])) {
    $token = $_GET['sso_token'];
    
    $tokenManager = new SSOTokenManager();
    
    // Validar token
    $userData = $tokenManager->validateToken($token);
    
    if ($userData) {
        // Token válido: crear sesión manualmente
        $_SESSION['user_id'] = $userData['user_id'];
        $_SESSION['username'] = $userData['username'];
        $_SESSION['nombre'] = $userData['nombre'];
        
        echo json_encode([
            'authenticated' => true,
            'user' => [
                'id' => $userData['user_id'],
                'username' => $userData['username'],
                'nombre' => $userData['nombre']
            ]
        ]);
        exit();
    } else {
        // Token inválido - mostrar por qué
        http_response_code(401);
        echo json_encode([
            'authenticated' => false,
            'error' => 'Token inválido o expirado',
            'debug' => $tokenManager->getLastError(),
            'login_url' => 'https://www.mercadinamica.es/v2/Menu-MD/#/login'
        ]);
        exit();
    }
}

// 2. Si no hay token, verificar sesión existente
if (!$auth->isAuthenticated()) {
    http_response_code(401);
    echo json_encode([
        'authenticated' => false,
        'login_url' => 'https://www.mercadinamica.es/v2/Menu-MD/#/login'
    ]);
    exit();
}

// Sesión válida
$user = $auth->getUser();
echo json_encode([
    'authenticated' => true,
    'user' => $user
]);
?>
