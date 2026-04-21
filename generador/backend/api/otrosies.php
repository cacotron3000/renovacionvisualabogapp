<?php
// =============================================================================
// Endpoint: /api/otrosies.php  (biblioteca de otrosíes reutilizables)
// -----------------------------------------------------------------------------
// GET    /api/otrosies.php                 → lista (sin eliminados)
// GET    /api/otrosies.php?since=<iso>     → sync: cambios ≥ since (incluye eliminados)
// GET    /api/otrosies.php?uuid=<uuid>     → detalle
// POST   /api/otrosies.php                 → crear o upsert (por uuid si viene)
// PUT    /api/otrosies.php?uuid=<uuid>     → actualizar
// DELETE /api/otrosies.php?uuid=<uuid>     → soft delete
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
                $st = $pdo->prepare("SELECT uuid, titulo, contenido, creado_en, actualizado_en, eliminado_en FROM otrosies_biblioteca WHERE uuid = ?");
                $st->execute([$uuid]);
                $row = $st->fetch();
                if (!$row) json_error(404, 'No encontrado.');
                json_response(200, format_row($row));
            }
            if (isset($_GET['since'])) {
                $since = parse_iso_to_datetime((string)$_GET['since']);
                if ($since === null) json_error(400, 'since inválido (ISO 8601 UTC).');
                $st = $pdo->prepare("SELECT uuid, titulo, contenido, creado_en, actualizado_en, eliminado_en FROM otrosies_biblioteca WHERE actualizado_en >= ? ORDER BY actualizado_en ASC");
                $st->execute([$since]);
                $rows = array_map('format_row', $st->fetchAll());
                json_response(200, ['otrosies' => $rows, 'server_time' => fmt_datetime_utc(gmdate('Y-m-d H:i:s.') . '000')]);
            }
            $rows = $pdo->query("SELECT uuid, titulo, contenido, creado_en, actualizado_en, eliminado_en FROM otrosies_biblioteca WHERE eliminado_en IS NULL ORDER BY actualizado_en DESC")->fetchAll();
            json_response(200, ['otrosies' => array_map('format_row', $rows)]);
            break;

        case 'POST':
            $data = read_json_body();
            $uuid = isset($data['uuid']) && is_string($data['uuid']) && is_uuid($data['uuid']) ? $data['uuid'] : uuid_v4();
            $titulo    = trim((string)($data['titulo'] ?? ''));
            $contenido = (string)($data['contenido'] ?? '');
            if ($titulo === '')    json_error(400, 'Falta "titulo".');
            if ($contenido === '') json_error(400, 'Falta "contenido".');

            $st = $pdo->prepare("
                INSERT INTO otrosies_biblioteca (uuid, titulo, contenido)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  titulo = VALUES(titulo),
                  contenido = VALUES(contenido),
                  eliminado_en = NULL
            ");
            $st->execute([$uuid, $titulo, $contenido]);

            $st2 = $pdo->prepare("SELECT uuid, titulo, contenido, creado_en, actualizado_en, eliminado_en FROM otrosies_biblioteca WHERE uuid = ?");
            $st2->execute([$uuid]);
            json_response(201, format_row($st2->fetch()));
            break;

        case 'PUT':
            $uuid = (string)($_GET['uuid'] ?? '');
            if (!is_uuid($uuid)) json_error(400, 'uuid inválido.');
            $data = read_json_body();
            $sets = []; $args = [];
            if (isset($data['titulo'])) {
                $titulo = trim((string)$data['titulo']);
                if ($titulo === '') json_error(400, '"titulo" no puede estar vacío.');
                $sets[] = 'titulo = ?'; $args[] = $titulo;
            }
            if (isset($data['contenido'])) {
                $contenido = (string)$data['contenido'];
                if ($contenido === '') json_error(400, '"contenido" no puede estar vacío.');
                $sets[] = 'contenido = ?'; $args[] = $contenido;
            }
            if (!$sets) json_error(400, 'Nada que actualizar.');
            $args[] = $uuid;
            $st = $pdo->prepare("UPDATE otrosies_biblioteca SET " . implode(', ', $sets) . " WHERE uuid = ?");
            $st->execute($args);
            if ($st->rowCount() === 0) {
                $chk = $pdo->prepare("SELECT 1 FROM otrosies_biblioteca WHERE uuid = ?");
                $chk->execute([$uuid]);
                if (!$chk->fetchColumn()) json_error(404, 'No encontrado.');
            }
            $st2 = $pdo->prepare("SELECT uuid, titulo, contenido, creado_en, actualizado_en, eliminado_en FROM otrosies_biblioteca WHERE uuid = ?");
            $st2->execute([$uuid]);
            json_response(200, format_row($st2->fetch()));
            break;

        case 'DELETE':
            $uuid = (string)($_GET['uuid'] ?? '');
            if (!is_uuid($uuid)) json_error(400, 'uuid inválido.');
            $st = $pdo->prepare("UPDATE otrosies_biblioteca SET eliminado_en = CURRENT_TIMESTAMP(3) WHERE uuid = ? AND eliminado_en IS NULL");
            $st->execute([$uuid]);
            if ($st->rowCount() === 0) {
                $chk = $pdo->prepare("SELECT eliminado_en FROM otrosies_biblioteca WHERE uuid = ?");
                $chk->execute([$uuid]);
                $row = $chk->fetch();
                if (!$row) json_error(404, 'No encontrado.');
            }
            json_response(200, ['uuid' => $uuid, 'eliminado' => true]);
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
    return [
        'uuid'          => $row['uuid'],
        'titulo'        => $row['titulo'],
        'contenido'     => $row['contenido'],
        'creadoEn'      => fmt_datetime_utc($row['creado_en']),
        'actualizadoEn' => fmt_datetime_utc($row['actualizado_en']),
        'eliminadoEn'   => fmt_datetime_utc($row['eliminado_en']),
    ];
}
