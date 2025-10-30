<?php
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
    // Configuración para XAMPP local
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
} catch(PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => 'Error de conexión a la base de datos'
    ]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $inputUsername = trim($_POST['username'] ?? '');
    $inputPassword = trim($_POST['password'] ?? '');
    
    if (empty($inputUsername) || empty($inputPassword)) {
        echo json_encode([
            'success' => false, 
            'message' => 'Usuario y contraseña son requeridos'
        ]);
        exit();
    }
    
    try {
        // Buscar usuario en la base de datos (comparación directa de contraseña)
        $stmt = $pdo->prepare("SELECT id, username, nombre, password FROM usuarios WHERE username = :username AND activo = 1");
        $stmt->bindParam(':username', $inputUsername);
        $stmt->execute();
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user && $user['password'] === $inputPassword) {
            // Login exitoso
            echo json_encode([
                'success' => true,
                'message' => 'Login exitoso',
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'nombre' => $user['nombre']
                ]
            ]);
        } else {
            echo json_encode([
                'success' => false, 
                'message' => 'Usuario o contraseña incorrectos'
            ]);
        }
        
    } catch(PDOException $e) {
        echo json_encode([
            'success' => false, 
            'message' => 'Error en la consulta'
        ]);
    }
    
} else {
    echo json_encode([
        'success' => false, 
        'message' => 'Método no permitido'
    ]);
}
?>
