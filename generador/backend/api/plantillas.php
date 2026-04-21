<?php
// =============================================================================
// Endpoint: /api/plantillas.php
// -----------------------------------------------------------------------------
// GET    /api/plantillas.php                 → lista (sin eliminadas)
// GET    /api/plantillas.php?since=<iso>     → sync: cambios ≥ since (incluye eliminadas)
// GET    /api/plantillas.php?uuid=<uuid>     → detalle
// POST   /api/plantillas.php                 → crear o upsert (por uuid si viene)
// PUT    /api/plantillas.php?uuid=<uuid>     → actualizar
// DELETE /api/plantillas.php?uuid=<uuid>     → soft delete
// =============================================================================

require_once __DIR__ . '/util.php';
bootstrap();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo    = db();

try {
    switch ($method) {

        case 'GET':
            if (isset($_GET['uuid'])) {
                $uuid = (string)$_GET['uuid'];
                if (!is_uuid($uuid)) json_error(400, 'uuid inválido.');
                $st = $pdo->prepare("SELECT uuid, nombre, encabezado_json, creado_en, actualizado_en, eliminado_en FROM plantillas WHERE uuid = ?");
                $st->execute([$uuid]);
                $row = $st->fetch();
                if (!$row) json_error(404, 'No encontrada.');
                json_response(200, format_row($row));
            }
            if (isset($_GET['since'])) {
                $since = parse_iso_to_datetime((string)$_GET['since']);
                if ($since === null) json_error(400, 'since inválido (ISO 8601 UTC).');
                $st = $pdo->prepare("SELECT uuid, nombre, encabezado_json, creado_en, actualizado_en, eliminado_en FROM plantillas WHERE actualizado_en >= ? ORDER BY actualizado_en ASC");
                $st->execute([$since]);
                $rows = array_map('format_row', $st->fetchAll());
                json_response(200, ['plantillas' => $rows, 'server_time' => fmt_datetime_utc(gmdate('Y-m-d H:i:s.') . '000')]);
            }
            // Lista normal (sin eliminadas)
            $rows = $pdo->query("SELECT uuid, nombre, encabezado_json, creado_en, actualizado_en, eliminado_en FROM plantillas WHERE eliminado_en IS NULL ORDER BY actualizado_en DESC")->fetchAll();
            json_response(200, ['plantillas' => array_map('format_row', $rows)]);
            break;

        case 'POST':
            $data  = read_json_body();
            $uuid  = isset($data['uuid']) && is_string($data['uuid']) && is_uuid($data['uuid']) ? $data['uuid'] : uuid_v4();
            $nombre = trim((string)($data['nombre'] ?? ''));
            if ($nombre === '') json_error(400, 'Falta "nombre".');
            if (!isset($data['encabezado']) || !is_array($data['encabezado'])) json_error(400, 'Falta "encabezado" (objeto).');
            $enc = json_encode($data['encabezado'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($enc === false) json_error(400, 'encabezado no serializable.');

            // Upsert: si ya existe ese uuid, actualiza; si no, inserta.
            $st = $pdo->prepare("
                INSERT INTO plantillas (uuid, nombre, encabezado_json)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  nombre = VALUES(nombre),
                  encabezado_json = VALUES(encabezado_json),
                  eliminado_en = NULL
            ");
            $st->execute([$uuid, $nombre, $enc]);

            $st2 = $pdo->prepare("SELECT uuid, nombre, encabezado_json, creado_en, actualizado_en, eliminado_en FROM plantillas WHERE uuid = ?");
            $st2->execute([$uuid]);
            json_response(201, format_row($st2->fetch()));
            break;

        case 'PUT':
            $uuid = (string)($_GET['uuid'] ?? '');
            if (!is_uuid($uuid)) json_error(400, 'uuid inválido.');
            $data = read_json_body();
            $sets = [];
            $args = [];
            if (isset($data['nombre'])) {
                $nombre = trim((string)$data['nombre']);
                if ($nombre === '') json_error(400, '"nombre" no puede estar vacío.');
                $sets[] = 'nombre = ?'; $args[] = $nombre;
            }
            if (isset($data['encabezado'])) {
                if (!is_array($data['encabezado'])) json_error(400, '"encabezado" debe ser objeto.');
                $enc = json_encode($data['encabezado'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($enc === false) json_error(400, 'encabezado no serializable.');
                $sets[] = 'encabezado_json = ?'; $args[] = $enc;
            }
            if (!$sets) json_error(400, 'Nada que actualizar.');
            $args[] = $uuid;
            $st = $pdo->prepare("UPDATE plantillas SET " . implode(', ', $sets) . " WHERE uuid = ?");
            $st->execute($args);
            if ($st->rowCount() === 0) {
                // Puede ser que no haya cambios reales o que no exista; verifico existencia.
                $chk = $pdo->prepare("SELECT 1 FROM plantillas WHERE uuid = ?");
                $chk->execute([$uuid]);
                if (!$chk->fetchColumn()) json_error(404, 'No encontrada.');
            }
            $st2 = $pdo->prepare("SELECT uuid, nombre, encabezado_json, creado_en, actualizado_en, eliminado_en FROM plantillas WHERE uuid = ?");
            $st2->execute([$uuid]);
            json_response(200, format_row($st2->fetch()));
            break;

        case 'DELETE':
            $uuid = (string)($_GET['uuid'] ?? '');
            if (!is_uuid($uuid)) json_error(400, 'uuid inválido.');
            $st = $pdo->prepare("UPDATE plantillas SET eliminado_en = CURRENT_TIMESTAMP(3) WHERE uuid = ? AND eliminado_en IS NULL");
            $st->execute([$uuid]);
            if ($st->rowCount() === 0) {
                $chk = $pdo->prepare("SELECT eliminado_en FROM plantillas WHERE uuid = ?");
                $chk->execute([$uuid]);
                $row = $chk->fetch();
                if (!$row) json_error(404, 'No encontrada.');
                // Ya estaba eliminada: respondemos 200 idempotente.
            }
            json_response(200, ['uuid' => $uuid, 'eliminada' => true]);
            break;

        default:
            header('Allow: GET, POST, PUT, DELETE, OPTIONS');
            json_error(405, 'Método no permitido.');
    }

} catch (PDOException $e) {
    json_error(500, 'Error de base de datos', $e->getMessage());
} catch (Throwable $e) {
    json_error(500, 'Error interno', $e->getMessage());
}

// -----------------------------------------------------------------------------
function format_row(array $row): array
{
    $enc = json_decode($row['encabezado_json'] ?? '{}', true);
    return [
        'uuid'       => $row['uuid'],
        'nombre'     => $row['nombre'],
        'encabezado' => is_array($enc) ? $enc : (object)[],
        'creadoEn'       => fmt_datetime_utc($row['creado_en']),
        'actualizadoEn'  => fmt_datetime_utc($row['actualizado_en']),
        'eliminadoEn'    => fmt_datetime_utc($row['eliminado_en']),
    ];
}
