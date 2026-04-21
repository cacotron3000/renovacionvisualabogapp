<?php
// =============================================================================
// Utilidades compartidas — headers, autenticación, JSON I/O, errores.
// =============================================================================

require_once __DIR__ . '/db.php';

// ---------- Envío de respuestas JSON ----------
function json_response(int $status, $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(int $status, string $msg, ?string $detalle = null): void
{
    $out = ['error' => $msg];
    $cfg = config();
    if ($detalle !== null && !empty($cfg['debug'])) $out['detalle'] = $detalle;
    json_response($status, $out);
}

// ---------- CORS ----------
function apply_cors(): void
{
    $cfg     = config();
    $origins = $cfg['cors_allow_origins'] ?? [];
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $origins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Max-Age: 86400');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ---------- Autenticación por token ----------
function require_auth(): void
{
    $cfg = config();
    $expected = $cfg['api_token'] ?? '';
    if ($expected === '' || $expected === 'CAMBIAR_POR_UN_TOKEN_LARGO_Y_ALEATORIO') {
        json_error(500, 'Servidor no configurado: api_token ausente o de ejemplo.');
    }
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    // Algunos Apache no pasan el header Authorization por defecto:
    if ($auth === '' && function_exists('apache_request_headers')) {
        $h = apache_request_headers();
        foreach ($h as $k => $v) if (strcasecmp($k, 'Authorization') === 0) { $auth = $v; break; }
    }
    if (!preg_match('/^\s*Bearer\s+(.+?)\s*$/i', $auth, $m)) {
        json_error(401, 'No autorizado: falta header Authorization: Bearer <token>.');
    }
    $provided = $m[1];
    if (!hash_equals($expected, $provided)) {
        json_error(401, 'No autorizado: token inválido.');
    }
}

// ---------- Lectura de JSON de entrada ----------
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) json_error(400, 'Cuerpo inválido: se esperaba JSON.');
    return $data;
}

// ---------- UUID v4 (fallback si el cliente no envía uno) ----------
function uuid_v4(): string
{
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

// ---------- Validación de UUID ----------
function is_uuid(string $s): bool
{
    return (bool)preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $s);
}

// ---------- Parseo de timestamp ISO ----------
function parse_iso_to_datetime(?string $iso): ?string
{
    if ($iso === null || $iso === '') return null;
    try {
        $dt = new DateTimeImmutable($iso, new DateTimeZone('UTC'));
        return $dt->format('Y-m-d H:i:s.v');
    } catch (Exception $e) {
        return null;
    }
}

// ---------- Formato de fila → objeto JSON estable ----------
function fmt_datetime_utc($val): ?string
{
    if ($val === null || $val === '') return null;
    $dt = new DateTimeImmutable($val, new DateTimeZone('UTC'));
    return $dt->format('Y-m-d\TH:i:s.v\Z');
}

// ---------- Bootstrap común ----------
function bootstrap(): void
{
    apply_cors();
    require_auth();
}
