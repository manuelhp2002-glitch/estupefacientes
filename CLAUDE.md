# CLAUDE.md — EstupeFarma (Gestor de Estupefacientes · HUNSC)

> Contexto de proyecto para **Claude Code**. Este archivo es la fuente de verdad
> operativa del repositorio. Léelo completo antes de tocar código.
> Proyecto liderado por **Manu**; toda propuesta relevante se documenta para
> revisión de las responsables del servicio de estupefacientes (**Karen** y **Sara**).

---

## 0. Qué es esto y qué vamos a hacer

**EstupeFarma** es una aplicación web interna del Servicio de Farmacia del Hospital
Universitario Nuestra Señora de Candelaria (HUNSC) para gestionar medicamentos
**estupefacientes** (control legal estricto, Convención Única de 1961 + AEMPS).
Complementa —no sustituye— al sistema **ATHOS SADE**: centraliza inventario,
detección de anomalías, pedidos, caducados e incidencias en una sola interfaz.

**Estado actual:** existe un prototipo funcional en un único archivo React
(`GestorEstupefacientes.jsx`, ~1.100 líneas) que ya habla con un backend de
Google Apps Script sobre Google Sheets.

**Objetivo de esta migración:** trocear ese monolito en un proyecto
**Vite + React (JSX)** modular y mantenible, con el **backend de Apps Script en
carpeta aparte**, sin cambiar el comportamiento de negocio (paridad primero),
y luego añadir **Configuración** (catálogo editable) y el **andamiaje** de las
declaraciones futuras.

> ⚠️ El código legado vive en `docs/legacy/GestorEstupefacientes.jsx`. Es la
> **referencia de comportamiento**: ante cualquier duda de lógica, ese archivo
> manda. No lo borres hasta que la paridad esté verificada.

---

## 1. REGLA DE PRIVACIDAD — ABSOLUTA E INVIOLABLE

**Nunca** se maneja, muestra, almacena, registra ni infiere un **nombre de paciente**,
bajo ninguna circunstancia ni formato (ni UI, ni base de datos, ni logs, ni ningún
análisis futuro).

- Los movimientos se vinculan **solo** a: unidad clínica (EAP02, HEMO, EN03, UVI…),
  número de vale, y códigos de pacientes ficticios del sistema (§8).
- Si un archivo de entrada contiene un posible nombre de paciente, se **avisa** al
  usuario y se **excluye del procesamiento**. El frontend ya trae una heurística
  (`onNombrePaciente`) — mantenerla y, en el backend, **rechazar en escritura**
  cualquier fila con campos sospechosos de nombre.
- Cualquier función nueva que toque datos de entrada debe respetar esta regla por diseño.

Esta regla tiene prioridad sobre cualquier otra consideración de producto.

---

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | **Vite + React 18 (JSX, sin TypeScript)** | SPA. Iconos: `lucide-react`. Lectura de Excel: `xlsx` (SheetJS) |
| Estado | React hooks (`useState`/`useMemo`/`useEffect`/`useRef`) | Sin Redux; el estado global vive en `App.jsx` |
| Backend | **Google Apps Script** (Web App `doPost`/`doGet`) | Carpeta `backend/apps-script/`. Se despliega como Web App `/exec` |
| Base de datos | **Google Sheets** | Una pestaña por módulo. Spreadsheet ID en §4 |
| Estilos | CSS-in-JS inline (objeto `theme`) | No hay Tailwind ni CSS modules en el legado; mantener el enfoque salvo decisión explícita |

**No introducir** TypeScript, Tailwind, ni librerías de estado sin pedirlo. Mantener
el stack lo más fiel posible al prototipo para minimizar riesgo en la migración.

---

## 3. Estructura objetivo del repositorio

```
estupefarma/
├── CLAUDE.md                     # este archivo
├── README.md                     # arranque, scripts, despliegue
├── .env.example                  # VITE_APPS_SCRIPT_URL, VITE_SPREADSHEET_ID
├── docs/
│   ├── EstupeFarma_Contexto_v3.md        # doc de dominio (fuente de verdad funcional)
│   ├── EstupeFarma_Catalogo_CodigoV.md   # catálogo oficial Código V
│   ├── HT_..._GESTION_DE_ESTUPEFACIENTES.odt/.md  # procedimiento oficial
│   └── legacy/
│       └── GestorEstupefacientes.jsx      # monolito original (referencia)
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                # layout, sidebar, estado global, orquestación
│       ├── config.js             # lee import.meta.env; feature flags
│       ├── theme.js              # paleta C, dotPattern, estilos base, primitivas de estilo
│       ├── api/
│       │   └── client.js         # makeApi(): list/append/appendMany/update/remove
│       ├── data/
│       │   └── catalogo.js       # CATALOGO_ORALES, CATALOGO_IV, medByV, PROVEEDORES, TIPOS_INCIDENCIA, SISTEMAS
│       ├── domain/
│       │   ├── errores.js        # ERROR_CATALOG (E01–E12), CRITICOS
│       │   ├── fechas.js         # excelSerialToDate, fmtDate, fmtDateTime, todayISO, dayStr
│       │   ├── inventario.js     # discColor, stockLevel
│       │   └── detector.js       # readWorkbookSmart, detectHeaderRow, sheetToObjects,
│       │                         # normalizeRow, mergeLH, proximos, analizarMovimientos
│       ├── components/ui/         # Badge, Drawer, Card, StatCard, SectionTitle,
│       │                         # GroupToggle, Field, Empty, Toast, estilos btn/input
│       └── features/
│           ├── inicio/           # Inicio.jsx
│           ├── inventario/       # InventarioSemanal.jsx
│           ├── anteriores/       # InventariosAnteriores.jsx
│           ├── detector/         # DetectorAlertas.jsx
│           ├── pedidos/          # RegistroPedidos.jsx
│           ├── caducados/        # Caducados.jsx
│           ├── incidencias/      # Incidencias.jsx
│           ├── configuracion/    # Configuracion.jsx  (NUEVO — catálogo editable)
│           └── declaraciones/    # andamiaje: Semestral (F5) y Anual AEMPS (futuras)
└── backend/
    └── apps-script/
        ├── Code.gs               # backend a REVISAR contra el contrato de §5
        ├── appsscript.json
        └── README.md             # pasos de despliegue del Web App
```

Regla de troceo: **una función/componente exportado por archivo** cuando sea un
componente de pantalla; agrupar utilidades afines por dominio. No crear archivos de
una sola línea.

---

## 4. Configuración y variables de entorno

El legado tenía `CONFIG.APPS_SCRIPT_URL` hardcodeado (vacío) + un campo en Ajustes.
En la migración, **externalizar** a variables de entorno de Vite:

`.env.example`
```
# URL del Web App de Apps Script desplegado (termina en /exec)
VITE_APPS_SCRIPT_URL=

# ID de la hoja de cálculo de Google Sheets que actúa como base de datos
VITE_SPREADSHEET_ID=1HKsAo3kDc_3fpvg8MeCj_vPtwEkm-T6_CjIBc1bFNPY
```

- `VITE_SPREADSHEET_ID` es el **ID de la Spreadsheet** (base de datos) que el
  Apps Script abre con `SpreadsheetApp.openById(...)`. El frontend normalmente
  **no** lo necesita (habla vía la URL del Web App), pero se documenta aquí porque
  es la pieza que conecta backend ↔ datos.
- Mantener el **fallback a “modo local”** (datos solo en memoria) si no hay URL,
  igual que el legado, y el panel de Ajustes para pegar la URL en runtime.
- Nunca commitear un `.env` real con URLs internas.

---

## 5. Contrato del backend (Apps Script) — A REVISAR

El frontend (`api/client.js`, ex-`makeApi`) hace **POST** al Web App con
`Content-Type: text/plain;charset=utf-8` (para evitar el preflight CORS) y body:

```json
{ "action": "<accion>", "payload": { ... } }
```

Acciones que el frontend **espera** hoy:

| Acción | Payload | Respuesta esperada | Uso |
|---|---|---|---|
| `list` | `{ sheet }` | `{ rows: [ {id, ...campos} ] }` | Carga inicial de cada pestaña |
| `append` | `{ sheet, row }` | `{ ok: true }` (o la fila) | Alta de un registro |
| `appendMany` | `{ sheet, rows }` | `{ added: <n> }` | Guardado por lotes del cruce (pestaña `Cruces`) |
| `update` | `{ sheet, id, row }` | `{ ok: true }` | Edición por `id` |
| `remove` | `{ sheet, id }` | `{ ok: true }` | Borrado por `id` |

Helpers de administración ya existentes (invocados manualmente desde el editor de
Apps Script, **no** vía HTTP):
- `setup` — crea todas las pestañas base. **Debe seleccionarse explícitamente en el
  desplegable de funciones del editor antes de ejecutar** (ejecutar `doGet`/`doPost`
  por error fue una fuente histórica de confusión).
- `setupCruces` — crea **solo** la pestaña `Cruces` sin borrar datos existentes.

### Checklist de revisión/endurecimiento del backend
Cuando audites `Code.gs`, comprueba y corrige:

1. **`doGet` de salud**: devolver un JSON `{status:"ok"}` para poder verificar el
   despliegue sin efectos secundarios.
2. **Respuesta de error consistente**: `{ error: "<mensaje>" }` con `ContentService`
   MIME JSON. El frontend ya lanza si `data.error` existe.
3. **Guard de privacidad en escritura** (§1): rechazar/omitir cualquier fila cuyos
   campos contengan un patrón de nombre de persona. Registrar el rechazo sin volcar
   el dato.
4. **Cabeceras de columnas estables por pestaña**: el modelo es *fila = objeto JSON*
   con clave `id`. Asegurar que `append`/`update` mapean por cabecera, no por índice
   posicional frágil.
5. **`id` obligatorio** en `append`; `update`/`remove` deben fallar limpio si no
   encuentran el `id`.
6. **Idempotencia razonable** en `appendMany` (que no duplique si se reintenta el POST).
7. **Locking**: usar `LockService` para evitar escrituras concurrentes corruptas.
8. **CORS**: confirmar que el Web App responde a `text/plain` sin preflight; no romper eso.
9. **Sin PII de pacientes** en ninguna pestaña, nunca (auditar columnas existentes).

---

## 6. Modelo de datos (pestañas del Google Sheet)

Una pestaña por módulo. Cada fila es un objeto con `id` único.

| Pestaña | Origen (feature) | Campos clave |
|---|---|---|
| `Inventarios` | F1/F2 | `id, fecha, grupo, codigoV, nombre, real, d07, maestro, descRealD07, descD07Maestro` |
| `Pedidos` | F4 | `id, vale, cn, estupefaciente, proveedor, fechaPedido, udsPedidas, udsRecibidas, fechaEntrada, farmaceutico, noServido, incidencias, avisoLlegada, horaAviso` |
| `Caducados` | F5 | `id, cn, nombre, lote, fechaCaducidad, unidades` |
| `Incidencias` | F6 | `id, tipo, medicamento, fechaHora, movimiento, cantidad, sistema, descripcion, medida, estado, farmaceutico` |
| `Cruces` | F3 | `id, medicamento, codigoV, fecha, tipo, medico, cantidad, cantFinal, usuario, alertas, nivel, intervalo` |
| `Alertas` | F3 (opc.) | Reservada para persistir alertas si se decide en el futuro |

> Ningún campo contiene nombres de paciente. La columna `medico`/`usuario` del cruce
> hace referencia a **personal** (farmacéutico/residente), no a pacientes.

---

## 7. Funcionalidades

Numeración F1–F6 (actuales) + Configuración + Declaraciones (andamiaje). El detalle
funcional completo está en `docs/EstupeFarma_Contexto_v3.md`; aquí va lo esencial +
de dónde sale el código en el legado.

### F1 — Inventario Semanal  *(legado: `InventarioSemanal`)*
Triple recuento por medicamento: **ATHOS REAL** (físico, *verdad absoluta*),
**ATHOS D07** (SADE), **MAESTRO** (DRAGO/FARMATOOLS). Descuadres calculados:
`Real − D07` (error ATHOS) y `D07 − Maestro` (error DRAGO). Color por fila:
sin descuadre → normal, 1–10 uds → amarillo, >10 uds → rojo. Al guardar, compara
`real` contra MIN/MAX del catálogo (§9) y genera **avisos de reposición**.

### F2 — Inventarios Anteriores  *(legado: `InventariosAnteriores`)*
Consulta solo lectura de inventarios guardados. Selector de fechas con nº de
descuadres por semana. Mismo código de colores. Toggle Orales/IV.

### F3 — Detector de Alertas  *(legado: `DetectorAlertas` + `domain/detector.js`)*
Cruza **Libro de Estupefacientes** × **Histórico del SADE** (dos `.xlsx`) en un
intervalo de fechas y detecta patrones E01–E12 (§8/§9). Es el módulo con más lógica:
- Lectura robusta: multi-hoja + detección de fila de cabecera (`detectHeaderRow`)
  porque los exports traen títulos/filtros encima de los datos.
- Código V desde su columna propia (Histórico) o embebido en el nombre (Libro).
- Cruce tolerante en 2 pasadas: fuerte (`Código V | cantidad | cantFinal`) y débil
  (`Código V | cantidad | día`). Lo no casado se incluye como “solo Libro”/“solo Histórico”.
- Orden intradía por **secuencia de filas** del Histórico cuando el serial de fecha
  perdió la hora (la de-identificación aplana el decimal del serial Excel → sin hora).
- Diagnóstico visible: nº filas por archivo y tasa de cruce.
- Guarda la tabla completa en la pestaña `Cruces` (`appendMany`).
- Resumen ligero a Inicio (solo recuento del último análisis, sin volcar la lista).

### F4 — Registro de Pedidos  *(legado: `RegistroPedidos`)*
Ciclo: **Pendiente → (aviso de llegada) → Recepción formal → Recibido / Incidencia /
No servido**. Estado calculado (`estadoPedido`). El toggle **“No lo sirven”** hace
**obligatorio** el campo de explicación de incidencia. Único módulo donde se usa **CN**.

### F5 — Registro de Medicamentos Caducados  *(legado: `Caducados`)*
Registro continuo (CN, nombre, lote, fecha caducidad, uds). Buscador + filtro por
rango de fechas. Fuente de datos de la **Declaración Semestral**.

### F6 — Registro de Incidencias  *(legado: `Incidencias`)*
Tarjetas resumen + lista por estado (Pendiente → En revisión → Resuelta). Formulario
con tipo, medicamento (Código V), fecha/hora, movimiento, cantidad, sistema,
descripción, medida correctiva, estado, farmacéutico.

### Configuración — **NUEVO** *(feature `configuracion/`)*
Gestión del **catálogo de medicamentos**: Código V, nombre, grupo (Oral/IV),
MIN y MAX. Hoy el catálogo está hardcodeado en `data/catalogo.js`. Objetivo:
hacerlo **editable y persistente** (nueva pestaña `Catalogo` en el Sheet), sin
romper los módulos que lo consumen (`medByV`, selects de F4/F6, umbrales de F1).
Mantener el catálogo de §9 como **semilla por defecto**.

### Declaraciones — **ANDAMIAJE** *(feature `declaraciones/`)*
Dejar preparadas (rutas, componentes vacíos con TODO, sin lógica completa):
- **Declaración Semestral de Caducados** — se genera a partir de F5.
- **Declaración Anual AEMPS** — a partir de F1 + F4 + F5. Fórmula anual:
  `Stock inicial + Entradas − Roturas − Stock final = Dispensaciones`.

---

## 8. Codificación de alertas del Detector (E01–E12)

`domain/errores.js` → `ERROR_CATALOG`. Críticos (rojo): **E03, E05, E06, E07, E08,
E10, E11**. De vigilar (amarillo): **E01, E02, E04, E09, E12**.

| Código | Nivel | Nombre | Detección (resumen) |
|---|---|---|---|
| E01 | 🟡 | Carga manual sospechosa | `Tipo = Carga` |
| E02 | 🟡 | Descarga manual sospechosa | `Tipo = Descarga` |
| E03 | 🔴 | Corrección rápida dispensación↔devolución | `Dispensación` con una `Devolución` (cualquier fármaco) en ±60 min |
| E04 | 🟡 | Devolución sin dispensación previa | `Devolución` sin `Dispensación` de igual Código V y cantidad similar en ±48 h |
| E05 | 🔴 | Cantidad cero | `Cantidad = 0` |
| E06 | 🔴 | Vale duplicado entre medicamentos | Mismo `Nº Vale` con >1 `Código V` (ignora vales `repo`/entradas sin vale oficial) |
| E07 | 🔴 | Palabra clave de corrección en nota | Texto: error, subsanaci, anulad, compensaci, falso/a |
| E08 | 🔴 | Stock final negativo | `Cantidad Final < 0` |
| E09 | 🟡 | Carga sin variación de stock | `Carga` con `CantFinal(actual) = CantFinal(anterior)` del mismo fármaco |
| E10 | 🔴 | Rotura fuera del SADE sin par completo | `Dispensación` a `99000000` sin su `Devolución` pareada cercana |
| E11 | 🔴 | Descuadre en par de rotura | El par E10 existe pero las cantidades no coinciden |
| E12 | 🟡 | Caducidad sin par completo | Texto “caduc” con destino ≠ `99999944` → revisión manual |

**Reglas generales:** el horario inusual **no** es criterio de alerta; las entradas
sin vale oficial (préstamos, intercambios, mezclas) no son erróneas por defecto;
E12 solo señala para comprobación manual (no confirma).

---

## 9. Catálogo oficial (Código V) + umbrales MIN/MAX

> **Código V es el identificador único** de medicamento en toda la app.
> **El CN (Código Nacional) SOLO se usa en el Registro de Pedidos (F4).**
> Semilla de `data/catalogo.js` y de la nueva pestaña `Catalogo`.

### Orales
| Código V | Estupefaciente | MAX | MIN |
|---|---|---|---|
| V04751 | FENTANILO BUCAL 200 mcg comp | 100 | 50 |
| V04718 | FENTANILO BUCAL 400 mcg comp | 90 | 45 |
| V04740 | FENTANILO BUCAL 600 mcg comp | 0 | 0 |
| V04731 | FENTANILO BUCAL 800 mcg comp | 30 | 15 |
| V00639 | METADONA 5 mg comp or/sonda | 80 | 40 |
| V09424 | MORFINA RÁPIDA 10 mg comp (Sevredol) | 80 | 40 |
| V03592 | MORFINA MST LIB PROLONG 5 mg comp | 360 | 180 |
| V00655 | MORFINA MST LIB PROLONG 10 mg comp | 780 | 390 |
| V00656 | MORFINA MST LIB PROLONG 30 mg comp | 240 | 120 |
| V00657 | MORFINA MST LIB PROLONG 100 mg comp | 60 | 15 |
| V45673 | MORFINA sol oral 2 mg/1 mL 100mL (Oramorph) | 4 | 2 |
| V29931 | OXICODONA RÁPIDA 10 mg caps | 40 | 20 |
| V02175 | OXICODONA LIB PROLONGADA 10 mg comp | 300 | 150 |
| V02208 | OXICODONA LIB PROLONGADA 20 mg comp | 100 | 50 |
| V18636 | OXICODONA 10 mg/mL sol 30mL (Oxynorm) | 10 | 5 |
| T93631 | P METADONA CLORHIDRATO 100 g (O-29) *(materia prima)* | — | — |

### Intravenosos / Parenterales / Transdérmicos
| Código V | Estupefaciente | MAX | MIN |
|---|---|---|---|
| V07610 | FENTANILO 150 mcg/3mL amp | 10000 | 5000 |
| V02257 | FENTANILO TRANSDÉRMICO 100 mcg/h parche | 20 | 10 |
| V02227 | FENTANILO TRANSDÉRMICO 12 mcg/h parche | 200 | 100 |
| V02258 | FENTANILO TRANSDÉRMICO 25 mcg/h parche | 160 | 80 |
| V02256 | FENTANILO TRANSDÉRMICO 50 mcg/h parche | 50 | 30 |
| V02715 | FENTANILO TRANSDÉRMICO 75 mcg/h parche | 20 | 10 |
| V02304 | PETIDINA (MEPERIDINA) 100 mg/2mL amp | 180 | 90 |
| V03200 | METADONA 10 mg/1mL amp IV/SC/ORAL | 48 | 24 |
| V19632 | REMIFENTANILO 1 mg/3mL vial | 60 | 30 |
| V19630 | REMIFENTANILO 5 mg/10mL vial | 700 | 350 |
| V19176 | MORFINA 10 mg/1mL amp 1% | 4000 | 2000 |
| V02015 | MORFINA 2% 20 mL (400 mg) vial parenteral | 40 | 20 |
| Y81210 | MORFINA 400 mg/10mL amp 4% | 20 | 10 |
| V02016 | MORFINA 4% 10 mL (400 mg) ampolla parenteral | 20 | 10 |
| Y50002 | PCA MORFINA 100 mg (mezcla) | 20 | 10 |
| Y94156 | MEZCLA EPI 131 mL BUPI 0,099% + FENTA 0,00019% | 20 | 10 |

**Lógica de umbrales** (`domain/inventario.js` → `stockLevel`), sobre ATHOS REAL:
- `stock ≥ MAX` → 🟢 óptimo, sin acción.
- `MIN ≤ stock < MAX` → 🟡 pedir a laboratorio (Seflogic®).
- `stock < MIN` → 🔴 pedir urgente a cooperativa (COFARTE).

---

## 10. Exports del SADE y lógica de cruce

**Fecha = serial de Excel** (días desde 30/12/1899); la hora vive en el decimal.
Conversión: `fecha = new Date(Math.round((serial − 25569) * 86400 * 1000))`.
La de-identificación previa a veces aplana el decimal → **sin hora**; por eso el
Detector usa la **secuencia de filas** del Histórico (estrictamente cronológico)
como línea temporal intradía de respaldo.

**Libro de Estupefacientes:** Estupefaciente (nombre + Código V), Fecha, Número Vale,
Tipo, Proveedor, Nota, Cantidad, Unidad de Enfermería, Cantidad Final.
→ El Código V va **embebido en el nombre**.

**Histórico del SADE:** Dispensador, Descripción, Medicamento (+ **Medicamento Código**),
Fecha, Tipo (HistoricoDispensacion/Reposicion/Devolucion), Suma (+/−), Cantidad,
Cantidad Final, **Cantidad Final Dispensador**, Armario/Fila/Columna/Sección,
Unidad de Enfermería, Servicio, **Usuario**.
→ El Código V tiene **columna propia**.

**Clave de cruce ideal:** `Código V + Fecha/hora exacta + Cantidad`. Como la hora
puede faltar, se aplican las 2 pasadas tolerantes descritas en F3.

---

## 11. Semántica del SADE (movimientos, ficticios, rotura)

**Tipos de movimiento:** Dispensación, Devolución, Reposición, Carga, Descarga, Retirada.
Los vales de **reposición** usan texto libre (“repo”, “repo q-4”, “repo athos en06-1”…):
es normal, no se marcan como erróneos.

**Entradas sin vale oficial:** Intercambio H. Sur (`INTERCAMBIO`/`H. SUR`), Mezclas
(`NOMBRE MEZCLA`/`CAMPANAS`), Préstamo (`PRÉSTAMO`/`HOSPITAL`), Fórmulas
(`METADONA`/`FARMACOTECNIA`).

**Pacientes ficticios (salidas especiales):**
`99000000` Rotura en Farmacia (genera mov. FARMATOOLS), `99999944` Caducados Farmacia
(genera mov.), `99990000` Farmacotecnia, `99999000` Préstamo, `99999943` H. Sur,
`99990010` Campanas, `0203` Kit Lore.

**Procedimiento de rotura (siempre 2 movimientos pareados):**
1. **DEVOLUCIÓN** al SADE de las unidades rotas no repuestas.
2. **DISPENSACIÓN** de esas mismas unidades al ficticio `99000000`.
Falta uno / cantidades distintas → **E10 / E11**.

---

## 12. Principios de desarrollo (obligatorios)

1. **Privacidad de pacientes** por encima de todo (§1).
2. **El recuento físico (ATHOS REAL) es la verdad absoluta**; los descuadres se
   atribuyen a ATHOS D07 o a Maestro, nunca al conteo físico.
3. **Código V es el identificador único**; el CN solo aparece en F4.
4. **Paridad primero**: durante la migración no cambies comportamiento de negocio.
   Refactor estructural ≠ cambio funcional. Cualquier cambio de lógica se propone y
   se confirma antes (para poder reportarlo a Karen y Sara).
5. **Actualización del prototipo bajo demanda**: definir/discutir una funcionalidad
   **no** implica tocar código. Solo se implementa lo solicitado explícitamente.
6. **Diagnóstico antes de reescribir**: ante un bug, propón la causa raíz antes de
   cambiar el código (el Detector se estabilizó así).
7. Entregables de trabajo pesado (documentos, catálogos) como archivos descargables.

---

## 13. Diseño (design tokens)

- Sidebar índigo oscuro `#1E1B4B` con patrón de puntos radial.
- Acento `#6366F1`; fondo `#F5F6FA`; tarjetas blancas, borde `#E5E7EB`.
- Alertas: **amarillo** (`#CA8A04`/`#FEF9C3`) = descuadre 1–10, vigilar, o “pedir a
  laboratorio”; **rojo** (`#DC2626`/`#FEE2E2`) = descuadre >10, crítico, o bajo mínimo;
  **verde** (`#16A34A`/`#DCFCE7`) = OK.
- Formularios en **drawer** deslizante desde la derecha.
- Toggle Orales/Intravenosos con iconos (`Pill`/`Syringe`).
- Todo el sistema de estilos y las primitivas (`Badge`, `Card`, `Drawer`, `StatCard`,
  `Field`, `GroupToggle`, `Empty`) se extraen del legado a `theme.js` + `components/ui/`.

---

## 14. Cómo trabajar en este repo (para Claude Code)

- Arranque: `cd frontend && npm install && npm run dev`.
- Antes de migrar un módulo, **abre el bloque correspondiente en
  `docs/legacy/GestorEstupefacientes.jsx`** y respeta su comportamiento.
- Trabaja **incrementalmente y verificando paridad** tras cada extracción; no muevas
  todo de golpe.
- No añadas dependencias nuevas sin justificarlo.
- No inventes Códigos V ni umbrales: usa exactamente §9. (Históricamente hubo códigos
  inventados; la tabla de §9 es la única válida.)
- Mantén el **modo local** funcionando sin backend.
- Cualquier duda funcional que no resuelvan estos docs → **pregunta**, no asumas.
