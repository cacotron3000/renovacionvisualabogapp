# ⚖️ AbogApp Beta

**AbogApp** es una aplicación web ligera de gestión legal pensada para estudios jurídicos pequeños o medianos. Permite registrar clientes, asignar expedientes, crear tareas asociadas y hacer seguimiento en un panel central. Todo el contenido se guarda localmente en el navegador mediante `localStorage`, mientras que las credenciales de acceso se gestionan con **Supabase Auth**.

---

La versión actual puede sincronizarse con **Supabase** para un almacenamiento remoto. Se incluye un archivo `supabase_schema.sql` para crear la base de datos en ese servicio.
## 🧩 Características Principales

- 📁 **Gestión de Expedientes**  
  Crea, edita y visualiza expedientes con campos como tribunal, materia, estado de la propuesta, trámite, honorarios y más.

- 👤 **Registro de Clientes**  
  Guarda datos de contacto, dirección, notas internas y enlaces a carpetas Drive por cliente.

- 📝 **Tareas Legales**  
  Asocia tareas a expedientes, define fechas, prioridades y estados de ejecución.

- 📊 **Dashboard Interactivo**  
  Visualiza resumen de clientes, expedientes y tareas, orden cronológico por vencimiento y tareas urgentes destacadas.

- 🛠️ **Utilidades de Importación/Exportación**
  Realiza backups en `.json` y carga datos desde archivo para facilitar pruebas o migraciones.
- ⭐ **Iconos Font Awesome Sharp**
  La interfaz utiliza la familia de iconos Sharp de Font Awesome para una apariencia moderna.
- 👥 **Miembros del equipo**
  La tarjeta de dashboard incluye a Ignacio Jara Álvarez,
  José M. Gorroño Vega y Carlos Gorroño Vega.

---

## 📁 Estructura del Proyecto


### Base de datos Supabase
El archivo `supabase_schema.sql` define las tablas necesarias para replicar la base de datos en Supabase.
Cada tabla incluye una columna `app_id` que almacena el identificador usado por la aplicación. De esta forma Supabase puede generar su propio `id` autoincremental sin interferir con los enlaces locales. Las claves foráneas de `expedientes` y `tareas` apuntan al `app_id` del registro relacionado. Existe además una tabla `diario` para sincronizar las tareas del día y tres tablas adicionales (`casosarchivados`, `gestionesarchivadas` y `diarioarchivadas`) que almacenan los registros archivados. Ejecuta este archivo en tu proyecto de Supabase para crear o actualizar las tablas. Puedes abrir el **SQL Editor** de Supabase Studio, pegar el contenido del archivo y ejecutar la consulta para aplicar los cambios.
Para conectar la app se inicializa un cliente con las siguientes credenciales de ejemplo:

```
NEXT_PUBLIC_SUPABASE_URL=https://vvibgzurltpfqhugcvjz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2aWJnenVybHRwZnFodWdjdmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MTE2MzMsImV4cCI6MjA2NzA4NzYzM30.Hy5S_Ap2u0LHmXMK66zpUhwbuKf8hAUA2OPvOdsSpdM
```

Supabase Auth se utiliza para el inicio de sesión de los usuarios, por lo que las cuentas deben crearse previamente en tu proyecto de Supabase.

En el código se almacenan cifradas utilizando AES. `supabaseClient.js` las descifra con una frase secreta en tiempo de ejecución.

Estas se utilizan en `supabaseClient.js` para crear el cliente.
La sincronización con Supabase es bidireccional. Al iniciar la aplicación se descargan los registros remotos y cualquier cambio en el navegador se envía automáticamente mediante `upsert`. Cada vez que se agrega un nuevo cliente, caso o tarea, ese registro se inserta de inmediato en Supabase. Además se escuchan eventos en tiempo real para mantener actualizados los datos locales.
El helper global `supabaseSync.pushRegistro(tabla, dato)` permite enviar un único
registro a Supabase desde cualquier módulo.
Cuando se sincroniza, se utiliza la columna `app_id` para determinar si el registro
ya existe o debe insertarse. Esto evita errores de identidad al publicar datos.

## Plantilla DOCX
Para personalizar las cotizaciones en Word crea el archivo `templatepropuesta.docx` en la raíz del proyecto. Utiliza etiquetas como las siguientes para insertar los datos dinámicos:
- `[Nombre cliente]`
- `[Mail]`
- `[Materia]`
- `[Fecha]`
- `[Servicio requerido]`
- `[Propuesta de servicio]`
- `[Numero]` o `[Número]`
- `[Usuario]`
- `[Concepto 1]`, `[Fijo 1]`, `[Variable 1]` (y así sucesivamente)

Cuando se exporta a Word, la aplicación reemplazará cada etiqueta por el valor correspondiente.


---

## 🔌 Adaptación para base de datos cPanel (MySQL)

Esta versión incluye una capa de integración para funcionar en hosting cPanel con **PHP + MySQL**, sin Supabase.

### Archivos agregados

- `cpanel.config.js`: configuración activa en frontend (URL del API y API key).
- `cpanel.config.example.js`: plantilla de referencia.
- `backend/api.php`: API REST para login, usuarios y sincronización de registros.
- `backend/config.sample.php`: plantilla de credenciales MySQL y API key.
- `backend/init.sql`: script para crear tablas `abogapp_records` y `abogapp_users`.
- `backend/seed_users.sql`: usuarios iniciales solicitados para importar directamente.

### Pasos de configuración

1. **Base de datos en cPanel**
   - Crea una base MySQL y un usuario con permisos completos.
   - Ejecuta `backend/init.sql` en phpMyAdmin.

2. **Configurar backend**
   - Copia `backend/config.sample.php` como `backend/config.php`.
   - Completa:
     - `db_host`
     - `db_name`
     - `db_user`
     - `db_pass`
     - `api_key`

3. **Configurar frontend**
   - Edita `cpanel.config.js`.
   - Define:
     - `API_BASE_URL` (por ejemplo `/backend/api.php` o URL absoluta).
     - `API_KEY` (la misma del `config.php`).

4. **Usuarios de acceso**
   - Puedes importar `backend/seed_users.sql`, que incluye los usuarios solicitados y un administrador por defecto.
   - Administrador por defecto: `admin@gjabogados.cl` / `R@bula04` (recomendado cambiar clave tras primer acceso).
   - El campo `password_hash` debe ser generado con `password_hash` de PHP.

### Notas técnicas

- La app mantiene los nombres de funciones `supabaseSync`, `supabaseAuth`, `sb` y `sbAdmin` por compatibilidad con el código existente.
- La sincronización funciona mediante peticiones HTTP; no hay tiempo real por websockets.
- Los datos de cada módulo (clientes, tareas, expedientes, audiencias, etc.) se guardan como JSON por tabla lógica en `abogapp_records`.

## 🚀 Mejoras de productividad aplicadas

Se incorporaron mejoras rápidas enfocadas en operación diaria:

1. **Bandeja “Hoy”** con resumen de pendientes, vencidas y carga por responsable.
2. **Atajos de teclado** (`/` buscar, `g` dashboard, `h` hoy, `n` nueva tarea, `c` nuevo cliente).
3. **Búsqueda global** (clientes, casos, gestiones y audiencias).
4. **Plantillas automáticas de descripción** al crear tareas según contexto del expediente.
5. **Panel lateral rápido** para visualizar detalles sin salir del flujo.
6. **Reglas automáticas** para detectar tareas vencidas y generar aviso.
7. **Sincronización incremental** por fecha de última actualización.
8. **Mensajes de login más claros** (muestra error recibido por API).
9. **Resumen de carga por responsable** en la vista de hoy.
10. **Notificación automática diaria** de vencimientos detectados.

### Extensiones aplicadas (1 al 9)
- SLA visual (rojo/amarillo/verde) para prioridades temporales.
- Calendario semanal resumido en la vista Hoy.
- Filtros avanzados en búsqueda global (`tipo:`, `asignado:`, `vencida:`, `tag:`).
- Tablero Kanban resumido por estado.
- Sugerencia de asignación basada en carga actual.
- Flujo automático de tareas al crear expediente según materia.
- Auditoría de cambios (`abogapp_audit`) y consulta reciente por API.
- Soporte de rol en usuarios (`role`) para RBAC básico.
- KPI operativos en dashboard.

### Ajustes extra de eficiencia e interfaz
- Refresco modular por secciones para reducir repintados innecesarios.
- Carga inicial priorizada (tablas críticas) + sincronización diferida del resto.
- API con soporte `limit`/`offset` en `pull_table` y `pull_all`.
- Auditoría filtrable por tabla/actor/rango de fechas.
- KPI navegables (clic para abrir vistas/filtros).
- Filtros de la vista Hoy (todos/hoy/vencidas/semana).
- Búsqueda global con navegación por teclado (↑ ↓ Enter).

## 📌 Reglas operativas (abril 2026)

- **Ficha de caso operativa**: cada expediente debe registrar responsable, etapa procesal, fecha de control y próxima acción.
- **Próxima acción obligatoria**: aplica al crear/editar casos y tareas.
- **Alertas de plazos**: se notifican hitos vencidos y recordatorios T-7 / T-2.
- **Control semanal**: la vista Hoy permite exportar un CSV de seguimiento semanal.
- **Vista por abogado**: se puede filtrar la bandeja Hoy por responsable.

### Sistema de detalle sin modales
Se incorporó un enfoque de **ficha lateral** (`quickPanel`) para mostrar detalles de tareas, clientes y audiencias sin abrir modales superpuestos. Esto reduce interrupciones y permite navegación más fluida.
