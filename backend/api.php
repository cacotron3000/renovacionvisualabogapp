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

function base64UrlEncode(string $input): string {
    return rtrim(strtr(base64_encode($input), '+/', '-_'), '=');
}

function googleServiceAccountToken(array $config, string $scope = 'https://www.googleapis.com/auth/calendar.readonly'): string {
    $path = $config['google_service_account_json_path'] ?? '';
    if (!$path || !file_exists($path)) {
        apiFail('No existe google_service_account_json_path en config.php', 500);
    }
    $sa = json_decode((string) file_get_contents($path), true);
    if (!is_array($sa) || empty($sa['client_email']) || empty($sa['private_key'])) {
        apiFail('Credenciales de Service Account inválidas.', 500);
    }

    $now = time();
    $header = ['alg' => 'RS256', 'typ' => 'JWT'];
    $claims = [
        'iss' => $sa['client_email'],
        'scope' => $scope,
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now,
    ];
    $jwtUnsigned = base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES)) . '.' .
        base64UrlEncode(json_encode($claims, JSON_UNESCAPED_SLASHES));
    $signature = '';
    if (!openssl_sign($jwtUnsigned, $signature, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
        apiFail('No fue posible firmar JWT de Google.', 500);
    }
    $jwt = $jwtUnsigned . '.' . base64UrlEncode($signature);

    $payload = http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt,
    ]);
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 20,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($resp === false) {
        apiFail('Error OAuth Google: ' . curl_error($ch), 500);
    }
    curl_close($ch);
    $json = json_decode($resp, true);
    if ($code >= 400 || empty($json['access_token'])) {
        apiFail('No se obtuvo access token de Google.', 500);
    }
    return (string) $json['access_token'];
}

function googleApiGet(string $url, string $token): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Accept: application/json'],
        CURLOPT_TIMEOUT => 25,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($resp === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Error consultando Google Calendar: ' . $err);
    }
    curl_close($ch);
    $json = json_decode($resp, true);
    if ($code >= 400) {
        $message = is_array($json) ? json_encode($json, JSON_UNESCAPED_UNICODE) : ('HTTP ' . $code);
        throw new RuntimeException('Google Calendar API error: ' . $message, $code);
    }
    return is_array($json) ? $json : [];
}

function googleApiRequest(string $method, string $url, string $token, ?array $body = null): array {
    $ch = curl_init($url);
    $headers = ['Authorization: Bearer ' . $token, 'Accept: application/json'];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 25,
    ];
    if ($body !== null) {
        $payload = json_encode($body, JSON_UNESCAPED_UNICODE);
        $headers[] = 'Content-Type: application/json';
        $opts[CURLOPT_POSTFIELDS] = $payload;
        $opts[CURLOPT_HTTPHEADER] = $headers;
    }
    curl_setopt_array($ch, $opts);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($resp === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Error consultando Google Calendar: ' . $err);
    }
    curl_close($ch);
    $json = json_decode($resp, true);
    if ($code >= 400) {
        $message = is_array($json) ? json_encode($json, JSON_UNESCAPED_UNICODE) : ('HTTP ' . $code);
        throw new RuntimeException('Google Calendar API error: ' . $message, $code);
    }
    return is_array($json) ? $json : [];
}

function gcalAppId(string $googleEventId): int {
    $hex = substr(md5('gcal:' . $googleEventId), 0, 12);
    return (int) base_convert($hex, 16, 10);
}

function textoNormalizado(string $txt): string {
    $txt = mb_strtolower(trim($txt), 'UTF-8');
    $txt = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $txt) ?: $txt;
    return strtolower($txt);
}

function gcalMatchesKeywords(array $event, array $keywords): bool {
    $pool = trim(
        ($event['summary'] ?? '') . ' ' .
        ($event['description'] ?? '') . ' ' .
        ($event['location'] ?? '')
    );
    $poolNorm = textoNormalizado($pool);
    if (!$poolNorm) return false;
    foreach ($keywords as $kw) {
        $kwNorm = textoNormalizado((string) $kw);
        if ($kwNorm !== '' && strpos($poolNorm, $kwNorm) !== false) {
            return true;
        }
    }
    return false;
}

function gcalEventToAudiencia(array $event): array {
    $start = $event['start'] ?? [];
    $startRaw = (string) ($start['dateTime'] ?? $start['date'] ?? '');
    $dt = null;
    if ($startRaw !== '') {
        try { $dt = new DateTime($startRaw); } catch (Throwable $e) { $dt = null; }
    }
    $fecha = $dt ? $dt->format('Y-m-d') : date('Y-m-d');
    $hora = $dt ? $dt->format('H:i') : '09:00';
    $titulo = trim((string) ($event['summary'] ?? 'Evento de calendario'));
    $texto = textoNormalizado(
        $titulo . ' ' . (string) ($event['description'] ?? '') . ' ' . (string) ($event['location'] ?? '')
    );
    $tipo = 'audiencia';
    foreach (['preparatoria', 'monitorio', 'alegato', 'juicio'] as $kw) {
        if (strpos($texto, $kw) !== false) { $tipo = $kw; break; }
    }
    $modalidad = 'presencial';
    if (strpos($texto, 'presencial') !== false) {
        $modalidad = 'presencial';
    } elseif (
        strpos($texto, 'zoom') !== false ||
        strpos($texto, 'telematico') !== false ||
        strpos($texto, 'telematica') !== false
    ) {
        $modalidad = 'telematica';
    }
    return [
        'id' => gcalAppId((string) $event['id']),
        'titulo' => $titulo,
        'tipo' => $tipo,
        'modalidad' => $modalidad,
        'urgencia' => 'media',
        'fecha' => $fecha,
        'hora' => $hora,
        'notas' => trim((string) ($event['description'] ?? '')),
        'fuente' => 'google_calendar',
        'googleEventId' => (string) ($event['id'] ?? ''),
        'googleCalendarId' => (string) ($event['organizer']['email'] ?? ''),
        'googleHtmlLink' => (string) ($event['htmlLink'] ?? ''),
    ];
}

function audienciaToGoogleEvent(array $audiencia, string $timezone): array {
    $titulo = trim((string) ($audiencia['titulo'] ?? 'Audiencia'));
    $fecha = trim((string) ($audiencia['fecha'] ?? date('Y-m-d')));
    $hora = trim((string) ($audiencia['hora'] ?? '09:00'));
    $inicio = "{$fecha}T{$hora}:00";
    try {
        $start = new DateTime($inicio, new DateTimeZone($timezone));
    } catch (Throwable $e) {
        $start = new DateTime('now', new DateTimeZone($timezone));
    }
    $end = clone $start;
    $end->modify('+1 hour');
    $notas = trim((string) ($audiencia['notas'] ?? ''));
    $description = trim(
        "Sincronizado desde Abogapp\n" .
        "Tipo: " . ((string) ($audiencia['tipo'] ?? 'audiencia')) . "\n" .
        "Modalidad: " . ((string) ($audiencia['modalidad'] ?? 'presencial')) . "\n" .
        ($notas ? ("Notas: " . $notas) : '')
    );
    return [
        'summary' => $titulo,
        'description' => $description,
        'start' => [
            'dateTime' => $start->format(DateTime::RFC3339),
            'timeZone' => $timezone,
        ],
        'end' => [
            'dateTime' => $end->format(DateTime::RFC3339),
            'timeZone' => $timezone,
        ],
    ];
}

function gcalEventStartDateYmd(array $event): ?string {
    $start = $event['start'] ?? [];
    $startRaw = (string) ($start['dateTime'] ?? $start['date'] ?? '');
    if ($startRaw === '') return null;
    try {
        $dt = new DateTime($startRaw);
        return $dt->format('Y-m-d');
    } catch (Throwable $e) {
        return null;
    }
}

function getGoogleSyncToken(PDO $pdo, string $calendarId): ?string {
    $stmt = $pdo->prepare('SELECT payload FROM abogapp_records WHERE table_name = :table AND app_id = :id LIMIT 1');
    $stmt->execute(['table' => 'google_calendar_meta', 'id' => gcalAppId('meta:' . $calendarId)]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $data = json_decode($row['payload'] ?? 'null', true);
    return is_array($data) ? ($data['syncToken'] ?? null) : null;
}

function saveGoogleSyncToken(PDO $pdo, string $calendarId, string $syncToken): void {
    upsertRecords($pdo, 'google_calendar_meta', [[
        'id' => gcalAppId('meta:' . $calendarId),
        'calendarId' => $calendarId,
        'syncToken' => $syncToken,
        'updatedAt' => date('c'),
    ]]);
}

function hashAppId(string $raw): int {
    $hex = substr(md5($raw), 0, 12);
    return (int) base_convert($hex, 16, 10);
}

function normalizarFechaYmd(?string $raw): ?string {
    $value = trim((string) $raw);
    if ($value === '') return null;
    try {
        $dt = new DateTime($value);
        return $dt->format('Y-m-d');
    } catch (Throwable $e) {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return $value;
        return null;
    }
}

function enviarCorreoSimple(array $config, string $to, string $subject, string $message, bool $isHtml = false): bool {
    $from = trim((string) ($config['mail_from'] ?? ''));
    $fromName = trim((string) ($config['mail_from_name'] ?? 'Abogapp'));
    if ($from === '') return false;
    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-type: ' . ($isHtml ? 'text/html' : 'text/plain') . '; charset=UTF-8';
    $headers[] = 'From: ' . $fromName . ' <' . $from . '>';
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $message, implode("\r\n", $headers));
}

function obtenerMapaUsuarios(PDO $pdo): array {
    $stmt = $pdo->query('SELECT email, nombre FROM abogapp_users WHERE active = 1');
    $map = [];
    foreach ($stmt->fetchAll() as $u) {
        $email = trim((string) ($u['email'] ?? ''));
        if ($email === '') continue;
        $nombre = trim((string) ($u['nombre'] ?? ''));
        if ($nombre !== '') $map[mb_strtolower($nombre, 'UTF-8')] = $email;
        $map[mb_strtolower($email, 'UTF-8')] = $email;
    }
    return $map;
}

function resolverEmailsAsignados(PDO $pdo, array $asignados): array {
    $map = obtenerMapaUsuarios($pdo);
    $emails = [];
    foreach ($asignados as $a) {
        $k = mb_strtolower(trim((string) $a), 'UTF-8');
        if ($k === '') continue;
        if (isset($map[$k])) $emails[] = $map[$k];
    }
    return array_values(array_unique($emails));
}

function obtenerDestinatariosAsignados(PDO $pdo, array $asignados): array {
    $stmt = $pdo->query('SELECT email, nombre FROM abogapp_users WHERE active = 1');
    $mapByNombre = [];
    $mapByEmail = [];
    foreach ($stmt->fetchAll() as $u) {
        $email = trim((string) ($u['email'] ?? ''));
        if ($email === '') continue;
        $nombre = trim((string) ($u['nombre'] ?? ''));
        if ($nombre !== '') $mapByNombre[mb_strtolower($nombre, 'UTF-8')] = ['email' => $email, 'nombre' => $nombre];
        $mapByEmail[mb_strtolower($email, 'UTF-8')] = ['email' => $email, 'nombre' => ($nombre ?: $email)];
    }
    $out = [];
    $seen = [];
    foreach ($asignados as $a) {
        $key = mb_strtolower(trim((string) $a), 'UTF-8');
        if ($key === '') continue;
        $dest = $mapByNombre[$key] ?? $mapByEmail[$key] ?? null;
        if (!$dest) continue;
        if (isset($seen[$dest['email']])) continue;
        $seen[$dest['email']] = true;
        $out[] = $dest;
    }
    return $out;
}

function formatearFechaCorreo(?string $raw): string {
    $ymd = normalizarFechaYmd($raw);
    if (!$ymd) return 'Sin fecha';
    $dt = DateTime::createFromFormat('Y-m-d', $ymd);
    return $dt ? $dt->format('d/m/Y') : $ymd;
}

function obtenerNombreClientePorId(PDO $pdo, $clienteId): ?string {
    if ($clienteId === null || $clienteId === '') return null;
    $id = (int) $clienteId;
    if ($id <= 0) return null;
    $stmt = $pdo->prepare('SELECT payload FROM abogapp_records WHERE table_name = :table AND app_id = :id LIMIT 1');
    $stmt->execute(['table' => 'clientes', 'id' => $id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $data = json_decode($row['payload'] ?? 'null', true);
    if (!is_array($data)) return null;
    $nombre = trim((string) ($data['nombre'] ?? $data['razonSocial'] ?? ''));
    return $nombre !== '' ? $nombre : null;
}

function obtenerRecordsTabla(PDO $pdo, string $table): array {
    $stmt = $pdo->prepare('SELECT payload FROM abogapp_records WHERE table_name = :table');
    $stmt->execute(['table' => $table]);
    $out = [];
    foreach ($stmt->fetchAll() as $row) {
        $data = json_decode($row['payload'] ?? 'null', true);
        if (is_array($data)) $out[] = $data;
    }
    return $out;
}

function esEstadoTerminado(array $row): bool {
    $estado = mb_strtolower(trim((string) ($row['estado'] ?? '')), 'UTF-8');
    if ($estado === '') return false;
    return strpos($estado, 'termin') !== false || strpos($estado, 'complet') !== false;
}

function estaArchivadaOEliminada(array $row): bool {
    if (!empty($row['archivadoEn']) || !empty($row['archivado_at'])) return true;
    if (!empty($row['eliminado']) || !empty($row['deleted']) || !empty($row['deleted_at'])) return true;
    return false;
}

function horaProgramadaRecordatorio(array $config): array {
    $hour = (int) ($config['task_reminders_hour'] ?? 9);
    $minute = (int) ($config['task_reminders_minute'] ?? 0);
    $hour = max(0, min(23, $hour));
    $minute = max(0, min(59, $minute));
    return [$hour, $minute];
}

function validarSecretRecordatorio(array $config, array $payload): void {
    $expected = trim((string) ($config['task_reminders_cron_secret'] ?? ''));
    if ($expected === '') return;
    $provided = trim((string) ($payload['secret'] ?? ''));
    if ($provided === '' || !hash_equals($expected, $provided)) {
        apiFail('Secret inválido para ejecutar recordatorios.', 401);
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

    case 'sync_google_calendar_audiencias': {
        $calendarId = trim((string) ($config['google_calendar_id'] ?? ''));
        if ($calendarId === '') {
            apiFail('Falta google_calendar_id en config.php', 500);
        }
        $keywords = $config['google_keywords'] ?? ['preparatoria', 'monitorio', 'alegato', 'juicio'];
        if (!is_array($keywords) || !$keywords) {
            $keywords = ['preparatoria', 'monitorio', 'alegato', 'juicio'];
        }
        $token = googleServiceAccountToken($config);
        $syncToken = getGoogleSyncToken($pdo, $calendarId);
        $todayYmd = date('Y-m-d');

        $items = [];
        $nextSyncToken = null;
        $pageToken = null;
        $modeIncremental = (bool) $syncToken;

        $fetchLoop = function (?string $syncTok) use (&$items, &$nextSyncToken, &$pageToken, $token, $calendarId) {
            $items = [];
            $nextSyncToken = null;
            $pageToken = null;
            do {
                $params = [
                    'maxResults' => 2500,
                    'singleEvents' => 'true',
                    'showDeleted' => 'true',
                ];
                if ($pageToken) $params['pageToken'] = $pageToken;
                if ($syncTok) {
                    $params['syncToken'] = $syncTok;
                } else {
                    $params['orderBy'] = 'startTime';
                    $params['timeMin'] = (new DateTime('now'))->format(DateTime::ATOM);
                }
                $url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events?' . http_build_query($params);
                $resp = googleApiGet($url, $token);
                $items = array_merge($items, $resp['items'] ?? []);
                $pageToken = $resp['nextPageToken'] ?? null;
                $nextSyncToken = $resp['nextSyncToken'] ?? $nextSyncToken;
            } while ($pageToken);
        };

        try {
            $fetchLoop($syncToken);
        } catch (Throwable $e) {
            // Si el sync token expiró (410), reintentar full sync.
            if ($modeIncremental && strpos($e->getMessage(), '"code": 410') !== false) {
                $syncToken = null;
                $modeIncremental = false;
                $fetchLoop(null);
            } else {
                apiFail('Error sincronizando Google Calendar: ' . $e->getMessage(), 500);
            }
        }

        $toUpsert = [];
        $deleted = 0;
        foreach ($items as $ev) {
            $eventId = (string) ($ev['id'] ?? '');
            if ($eventId === '') continue;
            if (($ev['status'] ?? '') === 'cancelled') {
                $stmt = $pdo->prepare('DELETE FROM abogapp_records WHERE table_name = :table AND app_id = :id');
                $stmt->execute(['table' => 'audiencias', 'id' => gcalAppId($eventId)]);
                $deleted += (int) $stmt->rowCount();
                continue;
            }
            $eventDate = gcalEventStartDateYmd($ev);
            if ($eventDate && $eventDate < $todayYmd) {
                continue;
            }
            if (!gcalMatchesKeywords($ev, $keywords)) continue;
            $toUpsert[] = gcalEventToAudiencia($ev);
        }

        $saved = 0;
        if ($toUpsert) {
            $result = upsertRecords($pdo, 'audiencias', $toUpsert);
            $saved = (int) ($result['saved'] ?? 0);
        }
        if ($nextSyncToken) {
            saveGoogleSyncToken($pdo, $calendarId, $nextSyncToken);
        }
        echo json_encode([
            'ok' => true,
            'synced_events' => count($items),
            'audiencias_upserted' => $saved,
            'audiencias_deleted' => $deleted,
            'mode' => $modeIncremental ? 'incremental' : 'full',
        ]);
        break;
    }

    case 'upsert_google_event_from_audiencia': {
        $calendarId = trim((string) ($config['google_calendar_id'] ?? ''));
        if ($calendarId === '') {
            apiFail('Falta google_calendar_id en config.php', 500);
        }
        $audiencia = $payload['audiencia'] ?? null;
        if (!is_array($audiencia)) {
            apiFail('Payload de audiencia inválido.', 422);
        }
        $eventBody = audienciaToGoogleEvent($audiencia, $config['timezone'] ?? 'America/Santiago');
        $token = googleServiceAccountToken($config, 'https://www.googleapis.com/auth/calendar');
        $eventId = trim((string) ($audiencia['googleEventId'] ?? ''));
        try {
            if ($eventId !== '') {
                $url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events/' . rawurlencode($eventId);
                $result = googleApiRequest('PATCH', $url, $token, $eventBody);
            } else {
                $url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events';
                $result = googleApiRequest('POST', $url, $token, $eventBody);
            }
        } catch (Throwable $e) {
            if ($eventId !== '' && strpos($e->getMessage(), '"code": 404') !== false) {
                $url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendarId) . '/events';
                $result = googleApiRequest('POST', $url, $token, $eventBody);
            } else {
                apiFail('No fue posible sincronizar audiencia con Google Calendar: ' . $e->getMessage(), 500);
            }
        }
        echo json_encode([
            'ok' => true,
            'data' => [
                'googleEventId' => (string) ($result['id'] ?? ''),
                'appId' => gcalAppId((string) ($result['id'] ?? '')),
                'googleHtmlLink' => (string) ($result['htmlLink'] ?? ''),
                'status' => (string) ($result['status'] ?? ''),
            ],
        ]);
        break;
    }

    case 'send_task_assignment_email': {
        $task = $payload['task'] ?? null;
        if (!is_array($task)) apiFail('Payload task inválido.', 422);
        $taskId = (string) ($task['id'] ?? '');
        $titulo = trim((string) ($task['titulo'] ?? $task['texto'] ?? 'Tarea'));
        $vence = formatearFechaCorreo((string) ($task['fechaFin'] ?? $task['fin'] ?? ''));
        $prioridad = trim((string) ($task['prioridad'] ?? 'Sin prioridad'));
        $clienteNombre = obtenerNombreClientePorId($pdo, $task['clienteId'] ?? null);
        $asignados = $task['asignadosA'] ?? ($task['asignadoA'] ?? []);
        if (!is_array($asignados)) $asignados = [$asignados];
        $destinatarios = obtenerDestinatariosAsignados($pdo, $asignados);
        $sent = 0;
        foreach ($destinatarios as $dest) {
            $email = $dest['email'];
            $nombre = trim((string) ($dest['nombre'] ?? ''));
            $saludo = $nombre !== '' ? $nombre : $email;
            $saludoHtml = htmlspecialchars($saludo, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $subject = "Nueva tarea asignada: {$titulo}";
            $body = "<p>Estimado {$saludoHtml}, se te asignó una tarea en Abogapp.</p>"
                . "<p><strong>Título:</strong> " . htmlspecialchars($titulo, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . "<br>"
                . ($clienteNombre ? "<strong>Cliente:</strong> " . htmlspecialchars($clienteNombre, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . "<br>" : "")
                . "<strong>Vencimiento:</strong> " . htmlspecialchars($vence, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . "<br>"
                . "<strong>Prioridad:</strong> " . htmlspecialchars($prioridad, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . "<br>"
                . "<strong>ID:</strong> " . htmlspecialchars($taskId, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . "</p>"
                . "<p>Ingresa a la app para ver el detalle <a href=\"https://abogapp.gjabogados.cl\">aquí</a>.</p>";
            if (enviarCorreoSimple($config, $email, $subject, $body, true)) {
                $sent++;
            }
        }
        echo json_encode(['ok' => true, 'data' => ['sent' => $sent, 'recipients' => count($destinatarios)]]);
        break;
    }

    case 'send_task_due_reminders': {
        validarSecretRecordatorio($config, $payload);
        $force = (bool) ($payload['force'] ?? false);
        [$programHour, $programMinute] = horaProgramadaRecordatorio($config);
        $nowHour = (int) date('G');
        $nowMinute = (int) date('i');
        if (!$force && ($nowHour !== $programHour || $nowMinute !== $programMinute)) {
            echo json_encode([
                'ok' => true,
                'data' => [
                    'sent' => 0,
                    'skipped' => true,
                    'reason' => 'outside_scheduled_time',
                    'scheduled' => sprintf('%02d:%02d', $programHour, $programMinute),
                    'now' => sprintf('%02d:%02d', $nowHour, $nowMinute),
                ],
            ]);
            break;
        }

        $today = date('Y-m-d');
        $tablas = [
            ['table' => 'diario', 'tipo' => 'tarea diaria', 'titulo' => 'texto', 'vence' => 'fechaFin', 'asignados' => 'asignadosA'],
            ['table' => 'tareasinternas', 'tipo' => 'tarea interna', 'titulo' => 'texto', 'vence' => 'fechaFin', 'asignados' => 'asignadosA'],
            ['table' => 'tareas', 'tipo' => 'gestión', 'titulo' => 'titulo', 'vence' => 'fin', 'asignados' => 'asignadoA'],
        ];

        $sent = 0;
        $digests = [];
        foreach ($tablas as $cfgTabla) {
            $rows = obtenerRecordsTabla($pdo, $cfgTabla['table']);
            foreach ($rows as $row) {
                if (estaArchivadaOEliminada($row)) continue;
                if (esEstadoTerminado($row)) continue;
                $asignados = $row[$cfgTabla['asignados']] ?? [];
                if (!is_array($asignados)) $asignados = [$asignados];
                $emails = resolverEmailsAsignados($pdo, $asignados);
                if (!$emails) continue;
                $titulo = trim((string) ($row[$cfgTabla['titulo']] ?? 'Tarea'));
                $taskId = (string) ($row['id'] ?? '');
                $vence = normalizarFechaYmd((string) ($row[$cfgTabla['vence']] ?? ''));
                foreach ($emails as $email) {
                    $digests[$email][] = [
                        'tabla' => $cfgTabla['table'],
                        'tipo' => $cfgTabla['tipo'],
                        'taskId' => $taskId,
                        'titulo' => $titulo,
                        'vence' => $vence ?: 'Sin fecha',
                    ];
                }
            }
        }

        foreach ($digests as $email => $tasks) {
            $digestId = hashAppId("mail-digest|{$email}|{$today}");
            $exists = $pdo->prepare('SELECT 1 FROM abogapp_records WHERE table_name = :table AND app_id = :id LIMIT 1');
            $exists->execute(['table' => 'email_task_reminders', 'id' => $digestId]);
            if ($exists->fetchColumn()) continue;

            $subject = 'Recordatorio diario 09:00 - Tareas pendientes';
            $lines = [];
            $lines[] = "Hola,";
            $lines[] = "";
            $lines[] = "Este es tu resumen diario de tareas pendientes en Abogapp ({$today}).";
            $lines[] = "";
            foreach ($tasks as $idx => $task) {
                $n = $idx + 1;
                $lines[] = "{$n}) [{$task['tipo']}] {$task['titulo']}";
                $lines[] = "   - ID: {$task['taskId']}";
                $lines[] = "   - Vence: {$task['vence']}";
                $lines[] = "";
            }
            $lines[] = 'Ingresa a la app para revisar detalle, prioridades y estado.';
            $body = implode("\n", $lines);

            if (enviarCorreoSimple($config, $email, $subject, $body)) {
                $sent++;
                upsertRecords($pdo, 'email_task_reminders', [[
                    'id' => $digestId,
                    'email' => $email,
                    'date' => $today,
                    'items' => count($tasks),
                    'type' => 'daily_digest',
                ]]);
            }
        }

        echo json_encode(['ok' => true, 'data' => ['sent' => $sent, 'date' => $today, 'recipients' => count($digests)]]);
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
