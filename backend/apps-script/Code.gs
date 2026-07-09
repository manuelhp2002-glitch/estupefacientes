/**
 * EstupeFarma — Backend Google Apps Script (Web App sobre Google Sheets)
 * ---------------------------------------------------------------------------
 * Contrato (ver CLAUDE.md §5): el frontend hace POST con
 *   Content-Type: text/plain;charset=utf-8  (evita el preflight CORS)
 *   body: { "action": "<accion>", "payload": { ... } }
 *
 * Acciones: list | append | appendMany | update | remove
 * Modelo: cada fila es un objeto JSON con clave `id`. Mapeo por CABECERA (no por
 * índice posicional); las columnas se auto-extienden si llega una clave nueva.
 *
 * Regla ABSOLUTA (CLAUDE.md §1): nunca se almacenan nombres de paciente.
 *
 * Helpers de administración (ejecutar MANUALMENTE desde el editor, seleccionándolos
 * en el desplegable de funciones — NO vía HTTP):
 *   - setup()        crea todas las pestañas y siembra el catálogo (no destructivo).
 *   - setupCruces()  crea solo la pestaña Cruces sin tocar el resto.
 */

// Si el script está VINCULADO a la hoja (Extensiones → Apps Script), déjalo vacío y
// se usa la hoja activa. Si es standalone, pon aquí el ID de la Spreadsheet.
var SPREADSHEET_ID = "";

function ss_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  var a = SpreadsheetApp.getActiveSpreadsheet();
  if (!a) throw new Error("No hay Spreadsheet vinculada; define SPREADSHEET_ID.");
  return a;
}

// Cabeceras base por pestaña (id siempre la primera). Se auto-extienden en escritura.
var HEADERS = {
  Inventarios: ["id", "fecha", "grupo", "codigoV", "nombre", "real", "d07", "maestro", "descRealD07", "descD07Maestro"],
  Pedidos: ["id", "vale", "cn", "estupefaciente", "proveedor", "fechaPedido", "udsPedidas", "udsRecibidas", "fechaEntrada", "farmaceutico", "noServido", "incidencias", "avisoLlegada", "horaAviso", "uds", "estado", "incidenciasPrevias"],
  Caducados: ["id", "cn", "nombre", "lote", "fechaCaducidad", "unidades"],
  Incidencias: ["id", "tipo", "medicamento", "fechaHora", "movimiento", "cantidad", "sistema", "descripcion", "medida", "estado", "farmaceutico"],
  Cruces: ["id", "medicamento", "codigoV", "fecha", "tipo", "medico", "cantidad", "cantFinal", "usuario", "alertas", "nivel", "intervalo"],
  Catalogo: ["id", "codigoV", "nombre", "grupo", "min", "max"]
};

// Guard de privacidad (§1): campos de nota/observación de importación donde NO debe
// aparecer un nombre de paciente. Deliberadamente ACOTADO: no incluye campos de
// formulario del personal (descripcion, incidencias, movimiento) ni de personal
// (farmaceutico/medico/usuario), que son legítimos y provocarían falsos positivos.
var FREE_TEXT_FIELDS = ["nota", "notas", "observacion", "observaciones"];
var NAME_RE = /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/;

/* ===========================================================================
   HTTP
=========================================================================== */
function doGet(e) {
  return json_({ status: "ok", app: "EstupeFarma", ts: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (err) { return json_({ error: "Servidor ocupado, reinténtalo." }); }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var p = body.payload || {};
    var out;
    switch (body.action) {
      case "list":       out = listRows_(p.sheet); break;
      case "append":     out = appendRow_(p.sheet, p.row); break;
      case "appendMany": out = appendMany_(p.sheet, p.rows); break;
      case "update":     out = updateRow_(p.sheet, p.id, p.row); break;
      case "remove":     out = removeRow_(p.sheet, p.id); break;
      case "ping":       out = { status: "ok" }; break;
      default:           out = { error: "Acción no reconocida: " + body.action };
    }
    return json_(out);
  } catch (err) {
    return json_({ error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===========================================================================
   HOJAS / CABECERAS
=========================================================================== */
function getSheet_(name) {
  if (!name || !HEADERS[name]) throw new Error("Pestaña no permitida: " + name);
  var s = ss_().getSheetByName(name);
  if (!s) { s = ss_().insertSheet(name); s.appendRow(HEADERS[name]); }
  if (s.getLastRow() === 0) s.appendRow(HEADERS[name]);
  return s;
}
function headerRow_(s) {
  var lastCol = Math.max(1, s.getLastColumn());
  return s.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h); });
}
// Garantiza una columna por cada clave; devuelve las cabeceras (posiblemente ampliadas).
function ensureHeaders_(s, keys) {
  var headers = headerRow_(s);
  var added = false;
  keys.forEach(function (k) { if (headers.indexOf(k) === -1) { headers.push(k); added = true; } });
  if (added) s.getRange(1, 1, 1, headers.length).setValues([headers]);
  return headers;
}

/* ===========================================================================
   GUARD DE PRIVACIDAD (§1)
=========================================================================== */
function privacyViolationField_(row) {
  for (var k in row) {
    if (FREE_TEXT_FIELDS.indexOf(k) === -1) continue;
    var v = row[k];
    if (typeof v === "string" && NAME_RE.test(v)) return k;
  }
  return null;
}

/* ===========================================================================
   OPERACIONES
=========================================================================== */
function listRows_(name) {
  var s = getSheet_(name);
  var headers = headerRow_(s);
  var lastRow = s.getLastRow();
  if (lastRow < 2) return { rows: [] };
  var values = s.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var rows = values.map(function (r) {
    var o = {};
    headers.forEach(function (h, i) { if (h) o[h] = r[i]; });
    return o;
  }).filter(function (o) { return o.id !== "" && o.id != null; });
  return { rows: rows };
}

function findRowIndexById_(s, headers, id) {
  var idCol = headers.indexOf("id");
  if (idCol === -1) return -1;
  var lastRow = s.getLastRow();
  if (lastRow < 2) return -1;
  var ids = s.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // fila real (1-based + cabecera)
  }
  return -1;
}

function appendRow_(name, row) {
  if (!row || row.id == null || row.id === "") throw new Error("append requiere un 'id'.");
  var bad = privacyViolationField_(row);
  if (bad) {
    Logger.log("Fila rechazada por posible nombre de paciente en campo '" + bad + "' (hoja " + name + ")");
    return { ok: true, skipped: "privacy" };
  }
  var s = getSheet_(name);
  var headers = ensureHeaders_(s, Object.keys(row));
  if (findRowIndexById_(s, headers, row.id) !== -1) return { ok: true, dup: true }; // idempotente
  var line = headers.map(function (h) { return row[h] != null ? row[h] : ""; });
  s.appendRow(line);
  return { ok: true };
}

function appendMany_(name, rows) {
  rows = rows || [];
  var added = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = appendRow_(name, rows[i]);
    if (r && r.ok && !r.dup && !r.skipped) added++;
  }
  return { added: added };
}

function updateRow_(name, id, row) {
  if (id == null || id === "") throw new Error("update requiere 'id'.");
  var bad = privacyViolationField_(row || {});
  if (bad) {
    Logger.log("Update rechazado por posible nombre de paciente en campo '" + bad + "' (hoja " + name + ")");
    return { ok: true, skipped: "privacy" };
  }
  var s = getSheet_(name);
  var headers = ensureHeaders_(s, Object.keys(row || {}));
  var rowIdx = findRowIndexById_(s, headers, id);
  if (rowIdx === -1) throw new Error("No existe el id " + id + " en " + name);
  var current = s.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  var merged = headers.map(function (h, i) { return (row && row[h] != null) ? row[h] : current[i]; });
  s.getRange(rowIdx, 1, 1, headers.length).setValues([merged]);
  return { ok: true };
}

function removeRow_(name, id) {
  if (id == null || id === "") throw new Error("remove requiere 'id'.");
  var s = getSheet_(name);
  var headers = headerRow_(s);
  var rowIdx = findRowIndexById_(s, headers, id);
  if (rowIdx === -1) throw new Error("No existe el id " + id + " en " + name);
  s.deleteRow(rowIdx);
  return { ok: true };
}

/* ===========================================================================
   ADMINISTRACIÓN (ejecutar manualmente desde el editor)
=========================================================================== */
// Catálogo oficial Código V (CLAUDE.md §9). Orden: codigoV, nombre, grupo, MIN, MAX.
var SEED_CATALOGO = [
  ["V04751", "FENTANILO BUCAL 200 mcg comp", "ORAL", 50, 100],
  ["V04718", "FENTANILO BUCAL 400 mcg comp", "ORAL", 45, 90],
  ["V04740", "FENTANILO BUCAL 600 mcg comp", "ORAL", 0, 0],
  ["V04731", "FENTANILO BUCAL 800 mcg comp", "ORAL", 15, 30],
  ["V00639", "METADONA 5 mg comp or/sonda", "ORAL", 40, 80],
  ["V09424", "MORFINA RÁPIDA 10 mg comp (Sevredol)", "ORAL", 40, 80],
  ["V03592", "MORFINA MST LIB PROLONG 5 mg comp", "ORAL", 180, 360],
  ["V00655", "MORFINA MST LIB PROLONG 10 mg comp", "ORAL", 390, 780],
  ["V00656", "MORFINA MST LIB PROLONG 30 mg comp", "ORAL", 120, 240],
  ["V00657", "MORFINA MST LIB PROLONG 100 mg comp", "ORAL", 15, 60],
  ["V45673", "MORFINA sol oral 2 mg/1 mL 100mL (Oramorph)", "ORAL", 2, 4],
  ["V29931", "OXICODONA RÁPIDA 10 mg caps", "ORAL", 20, 40],
  ["V02175", "OXICODONA LIB PROLONGADA 10 mg comp", "ORAL", 150, 300],
  ["V02208", "OXICODONA LIB PROLONGADA 20 mg comp", "ORAL", 50, 100],
  ["V18636", "OXICODONA 10 mg/mL sol 30mL (Oxynorm)", "ORAL", 5, 10],
  ["T93631", "P METADONA CLORHIDRATO 100 g (O-29)", "ORAL", "", ""],
  ["V07610", "FENTANILO 150 mcg/3mL amp", "IV", 5000, 10000],
  ["V02257", "FENTANILO TRANSDÉRMICO 100 mcg/h parche", "IV", 10, 20],
  ["V02227", "FENTANILO TRANSDÉRMICO 12 mcg/h parche", "IV", 100, 200],
  ["V02258", "FENTANILO TRANSDÉRMICO 25 mcg/h parche", "IV", 80, 160],
  ["V02256", "FENTANILO TRANSDÉRMICO 50 mcg/h parche", "IV", 30, 50],
  ["V02715", "FENTANILO TRANSDÉRMICO 75 mcg/h parche", "IV", 10, 20],
  ["V02304", "PETIDINA (MEPERIDINA) 100 mg/2mL amp", "IV", 90, 180],
  ["V03200", "METADONA 10 mg/1mL amp IV/SC/ORAL", "IV", 24, 48],
  ["V19632", "REMIFENTANILO 1 mg/3mL vial", "IV", 30, 60],
  ["V19630", "REMIFENTANILO 5 mg/10mL vial", "IV", 350, 700],
  ["V19176", "MORFINA 10 mg/1mL amp 1%", "IV", 2000, 4000],
  ["V02015", "MORFINA 2% 20 mL (400 mg) vial parenteral", "IV", 20, 40],
  ["Y81210", "MORFINA 400 mg/10mL amp 4%", "IV", 10, 20],
  ["V02016", "MORFINA 4% 10 mL (400 mg) ampolla parenteral", "IV", 10, 20],
  ["Y50002", "PCA MORFINA 100 mg (mezcla)", "IV", 10, 20],
  ["Y94156", "MEZCLA EPI 131 mL BUPI 0,099% + FENTA 0,00019%", "IV", 10, 20]
];

function setup() {
  var ss = ss_();
  Object.keys(HEADERS).forEach(function (name) {
    var s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name);
    if (s.getLastRow() === 0) s.appendRow(HEADERS[name]);
  });
  seedCatalogo_();
  return "setup ok — hojas: " + Object.keys(HEADERS).join(", ");
}

function seedCatalogo_() {
  var ss = ss_();
  var s = ss.getSheetByName("Catalogo") || ss.insertSheet("Catalogo");
  if (s.getLastRow() === 0) s.appendRow(HEADERS.Catalogo);
  if (s.getLastRow() > 1) return; // ya sembrada: no duplicar
  var now = Date.now();
  var rows = SEED_CATALOGO.map(function (m, i) {
    return ["cat" + (now + i).toString(36), m[0], m[1], m[2], m[3], m[4]]; // id, codigoV, nombre, grupo, min, max
  });
  s.getRange(2, 1, rows.length, HEADERS.Catalogo.length).setValues(rows);
}

function setupCruces() {
  var ss = ss_();
  var s = ss.getSheetByName("Cruces");
  if (!s) { s = ss.insertSheet("Cruces"); s.appendRow(HEADERS.Cruces); }
  return "Cruces ok";
}
