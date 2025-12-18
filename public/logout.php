<?php
/**
 * Logout - Destruye la sesión y responde con JSON
 * Este es el logout que se llama desde la app (con botón)
 */

// Configurar sesión compartida (misma configuración que auth_lib.php)
$currentDomain = $_SERVER['HTTP_HOST'] ?? 'localhost';
if (strpos($currentDomain, 'mercadinamica.es') !== false) {
    $cookieDomain = '.mercadinamica.es';
} elseif (strpos($currentDomain, 'mercadinamica.net') !== false) {
    $cookieDomain = '.mercadinamica.net';
} else {
    $cookieDomain = '';
}

ini_set('session.cookie_domain', $cookieDomain);
ini_set('session.cookie_path', '/');
ini_set('session.cookie_lifetime', 0);
ini_set('session.cookie_secure', false);
ini_set('session.cookie_httponly', true);
ini_set('session.cookie_samesite', 'Lax');

session_name('MERCADINAMICA_SESSION');

// Iniciar sesión
session_start();

// Destruir todas las variables de sesión
$_SESSION = array();

// Eliminar la cookie de sesión
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Destruir la sesión
session_destroy();

// Responder con JSON
header('Content-Type: application/json');
echo json_encode(['success' => true, 'message' => 'Sesión cerrada']);
exit();
?>
