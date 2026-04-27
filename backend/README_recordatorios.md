# Configuración de avisos por correo de tareas

## 1) Aviso inmediato al asignar

El frontend llama al endpoint `send_task_assignment_email` al crear tareas con asignados.

## 2) Recordatorio diario 09:00 (recomendado por cron)

El endpoint `send_task_due_reminders` está preparado para ejecutarse por scheduler:

- Hora programada configurable:
  - `task_reminders_hour` (0-23)
  - `task_reminders_minute` (0-59)
- Protección de ejecución:
  - `task_reminders_cron_secret`

Si el secret está configurado, el payload debe incluir:

```json
{
  "secret": "REEMPLAZAR_SECRET_CRON"
}
```

Si el endpoint se llama fuera de la hora programada, responde `ok` con `skipped=true`.

## 3) Ejemplo de cron (cPanel/Linux)

```bash
0 9 * * * /usr/bin/curl -s -X POST "https://TU_DOMINIO/backend/api.php?action=send_task_due_reminders" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: TU_API_KEY" \
  -d '{"secret":"REEMPLAZAR_SECRET_CRON"}'
```

## 4) Criterio de tareas incluidas en el resumen diario

Incluye tareas activas asignadas al usuario y pendientes:

- tablas activas: `diario`, `tareasinternas`, `tareas`
- excluye registros archivados/eliminados
- excluye tareas con estado terminado/completado

Cada destinatario recibe **un solo correo diario** con el listado consolidado.

## 5) WhatsApp para asignaciones y recordatorios

Puedes habilitar envío adicional por WhatsApp (Cloud API de Meta):

- `whatsapp_enabled` => `true`
- `whatsapp_api_version` => por ejemplo `v20.0`
- `whatsapp_phone_number_id` => ID del número de WhatsApp Business
- `whatsapp_access_token` => token de acceso

Si está habilitado, el backend enviará WhatsApp en:

- asignación de tarea (`send_task_assignment_email`)
- resumen diario (`send_task_due_reminders`)

## 6) Cómo asignar número de celular a cada miembro del equipo

1. Agrega columna `telefono` en `abogapp_users` (si tu base ya existe y no fue creada desde `init.sql`):

```sql
ALTER TABLE abogapp_users ADD COLUMN telefono VARCHAR(30) NULL AFTER nombre;
```

2. Carga/actualiza los números:

```sql
UPDATE abogapp_users SET telefono = '+56912345678' WHERE email = 'abogado1@dominio.cl';
UPDATE abogapp_users SET telefono = '+56987654321' WHERE email = 'abogado2@dominio.cl';
```

3. Recomendación de formato:
   - usar formato internacional E.164 (ej: `+569XXXXXXXX` para Chile).

## 7) Preferencias de recordatorio por usuario (hora y canal)

Puedes configurar preferencias por usuario en `abogapp_records` con `table_name = user_notification_prefs`.

Payload ejemplo:

```json
{
  "id": 1,
  "email": "abogado1@dominio.cl",
  "reminderHour": 8,
  "reminderMinute": 30,
  "reminderChannel": "email"
}
```

Valores permitidos en `reminderChannel`: `email`, `whatsapp`, `both`, `none`.

Si un usuario no tiene preferencia, se usa el horario global (`task_reminders_hour`, `task_reminders_minute`) y canal `both`.

## 8) Plantillas editables de notificaciones

Puedes sobrescribir asuntos/cuerpos sin tocar código guardando una plantilla global en `abogapp_records` con:

- `table_name = notification_templates`
- `app_id = 1`

Payload ejemplo:

```json
{
  "assignmentSubject": "Nueva asignación: {{titulo}}",
  "assignmentBody": "<p>Estimado {{nombre}}, ...</p>",
  "digestSubject": "Recordatorio diario - {{fecha}}",
  "digestIntro": "Resumen de tareas pendientes para {{fecha}}."
}
```

Variables disponibles:

- `{{nombre}}`, `{{titulo}}`, `{{cliente}}`, `{{vence}}`, `{{prioridad}}`, `{{id}}`
- `{{fecha}}` (en resumen diario)
