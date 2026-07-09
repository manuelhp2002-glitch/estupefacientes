# Backend — Google Apps Script

Backend de EstupeFarma: un **Web App de Google Apps Script** (`Code.gs`) que expone
`doPost`/`doGet` sobre una hoja de Google Sheets como base de datos.

Archivos:
- **`Code.gs`** — implementación del contrato (`list/append/appendMany/update/remove`),
  con mapeo por cabecera + auto-extensión de columnas, `LockService`, dedup idempotente por
  `id`, guard de privacidad acotado (§1) y `setup()`/`setupCruces()` no destructivos.
- **`appsscript.json`** — manifiesto (runtime V8, Web App como el usuario, acceso anónimo).

## Contrato esperado por el frontend (`api/client.js`)

POST a `…/exec` con `Content-Type: text/plain;charset=utf-8` (evita el preflight CORS) y
body `{ "action": "<accion>", "payload": { ... } }`:

| Acción       | Payload                | Respuesta            |
|--------------|------------------------|----------------------|
| `list`       | `{ sheet }`            | `{ rows: [...] }`    |
| `append`     | `{ sheet, row }`       | `{ ok: true }`       |
| `appendMany` | `{ sheet, rows }`      | `{ added: <n> }`     |
| `update`     | `{ sheet, id, row }`   | `{ ok: true }`       |
| `remove`     | `{ sheet, id }`        | `{ ok: true }`       |

## Checklist de endurecimiento (Fase 2)

1. `doGet` de salud → `{ status: "ok" }` sin efectos secundarios.
2. Respuestas de error JSON consistentes → `{ error: "<mensaje>" }`.
3. **Guard de privacidad en escritura** (`CLAUDE.md §1`): rechazar/omitir filas con
   patrón de nombre de persona, registrando el rechazo sin volcar el dato.
4. Mapeo por cabecera (no por índice posicional frágil).
5. `id` obligatorio en `append`; fallo limpio en `update`/`remove` si no existe.
6. Idempotencia razonable en `appendMany`.
7. `LockService` para evitar escrituras concurrentes corruptas.
8. Confirmar que responde a `text/plain` sin preflight.
9. Auditar que ninguna pestaña almacena PII de pacientes.

## Despliegue (cuando exista `Code.gs`)

1. Crear el proyecto de Apps Script vinculado a la Spreadsheet (`VITE_SPREADSHEET_ID`).
2. Ejecutar `setup` (seleccionándolo explícitamente en el desplegable de funciones) para
   crear las pestañas base.
3. Desplegar como **Web App** (`Ejecutar como: yo`, `Acceso: cualquiera`).
4. Copiar la URL `…/exec` a `VITE_APPS_SCRIPT_URL` en Vercel y/o en el panel de Ajustes.
