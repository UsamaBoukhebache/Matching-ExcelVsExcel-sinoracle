<?php
/**
 * ========================================
 * MERCADINÁMICA - LIBRERÍA DE AUTENTICACIÓN SSO
 * ========================================
 * @version 1.0
 * @author Mercadinámica
 * @date 2025-12-16
 */

// ========================================
// CONFIGURACIÓN
// ========================================

// Configurar zona horaria de España
date_default_timezone_set('Europe/Madrid');

// Detectar dominio actual (.es o .net)
$currentDomain = $_SERVER['HTTP_HOST'] ?? 'localhost';
if (strpos($currentDomain, 'mercadinamica.es') !== false) {
    $cookieDomain = '.mercadinamica.es';
} elseif (strpos($currentDomain, 'mercadinamica.net') !== false) {
    $cookieDomain = '.mercadinamica.net';
} else {
    // Local o desarrollo
    $cookieDomain = '';
}

// Configuración de sesión compartida
ini_set('session.cookie_domain', $cookieDomain);
ini_set('session.cookie_path', '/');
ini_set('session.cookie_lifetime', 0); // Hasta cerrar navegador
ini_set('session.cookie_secure', false); // Cambiar a true en producción con HTTPS
ini_set('session.cookie_httponly', true);
ini_set('session.cookie_samesite', 'Lax');

// Nombre de sesión único para Mercadinámica
session_name('MERCADINAMICA_SESSION');

// Iniciar sesión si no está iniciada
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ========================================
// CLASE PRINCIPAL
// ========================================

class MercadinamicaAuth {
    private $loginUrl = 'https://www.mercadinamica.es/v2/Menu-MD/#/login';
    private $pdo = null;

    /**
     * Constructor - Inicializa la conexión a la base de datos
     */
    public function __construct() {
        $this->initDatabase();
    }

    /**
     * Inicializa la conexión a la base de datos
     */
    private function initDatabase() {
        try {
            $isLocal = strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || 
                       strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false;

            if ($isLocal) {
                // Configuración para XAMPP local
                $host = 'localhost';
                $dbname = 'MENU_MD';
                $username = 'root';
                $password = '';
            } else {
                // Configuración para producción (IP del servidor MySQL)
                $host = '10.0.0.7';
                $dbname = 'MENU_MD';
                $username = 'usama';
                $password = 'Usama.md.2015';
            }

            $this->pdo = new PDO(
                "mysql:host=$host;dbname=$dbname;charset=utf8", 
                $username, 
                $password
            );
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch(PDOException $e) {
            error_log("Error de conexión DB en auth_lib: " . $e->getMessage());
            $this->pdo = null;
        }
    }

    /**
     * Verifica si el usuario está autenticado
     * @return bool
     */
    public function isAuthenticated() {
        return isset($_SESSION['user_id']) && 
               isset($_SESSION['username']) && 
               !empty($_SESSION['user_id']);
    }

    /**
     * Requiere autenticación - Redirige al login si no está autenticado
     * Soporta SSO con tokens entre dominios
     * @param bool $exit Si debe terminar la ejecución después de redirigir
     */
    public function requireAuth($exit = true) {
        // Verificar si hay sesión activa
        if ($this->isAuthenticated()) {
            $this->logAccess('AUTH', $_SERVER['REQUEST_URI']);
            return;
        }

        // Verificar si hay token SSO en la URL
        if (isset($_GET['sso_token']) && !empty($_GET['sso_token'])) {
            if ($this->authenticateWithToken($_GET['sso_token'])) {
                // Token válido - redirigir sin el token en URL
                $cleanUrl = $this->removeTokenFromUrl();
                header('Location: ' . $cleanUrl);
                if ($exit) {
                    exit();
                }
                return;
            }
        }

        // No autenticado - registrar y redirigir al login
        $this->logAccess('NO_AUTH', $_SERVER['REQUEST_URI']);
        
        // Generar URL de retorno para volver después del login
        $returnUrl = $this->getCurrentUrl();
        $loginUrl = $this->loginUrl . '?return=' . urlencode($returnUrl);
        
        header('Location: ' . $loginUrl);
        if ($exit) {
            exit();
        }
    }

    /**
     * Autentica usando un token SSO
     */
    private function authenticateWithToken($token) {
        require_once(__DIR__ . '/sso_token_manager.php');
        $tokenManager = new SSOTokenManager();
        
        $userData = $tokenManager->validateToken($token);
        
        if ($userData) {
            // Crear sesión con los datos del usuario
            $_SESSION['user_id'] = $userData['user_id'];
            $_SESSION['username'] = $userData['username'];
            $_SESSION['nombre'] = $userData['nombre'];
            
            $this->logAccess('SSO_TOKEN', $_SERVER['REQUEST_URI']);
            return true;
        }
        
        return false;
    }

    /**
     * Obtiene URL actual
     */
    private function getCurrentUrl() {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'];
        $uri = $_SERVER['REQUEST_URI'];
        return $protocol . '://' . $host . $uri;
    }

    /**
     * Remueve el token SSO de la URL
     */
    private function removeTokenFromUrl() {
        $url = $this->getCurrentUrl();
        $url = preg_replace('/[?&]sso_token=[^&]*/', '', $url);
        $url = rtrim($url, '?&');
        return $url;
    }

    /**
     * Obtiene el ID del usuario
     * @return int|null
     */
    public function getUserId() {
        return $_SESSION['user_id'] ?? null;
    }

    /**
     * Obtiene el username del usuario
     * @return string|null
     */
    public function getUsername() {
        return $_SESSION['username'] ?? null;
    }

    /**
     * Obtiene el nombre completo del usuario
     * @return string|null
     */
    public function getFullName() {
        return $_SESSION['nombre'] ?? $_SESSION['username'] ?? null;
    }

    /**
     * Obtiene todos los datos del usuario
     * @return array
     */
    public function getUser() {
        if (!$this->isAuthenticated()) {
            return null;
        }

        return [
            'id' => $this->getUserId(),
            'username' => $this->getUsername(),
            'nombre' => $this->getFullName()
        ];
    }

    /**
     * Obtiene la URL del login
     * @return string
     */
    public function getLoginUrl() {
        return $this->loginUrl;
    }

    /**
     * Obtiene la URL del logout
     * @return string
     */
    public function getLogoutUrl() {
        return 'https://www.mercadinamica.es/v2/Menu-MD/php/logout.php';
    }

    /**
     * Registra un acceso en la base de datos
     * @param string $tipo Tipo de acceso (AUTH, NO_AUTH, etc.)
     * @param string $url URL accedida
     */
    private function logAccess($tipo, $url) {
        if (!$this->pdo) {
            return;
        }

        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO logs_acceso 
                (user_id, username, tipo_acceso, url_accedida, ip_address, user_agent, fecha_hora) 
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            ");

            $stmt->execute([
                $this->getUserId(),
                $this->getUsername(),
                $tipo,
                $url,
                $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
            ]);
        } catch(PDOException $e) {
            error_log("Error al registrar acceso: " . $e->getMessage());
        }
    }

    /**
     * Genera HTML con información del usuario y botón de logout
     * @return string HTML
     */
    public function getUserInfoHTML() {
        if (!$this->isAuthenticated()) {
            return '<a href="' . $this->loginUrl . '" class="login-btn">Iniciar Sesión</a>';
        }

        $nombre = htmlspecialchars($this->getFullName());
        $username = htmlspecialchars($this->getUsername());
        $logoutUrl = $this->getLogoutUrl();

        return '
        <div class="user-info-auth">
            <style>
                .user-info-auth {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 10px 15px;
                    background: #f5f5f5;
                    border-radius: 8px;
                }
                .user-info-auth .user-icon {
                    font-size: 24px;
                }
                .user-info-auth .user-name {
                    font-weight: 600;
                    color: #333;
                }
                .user-info-auth .logout-btn {
                    padding: 8px 16px;
                    background: #d32f2f;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    text-decoration: none;
                    font-size: 14px;
                }
                .user-info-auth .logout-btn:hover {
                    background: #b71c1c;
                }
            </style>
            <span class="user-icon">👤</span>
            <span class="user-name">' . $nombre . '</span>
            <a href="' . $logoutUrl . '" class="logout-btn">Cerrar Sesión</a>
        </div>';
    }
}

// ========================================
// FUNCIONES HELPER (Funciones de atajo)
// ========================================

/**
 * Instancia global de autenticación
 */
$_MERCADINAMICA_AUTH = new MercadinamicaAuth();

/**
 * Verifica si el usuario está autenticado
 * @return bool
 */
function auth_check() {
    global $_MERCADINAMICA_AUTH;
    return $_MERCADINAMICA_AUTH->isAuthenticated();
}

/**
 * Requiere autenticación - Redirige si no está autenticado
 */
function auth_require() {
    global $_MERCADINAMICA_AUTH;
    $_MERCADINAMICA_AUTH->requireAuth();
}

/**
 * Obtiene el ID del usuario
 * @return int|null
 */
function auth_id() {
    global $_MERCADINAMICA_AUTH;
    return $_MERCADINAMICA_AUTH->getUserId();
}

/**
 * Obtiene el username del usuario
 * @return string|null
 */
function auth_username() {
    global $_MERCADINAMICA_AUTH;
    return $_MERCADINAMICA_AUTH->getUsername();
}

/**
 * Obtiene el nombre completo del usuario
 * @return string|null
 */
function auth_name() {
    global $_MERCADINAMICA_AUTH;
    return $_MERCADINAMICA_AUTH->getFullName();
}

/**
 * Obtiene todos los datos del usuario
 * @return array|null
 */
function auth_user() {
    global $_MERCADINAMICA_AUTH;
    return $_MERCADINAMICA_AUTH->getUser();
}

/**
 * Obtiene HTML con información del usuario y botón de logout
 * @return string
 */
function auth_user_info() {
    global $_MERCADINAMICA_AUTH;
    return $_MERCADINAMICA_AUTH->getUserInfoHTML();
}

/**
 * Obtiene la URL del login
 * @return string
 */
function auth_login_url() {
    global $_MERCADINAMICA_AUTH;
    return $_MERCADINAMICA_AUTH->getLoginUrl();
}

/**
 * Obtiene la URL del logout
 * @return string
 */
function auth_logout_url() {
    global $_MERCADINAMICA_AUTH;
    return $_MERCADINAMICA_AUTH->getLogoutUrl();
}

/**
 * Valida un token SSO y retorna los datos del usuario
 * @param string $token Token SSO a validar
 * @return array|false Datos del usuario si el token es válido, false en caso contrario
 */
function validateSSOToken($token) {
    require_once(__DIR__ . '/sso_token_manager.php');
    
    $tokenManager = new SSOTokenManager();
    return $tokenManager->validateToken($token);
}

// ========================================
// FIN DE LA LIBRERÍA
// ========================================
