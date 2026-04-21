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
