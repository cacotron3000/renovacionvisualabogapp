<?php
// =============================================================================
// Conexión PDO a MySQL — singleton por request.
// =============================================================================

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $cfgPath = __DIR__ . '/config.php';
    if (!file_exists($cfgPath)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => 'Servidor no configurado',
            'detalle' => 'Falta api/config.php (copie config.example.php y edítelo).'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $cfg = require $cfgPath;
    $db  = $cfg['db'];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'], (int)$db['port'], $db['name'], $db['charset']
    );

    try {
        $pdo = new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        $msg = ['error' => 'Error de conexión a la base de datos'];
        if (!empty($cfg['debug'])) $msg['detalle'] = $e->getMessage();
        echo json_encode($msg, JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $pdo;
}

function config(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $cfgPath = __DIR__ . '/config.php';
    $cfg = file_exists($cfgPath) ? require $cfgPath : [];
    return $cfg;
}
