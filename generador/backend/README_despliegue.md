# Despliegue en cPanel — Generador de Escritos con BD

Este paquete contiene:

```
backend/
├── schema.sql              ← estructura MySQL (2 tablas)
├── api/
│   ├── config.example.php  ← plantilla de configuración (copiar a config.php)
│   ├── db.php              ← conexión PDO
│   ├── util.php            ← auth + helpers JSON
│   ├── plantillas.php      ← endpoint REST de plantillas de causa
│   ├── otrosies.php        ← endpoint REST de biblioteca de otrosíes
│   └── .htaccess           ← protección de archivos internos + Authorization
└── README_despliegue.md    ← este archivo
```

El HTML del generador (`Generador_Escritos.html`) ya incluye la capa de sincronización cliente. No requiere modificaciones.

---

## Paso 1 — Crear base de datos en cPanel

1. Ingresa a cPanel → **MySQL Databases**.
2. En "Create New Database", nombre sugerido: `escritos` (el prefijo del usuario se añade automáticamente, quedando algo como `cpuser_escritos`).
3. En "Add New User": crea un usuario (ej. `escritos`) con una contraseña robusta. cPanel la guarda bajo `cpuser_escritos`.
4. En "Add User to Database": asigna el usuario a la BD con **ALL PRIVILEGES**.

Anota: nombre completo de la BD, usuario completo y contraseña. Se usan en el paso 3.

## Paso 2 — Importar el esquema

1. cPanel → **phpMyAdmin**.
2. Selecciona la BD `cpuser_escritos` en la barra lateral.
3. Pestaña **"Importar"** → elige `schema.sql` → "Continuar".
4. Verifica que aparezcan las tablas `plantillas` y `otrosies_biblioteca`.

## Paso 3 — Subir la carpeta `api/`

1. cPanel → **File Manager** → `public_html`.
2. Crea una carpeta para el generador (ej. `generador`) y súbele el HTML (`Generador_Escritos.html`) renombrándolo si quieres como `index.html`.
3. Dentro de `generador`, crea una subcarpeta `api` y sube los archivos: `db.php`, `util.php`, `plantillas.php`, `otrosies.php`, `.htaccess`, `config.example.php`.
4. **Copia** `config.example.php` → `config.php` (botón derecho → Copy en File Manager).
5. Edita `config.php` y completa:
   - `db.name`, `db.user`, `db.password` (los del paso 1).
   - `api_token`: genera uno largo y aleatorio. Desde SSH o una consola PHP local:
     ```
     php -r "echo bin2hex(random_bytes(32));"
     ```
     Pega el resultado como valor del token. **No compartas este token por canales inseguros.**
6. (Opcional) Pon `'debug' => true` solo mientras estés probando, luego vuelve a `false`.

La URL final de la API quedará: `https://tudominio.cl/generador/api`.

## Paso 4 — Probar la API con `curl`

Desde cualquier terminal con acceso a internet:

```bash
# Listar (vacío al inicio)
curl -s https://tudominio.cl/generador/api/plantillas.php \
     -H "Authorization: Bearer TU_TOKEN"

# Crear una plantilla
curl -s -X POST https://tudominio.cl/generador/api/plantillas.php \
     -H "Authorization: Bearer TU_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"nombre":"Prueba","encabezado":{"tribunal":"JLT Santiago"}}'

# Volver a listar
curl -s https://tudominio.cl/generador/api/plantillas.php \
     -H "Authorization: Bearer TU_TOKEN"
```

Respuesta esperada del `GET`: JSON con `{"plantillas":[...]}`. Si ves `401 No autorizado`, revisa que el token del header coincida con el de `config.php`. Si ves `500`, revisa los logs de errores del hosting (cPanel → Errors).

## Paso 5 — Configurar el generador

1. Abre `https://tudominio.cl/generador/` en tu navegador.
2. En la barra superior, clic en **"Sincronización…"**.
3. Completa:
   - **URL base**: `https://tudominio.cl/generador/api`
   - **Token**: el mismo que pusiste en `config.php`.
   - **Intervalo**: 5 minutos (o lo que prefieras).
4. Clic en **"Probar conexión"**. Debe decir "Conexión OK".
5. Clic en **"Guardar configuración"**.
6. Clic en **"Sincronizar ahora"** para subir lo que tenías guardado localmente.

El chip junto al selector pasará a **"● Sincronizado"** en verde. Desde ese momento, cada plantilla o otrosí que guardes, dupliques o elimines se envía al servidor automáticamente. Si pierdes conexión, el chip dirá **"N pendientes"** y se reintentará al volver.

---

## Seguridad

- `.htaccess` bloquea el acceso HTTP directo a `config.php`, `db.php` y `util.php`. Solo son accesibles desde PHP.
- El token viaja en el header `Authorization: Bearer …`. Usa **siempre HTTPS**; cPanel suele incluir certificados gratuitos (AutoSSL / Let's Encrypt).
- Si alguna vez sospechas que el token se filtró, rota el valor en `config.php` y re-configúralo en cada navegador que uses el generador.
- El token es **único** para toda la oficina. Si en el futuro necesitas separar por usuario, se puede migrar a login con sesiones (requiere más trabajo).

## Mantenimiento y respaldo

- **Backup de BD**: cPanel → Backup Wizard → Download a MySQL Database Backup. Hazlo periódicamente.
- **Restaurar**: phpMyAdmin → Importar el `.sql` del backup.
- **Borrado "duro"** (si alguna vez quieres purgar realmente los soft-deletes):
  ```sql
  DELETE FROM plantillas          WHERE eliminado_en IS NOT NULL AND eliminado_en < NOW() - INTERVAL 180 DAY;
  DELETE FROM otrosies_biblioteca WHERE eliminado_en IS NOT NULL AND eliminado_en < NOW() - INTERVAL 180 DAY;
  ```

## Contratos de la API (referencia)

Base: `/api`

### Plantillas de causa

| Método | Ruta | Propósito |
|---|---|---|
| `GET`    | `/plantillas.php`                 | Lista activa (sin eliminadas) |
| `GET`    | `/plantillas.php?since=<iso>`     | Cambios desde `since`, incluye tombstones |
| `GET`    | `/plantillas.php?uuid=<uuid>`     | Detalle |
| `POST`   | `/plantillas.php`                 | Crear o upsert por `uuid` |
| `PUT`    | `/plantillas.php?uuid=<uuid>`     | Actualizar `nombre` y/o `encabezado` |
| `DELETE` | `/plantillas.php?uuid=<uuid>`     | Soft delete |

Payload upsert:
```json
{
  "uuid": "opcional",
  "nombre": "RIT T-123-2026 — Pérez con Empresa X",
  "encabezado": { "tribunal": "...", "materia": "...", "caratula": "...", "parte": "...", "tipoCausa": "RIT", "numeroCausa": "...", "delegantes": [...] }
}
```

### Biblioteca de otrosíes

Mismo patrón, sobre `/otrosies.php`. Payload upsert:
```json
{
  "uuid": "opcional",
  "titulo": "Patrocinio y poder",
  "contenido": "Texto del otrosí…"
}
```

Todas las respuestas son JSON. Errores siguen `{ "error": "mensaje" }` con `HTTP 4xx/5xx`.

## Estrategia de sincronización del cliente

- `localStorage` es la fuente de verdad local. Cada mutación se guarda primero ahí.
- Cada mutación se encola en `escritos.sync.pending.v1` y se intenta `flush` 500 ms después.
- El `flush` recorre la cola y envía `POST` (upsert) o `DELETE` (soft delete). Si la red o el servidor fallan (5xx/error de red), la op queda en cola; si es un error permanente (4xx distinto de 429), se descarta.
- Periódicamente (intervalo configurable) hace `syncNow`: primero envía pendientes, luego hace `pull` con `?since=<lastPullAt>` para traer cambios de otros navegadores.
- Resolución de conflictos: **last-writer-wins** por `actualizadoEn` (timestamps del servidor).
- Tombstones: cuando `pull` trae una fila con `eliminadoEn`, el cliente la elimina localmente.

Esta estrategia asume un único equipo de confianza. Si se detectan escrituras concurrentes problemáticas, el paso siguiente sería añadir versionado optimista (`if-match`).
