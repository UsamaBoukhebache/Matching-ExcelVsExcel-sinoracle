<?php
class SSOTokenManager {
    private $pdo = null;
    
    private $dbError = null;
    private $lastError = null;
    
    public function __construct() {
        try {
            // Usar la MISMA configuración que el menú
            $isLocal = strpos($_SERVER['HTTP_HOST'], 'localhost') !== false;
            
            if ($isLocal) {
                $host = 'localhost';
                $dbname = 'MENU_MD';
                $username = 'root';
                $password = '';
            } else {
                $host = '10.0.0.7'; // MISMO HOST QUE EL MENÚ
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
            $this->dbError = $e->getMessage();
            error_log("Error DB: " . $e->getMessage());
            $this->pdo = null;
        }
    }
    
    public function getDbError() {
        return $this->dbError;
    }
    
    public function getLastError() {
        return $this->lastError;
    }

    
    public function validateTokenWithDebug($token) {
        $debug = [];
        
        if (!$this->pdo) {
            $debug[] = "ERROR: No hay conexión PDO";
            if ($this->dbError) {
                $debug[] = "Error MySQL: " . $this->dbError;
            }
            return ['data' => null, 'debug' => $debug];
        }
        
        if (empty($token)) {
            $debug[] = "ERROR: Token vacío";
            return ['data' => null, 'debug' => $debug];
        }
        
        $debug[] = "Token recibido: " . substr($token, 0, 20) . "...";
        
        try {
            $stmt = $this->pdo->prepare("
                SELECT user_id, username, nombre, expires_at, used
                FROM sso_tokens
                WHERE token = ?
            ");
            $stmt->execute([$token]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$result) {
                $debug[] = "ERROR: Token NO encontrado en base de datos";
                return ['data' => null, 'debug' => $debug];
            }
            
            $debug[] = "Token encontrado en BD";
            
            $now = date('Y-m-d H:i:s');
            $debug[] = "Fecha actual: $now";
            $debug[] = "Token expira: " . $result['expires_at'];
            $debug[] = "Token usado: " . ($result['used'] ? 'Sí' : 'No');
            
            // Verificar expiración
            if ($result['expires_at'] <= $now) {
                $debug[] = "ERROR: Token EXPIRADO";
                return ['data' => null, 'debug' => $debug];
            }
            
            // Verificar si ya se usó
            if ($result['used'] == 1) {
                $debug[] = "ERROR: Token YA USADO";
                return ['data' => null, 'debug' => $debug];
            }
            
            // Marcar como usado
            $this->pdo->prepare("UPDATE sso_tokens SET used=1, used_at=NOW() WHERE token=?")->execute([$token]);
            $debug[] = "✅ Token válido para usuario: " . $result['username'];
            
            return [
                'data' => [
                    'user_id' => $result['user_id'],
                    'username' => $result['username'],
                    'nombre' => $result['nombre']
                ],
                'debug' => $debug
            ];
            
        } catch(PDOException $e) {
            $debug[] = "ERROR PDO: " . $e->getMessage();
            return ['data' => null, 'debug' => $debug];
        }
    }
    
    public function validateToken($token) {
        $this->lastError = null;
        
        if (!$this->pdo) {
            $this->lastError = "No hay conexión a base de datos: " . $this->dbError;
            return null;
        }
        
        if (empty($token)) {
            $this->lastError = "Token vacío";
            return null;
        }
        
        try {
            // Buscar el token (permitir used=0 o used=1 si es reciente)
            $stmt = $this->pdo->prepare("
                SELECT user_id, username, nombre, expires_at, used, used_at
                FROM sso_tokens
                WHERE token = ?
            ");
            $stmt->execute([$token]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$result) {
                $this->lastError = "Token no encontrado en base de datos";
                return null;
            }
            
            // Verificar expiración
            $now = date('Y-m-d H:i:s');
            if ($result['expires_at'] <= $now) {
                $this->lastError = "Token expirado. Expiró: " . $result['expires_at'] . ", Ahora: " . $now;
                return null;
            }
            
            // PERMITIR reutilizar tokens mientras no expiren
            // Los tokens se pueden usar múltiples veces hasta que expiren
            // Esto permite F5, navegar entre páginas, etc.
            
            // Actualizar used_at cada vez que se usa (para tracking)
            $this->pdo->prepare("UPDATE sso_tokens SET used=1, used_at=NOW() WHERE token=?")->execute([$token]);
            
            return [
                'user_id' => $result['user_id'],
                'username' => $result['username'],
                'nombre' => $result['nombre']
            ];
            
        } catch(PDOException $e) {
            $this->lastError = "Error PDO: " . $e->getMessage();
            error_log("Error validando token: " . $e->getMessage());
            return null;
        }
    }
}
?>
