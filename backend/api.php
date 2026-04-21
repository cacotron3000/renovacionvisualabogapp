<?php
header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Falta backend/config.php. Copia config.sample.php y completa credenciales.']);
    exit;
}

$config = require $configPath;
if (!is_array($config)) {
    http_response_code(500);
    echo json_encode(['error' => 'config.php inválido.']);
    exit;
}

date_default_timezone_set($config['timezone'] ?? 'UTC');

function jsonInput(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function apiFail(string $message, int $status = 400): void {
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

function requireApiKey(array $config): void {
    $expected = $config['api_key'] ?? '';
    $provided = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if (!$expected || !$provided || !hash_equals($expected, $provided)) {
        apiFail('API key inválida.', 401);
    }
}

try {
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        $config['db_host'] ?? 'localhost',
        $config['db_name'] ?? ''
    );
    $pdo = new PDO($dsn, $config['db_user'] ?? '', $config['db_pass'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Throwable $e) {
    apiFail('No fue posible conectar a MySQL: ' . $e->getMessage(), 500);
}

requireApiKey($config);

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$payload = jsonInput();

function isValidTableName(string $table): bool {
    return (bool) preg_match('/^[a-zA-Z0-9_]{1,100}$/', $table);
}

function getActor(): string {
    return trim((string) ($_SERVER['HTTP_X_ACTOR'] ?? 'sistema'));
}

function logAudit(PDO $pdo, string $action, ?string $table = null, ?int $appId = null, ?array $details = null): void {
    try {
        $stmt = $pdo->prepare('INSERT INTO abogapp_audit (action, table_name, app_id, actor, details) VALUES (:action, :table_name, :app_id, :actor, :details)');
        $stmt->execute([
            'action' => $action,
            'table_name' => $table,
            'app_id' => $appId,
            'actor' => getActor(),
            'details' => $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
        ]);
    } catch (Throwable $e) {
        // No bloquear flujo principal por auditoría
    }
}

function fetchTable(PDO $pdo, string $table, ?string $since = null, int $limit = 2000, int $offset = 0): array {
    if (!isValidTableName($table)) {
        apiFail('Nombre de tabla inválido.');
    }
    $limit = max(1, min(5000, $limit));
    $offset = max(0, $offset);
    if ($since) {
        $stmt = $pdo->prepare('SELECT payload FROM abogapp_records WHERE table_name = :table AND updated_at > :since ORDER BY app_id ASC LIMIT :lim OFFSET :off');
        $stmt->bindValue(':table', $table);
        $stmt->bindValue(':since', $since);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
    } else {
        $stmt = $pdo->prepare('SELECT payload FROM abogapp_records WHERE table_name = :table ORDER BY app_id ASC LIMIT :lim OFFSET :off');
        $stmt->bindValue(':table', $table);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
    }
    $rows = $stmt->fetchAll();
    $result = [];
    foreach ($rows as $row) {
        $data = json_decode($row['payload'] ?? 'null', true);
        if (is_array($data)) {
            $result[] = $data;
        }
    }
    return $result;
}

function upsertRecords(PDO $pdo, string $table, array $records): array {
    if (!isValidTableName($table)) {
        apiFail('Nombre de tabla inválido.');
    }

    $sql = 'INSERT INTO abogapp_records (table_name, app_id, payload)
            VALUES (:table_name, :app_id, :payload)
            ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP';
    $stmt = $pdo->prepare($sql);

    $saved = 0;
    foreach ($records as $record) {
        if (!is_array($record)) continue;
        $appId = $record['id'] ?? null;
        if ($appId === null || $appId === '') continue;
        $stmt->execute([
            'table_name' => $table,
            'app_id' => (int) $appId,
            'payload' => json_encode($record, JSON_UNESCAPED_UNICODE),
        ]);
        logAudit($pdo, 'upsert', $table, (int) $appId, ['keys' => array_keys($record)]);
        $saved++;
    }

    return ['ok' => true, 'saved' => $saved];
}

function nextSequenceValue(PDO $pdo, string $name, int $min = 1): int {
    if (!isValidTableName($name)) {
        apiFail('Nombre de secuencia inválido.');
    }
    $min = max(1, $min);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO abogapp_sequences (name, current_value) VALUES (:name, :seed)
            ON DUPLICATE KEY UPDATE current_value = LAST_INSERT_ID(GREATEST(current_value + 1, :min_value))');
        $stmt->execute([
            'name' => $name,
            'seed' => $min,
            'min_value' => $min,
        ]);
        $next = (int) $pdo->query('SELECT LAST_INSERT_ID()')->fetchColumn();
        if ($next <= 0) {
            $q = $pdo->prepare('SELECT current_value FROM abogapp_sequences WHERE name = :name LIMIT 1');
            $q->execute(['name' => $name]);
            $next = (int) $q->fetchColumn();
        }
        if ($next < $min) $next = $min;
        $pdo->commit();
        logAudit($pdo, 'sequence_next', 'abogapp_sequences', null, ['name' => $name, 'value' => $next]);
        return $next;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        apiFail('No fue posible obtener correlativo.', 500);
    }
}

switch ($action) {
    case 'pull_table': {
        $table = $_GET['table'] ?? '';
        $since = $_GET['since'] ?? null;
        $limit = (int) ($_GET['limit'] ?? 2000);
        $offset = (int) ($_GET['offset'] ?? 0);
        echo json_encode(['data' => fetchTable($pdo, $table, $since, $limit, $offset)]);
        break;
    }

    case 'pull_all': {
        $tables = $_GET['tables'] ?? '';
        $since = $_GET['since'] ?? null;
        $limit = (int) ($_GET['limit'] ?? 2000);
        $offset = (int) ($_GET['offset'] ?? 0);
        $list = array_filter(array_map('trim', explode(',', $tables)));
        $data = [];
        foreach ($list as $table) {
            if (!isValidTableName($table)) continue;
            $data[$table] = fetchTable($pdo, $table, $since, $limit, $offset);
        }
        echo json_encode(['data' => $data]);
        break;
    }

    case 'upsert': {
        $table = $payload['table'] ?? '';
        $records = $payload['records'] ?? [];
        if (!is_array($records)) {
            $records = [$records];
        }
        echo json_encode(upsertRecords($pdo, $table, $records));
        break;
    }

    case 'delete': {
        $table = $payload['table'] ?? '';
        $appId = $payload['id'] ?? null;
        if (!isValidTableName($table) || $appId === null) {
            apiFail('Parámetros inválidos.');
        }
        $stmt = $pdo->prepare('DELETE FROM abogapp_records WHERE table_name = :table AND app_id = :app_id');
        $stmt->execute(['table' => $table, 'app_id' => (int) $appId]);
        logAudit($pdo, 'delete', $table, (int) $appId, null);
        echo json_encode(['ok' => true]);
        break;
    }

    case 'login': {
        $email = trim((string) ($payload['email'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        if (!$email || !$password) {
            apiFail('Credenciales incompletas.', 422);
        }
        $stmt = $pdo->prepare('SELECT * FROM abogapp_users WHERE email = :email AND active = 1 LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            apiFail('Credenciales incorrectas.', 401);
        }
        echo json_encode([
            'data' => [
                'user' => [
                    'id' => (string) $user['id'],
                    'email' => $user['email'],
                    'user_metadata' => ['nombre' => $user['nombre']],
                    'is_admin' => (bool) $user['is_admin'],
                    'role' => $user['role'] ?? ((int) $user['is_admin'] === 1 ? 'admin' : 'abogado'),
                ],
                'session' => ['access_token' => bin2hex(random_bytes(24))],
            ],
        ]);
        break;
    }

    case 'users_list': {
        $stmt = $pdo->query('SELECT id, email, nombre, is_admin, active FROM abogapp_users ORDER BY id ASC');
        $users = [];
        foreach ($stmt->fetchAll() as $u) {
            $users[] = [
                'id' => (string) $u['id'],
                'email' => $u['email'],
                'user_metadata' => ['nombre' => $u['nombre']],
                'is_admin' => (bool) $u['is_admin'],
                'active' => (bool) $u['active'],
                'role' => $u['role'] ?? ((int) $u['is_admin'] === 1 ? 'admin' : 'abogado'),
            ];
        }
        echo json_encode(['data' => ['users' => $users]]);
        break;
    }

    case 'users_get': {
        $id = (int) ($payload['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT id, email, nombre, is_admin, active FROM abogapp_users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $u = $stmt->fetch();
        if (!$u) apiFail('Usuario no encontrado.', 404);
        echo json_encode(['data' => ['user' => [
            'id' => (string) $u['id'],
            'email' => $u['email'],
            'user_metadata' => ['nombre' => $u['nombre']],
            'is_admin' => (bool) $u['is_admin'],
            'active' => (bool) $u['active'],
            'role' => $u['role'] ?? ((int) $u['is_admin'] === 1 ? 'admin' : 'abogado'),
        ]]]);
        break;
    }

    case 'next_quote_number': {
        $min = (int) ($payload['min'] ?? 290);
        $next = nextSequenceValue($pdo, 'cotizaciones', $min);
        echo json_encode(['data' => ['numero' => $next]]);
        break;
    }

    case 'users_create': {
        $email = trim((string) ($payload['email'] ?? ''));
        $pass = (string) ($payload['password'] ?? '');
        $nombre = trim((string) ($payload['nombre'] ?? ''));
        if (!$email || !$pass || !$nombre) {
            apiFail('Faltan campos para crear usuario.', 422);
        }
        $stmt = $pdo->prepare('INSERT INTO abogapp_users (email, nombre, role, password_hash, is_admin) VALUES (:email, :nombre, :role, :hash, :is_admin)');
        $stmt->execute([
            'email' => $email,
            'nombre' => $nombre,
            'role' => trim((string) ($payload['role'] ?? (!empty($payload['is_admin']) ? 'admin' : 'abogado'))),
            'hash' => password_hash($pass, PASSWORD_DEFAULT),
            'is_admin' => !empty($payload['is_admin']) ? 1 : 0,
        ]);
        logAudit($pdo, 'users_create', 'abogapp_users', (int) $pdo->lastInsertId(), ['email' => $email]);
        echo json_encode(['data' => ['id' => (string) $pdo->lastInsertId()]]);
        break;
    }

    case 'users_update': {
        $id = (int) ($payload['id'] ?? 0);
        if ($id <= 0) apiFail('ID inválido.');

        $fields = [];
        $params = ['id' => $id];

        if (array_key_exists('email', $payload)) {
            $fields[] = 'email = :email';
            $params['email'] = trim((string) $payload['email']);
        }
        if (array_key_exists('nombre', $payload)) {
            $fields[] = 'nombre = :nombre';
            $params['nombre'] = trim((string) $payload['nombre']);
        }
        if (!empty($payload['password'])) {
            $fields[] = 'password_hash = :hash';
            $params['hash'] = password_hash((string) $payload['password'], PASSWORD_DEFAULT);
        }
        if (array_key_exists('is_admin', $payload)) {
            $fields[] = 'is_admin = :is_admin';
            $params['is_admin'] = !empty($payload['is_admin']) ? 1 : 0;
        }
        if (array_key_exists('role', $payload)) {
            $fields[] = 'role = :role';
            $params['role'] = trim((string) $payload['role']);
        }
        if (array_key_exists('active', $payload)) {
            $fields[] = 'active = :active';
            $params['active'] = !empty($payload['active']) ? 1 : 0;
        }

        if (!$fields) apiFail('No hay campos para actualizar.');

        $sql = 'UPDATE abogapp_users SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        logAudit($pdo, 'users_update', 'abogapp_users', $id, ['fields' => $fields]);
        echo json_encode(['ok' => true]);
        break;
    }

    case 'users_delete': {
        $id = (int) ($payload['id'] ?? 0);
        if ($id <= 0) apiFail('ID inválido.');
        $stmt = $pdo->prepare('DELETE FROM abogapp_users WHERE id = :id');
        $stmt->execute(['id' => $id]);
        logAudit($pdo, 'users_delete', 'abogapp_users', $id, null);
        echo json_encode(['ok' => true]);
        break;
    }

    case 'audit_recent': {
        $limit = max(1, min(200, (int) ($_GET['limit'] ?? 50)));
        $table = trim((string) ($_GET['table'] ?? ''));
        $actor = trim((string) ($_GET['actor'] ?? ''));
        $from = trim((string) ($_GET['from'] ?? ''));
        $to = trim((string) ($_GET['to'] ?? ''));
        $where = [];
        $params = [];
        if ($table !== '') { $where[] = 'table_name = :table_name'; $params['table_name'] = $table; }
        if ($actor !== '') { $where[] = 'actor = :actor'; $params['actor'] = $actor; }
        if ($from !== '') { $where[] = 'created_at >= :from'; $params['from'] = $from; }
        if ($to !== '') { $where[] = 'created_at <= :to'; $params['to'] = $to; }
        $sql = 'SELECT id, action, table_name, app_id, actor, details, created_at FROM abogapp_audit';
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY id DESC LIMIT :lim';
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue(':' . $k, $v);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        echo json_encode(['data' => $stmt->fetchAll()]);
        break;
    }

    default:
        apiFail('Acción no soportada.', 404);
}
