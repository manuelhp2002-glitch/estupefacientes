// =============================================================================
// Lógica PURA de sincronización de pedidos (F4) desde el Sheet compartido
// "ESTUPEFACIENTES REGISTRO PEDIDOS" (pestaña 2026). Sin efectos ni llamadas de red.
// Reutiliza toDate() y estadoPedido() del monolito, INYECTADOS en `deps`, para no
// duplicar su lógica. Se exporta además pareceNombrePersona() (misma regex que el
// Detector) para el guard de privacidad (#1).
// =============================================================================

// Cabecera normalizada: mayúsculas, sin acentos, espacios colapsados.
function headerKey(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
}

const COLS = {
  vale: "VALE",
  cn: "CN",
  estupefaciente: "ESTUPEFACIENTE",
  fechaPedido: "FECHA PEDIDO",
  udsPedidas: "UDS PEDIDAS",
  fechaEntrada: "FECHA ENTRADA",
  udsRecibidas: "UDS RECIBIDAS",
  proveedor: "PROVEEDOR",
  farmaceutico: "FARMACEUTICO QUE RECEPCIONA",
  incidencias: "INCIDENCIAS",
};
const OBLIGATORIAS = ["vale", "cn", "fechaPedido", "udsPedidas"];

function mapColumnas(headers) {
  const keys = (headers || []).map(headerKey);
  const idx = {};
  for (const campo in COLS) idx[campo] = keys.indexOf(headerKey(COLS[campo]));
  const faltan = OBLIGATORIAS.filter((c) => idx[c] < 0).map((c) => COLS[c]);
  return { idx, faltan };
}

// Marcadores de vale nulo / pedido no servido (sin distinguir mayúsculas).
const RE_NULO = /(vale\s*nulo|no\s*lo\s*sirven|anulad|nulo)/i;
// Mismo patrón "Nombre Apellido" que usa el Detector para posibles nombres de paciente.
const RE_NOMBRE = /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/;

export function pareceNombrePersona(txt) {
  return RE_NOMBRE.test(String(txt || ""));
}

const p2 = (n) => String(n).padStart(2, "0");

// Parsea dd/mm/aaaa, dd/mm/aa, d/m/aa → { iso } | { iso, corregible, problema } |
// { vacia } | { ilegible }. Normaliza a "YYYY-MM-DD" (el formato que usa F4).
// NOTA (desviación de §4.2 documentada en el PR): para un año de 4+ cifras fuera de
// 2000–2100 se propone el AÑO ACTUAL (no `2000 + año%100`). La fórmula literal daría
// 2006 para «0206», contradiciendo §6 (que espera 2026) y además la fila caería por
// debajo del corte y desaparecería. El año actual conserva día/mes y es lo que la
// fixture y el uso real esperan.
function parseFecha(txt, anioActual) {
  const s = String(txt == null ? "" : txt).trim();
  if (!s) return { vacia: true };
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,5})$/);
  if (!m) return { ilegible: true };
  const d = +m[1], mes = +m[2], ytok = m[3];
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return { ilegible: true };
  let year = +ytok, corregible = false, problema = null;
  if (ytok.length <= 2) {
    year = 2000 + year;
  } else if (year < 2000 || year > 2100) {
    const prop = anioActual || new Date().getFullYear();
    problema = `Año «${ytok}» corregido a ${prop}`;
    year = prop;
    corregible = true;
  }
  return { iso: `${year}-${p2(mes)}-${p2(d)}`, corregible, problema };
}

// Igualdad de dos fechas por día usando el toDate() real (el servidor devuelve ISO).
function mismaFecha(toDate, a, b) {
  if ((a == null || a === "") && (b == null || b === "")) return true;
  const da = toDate(a), db = toDate(b);
  if (!da && !db) return true;
  if (!da || !db) return false;
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

const CAMPOS_COMPARAR = ["fechaPedido", "udsPedidas", "fechaEntrada", "udsRecibidas", "proveedor", "farmaceutico", "incidencias", "noServido"];
const RECEPCIONADO = ["Recibido", "Incidencia", "No servido"];

// planSincronizacion(sheet, pedidosApp, cnCatalogo, catalogo, corteISO, { toDate, estadoPedido })
//   sheet       = { headers:[...], rows:[[...],...] }  (getDisplayValues del Sheet)
//   pedidosApp  = pedidos de la app (estado del servidor)
//   cnCatalogo  = [{ cn, codigoV, proveedor, marca? }]
//   catalogo    = meds [{ codigoV, nombre, grupo, min, max }]
//   corteISO    = "YYYY-MM-DD" (solo filas con FECHA PEDIDO >= corte)
// → { add:[row], upd:[{id, vale, cambios:[{campo,de,a}], row}], rev:[{vale, problemas, corregible, original, row, fechaCorregida}] }
//   o { error } si faltan columnas obligatorias.
export function planSincronizacion(sheet, pedidosApp, cnCatalogo, catalogo, corteISO, deps) {
  const toDate = deps.toDate, estadoPedido = deps.estadoPedido;
  const anioActual = deps.anioActual || new Date().getFullYear();
  const headers = (sheet && sheet.headers) || [];
  const rows = (sheet && sheet.rows) || [];
  const { idx, faltan } = mapColumnas(headers);
  if (faltan.length) return { error: `Faltan columnas obligatorias en el Sheet: ${faltan.join(", ")}` };

  const cnMap = {};
  (cnCatalogo || []).forEach((e) => { if (e && e.cn != null) cnMap[String(e.cn).trim()] = e; });
  const nombrePorV = {};
  (catalogo || []).forEach((m) => { if (m && m.codigoV) nombrePorV[m.codigoV] = m.nombre; });
  const pedidoPorVale = {};
  (pedidosApp || []).forEach((p) => { const v = String(p.vale || "").trim().toLowerCase(); if (v) pedidoPorVale[v] = p; });

  const cell = (row, campo) => (idx[campo] >= 0 ? String(row[idx[campo]] == null ? "" : row[idx[campo]]).trim() : "");

  // Filas dentro del corte (las anteriores no se tocan jamás). Fecha ilegible/vacía
  // se deja pasar para que aparezca en "revisar" en lugar de descartarse en silencio.
  const enAlcance = [];
  for (const row of rows) {
    const fp = parseFecha(cell(row, "fechaPedido"), anioActual);
    if (fp.iso && corteISO && fp.iso < corteISO) continue;
    enAlcance.push({ row, valeRaw: cell(row, "vale"), fp });
  }
  const conteoVale = {};
  enAlcance.forEach((x) => { const v = x.valeRaw.toLowerCase(); if (v) conteoVale[v] = (conteoVale[v] || 0) + 1; });

  const add = [], upd = [], rev = [];

  for (const { row, valeRaw, fp } of enAlcance) {
    const problemas = [];

    if (!valeRaw) problemas.push("Fila sin nº de vale");
    else if (conteoVale[valeRaw.toLowerCase()] > 1) problemas.push("Nº de vale duplicado dentro del Sheet");

    const fechaPedido = fp.iso || "";
    if (fp.vacia) problemas.push("Falta la fecha de pedido");
    else if (fp.ilegible) problemas.push(`Fecha de pedido ilegible: «${cell(row, "fechaPedido")}»`);
    else if (fp.problema) problemas.push(fp.problema);
    const problemaSoloFecha = !!fp.problema;

    // Vale nulo / no servido
    const esNulo = [cell(row, "cn"), cell(row, "estupefaciente"), cell(row, "udsRecibidas"), cell(row, "farmaceutico"), cell(row, "incidencias")].some((c) => RE_NULO.test(c));

    // Medicamento por CN (el texto ESTUPEFACIENTE nunca identifica el fármaco)
    const cnRaw = cell(row, "cn").replace(/\s+/g, "");
    const cnEntry = cnMap[cnRaw];
    let estupefaciente = "";
    if (cnEntry) {
      const nom = nombrePorV[cnEntry.codigoV] || "";
      estupefaciente = `${cnEntry.codigoV}${nom ? " · " + nom : ""}`;
    } else {
      problemas.push(`CN «${cnRaw || "(vacío)"}» no está en el catálogo`);
    }

    // Incidencias + guard de privacidad (#1)
    let incidencias = cell(row, "incidencias");
    let nombreDetectado = false;
    if (incidencias && pareceNombrePersona(incidencias)) {
      problemas.push("Posible nombre de paciente en incidencias: revisar en el Sheet");
      incidencias = "";
      nombreDetectado = true;
    }

    // Construcción del pedido destino (todos los campos que usa F4)
    const fe = parseFecha(cell(row, "fechaEntrada"), anioActual);
    const base = {
      vale: valeRaw, cn: cnRaw, estupefaciente,
      proveedor: cell(row, "proveedor") || (cnEntry && cnEntry.proveedor) || "",
      fechaPedido, udsPedidas: cell(row, "udsPedidas"), uds: cell(row, "udsPedidas"),
      incidenciasPrevias: "", avisoLlegada: false, horaAviso: "",
    };
    let destino;
    if (esNulo) {
      destino = { ...base, fechaEntrada: "", udsRecibidas: "", farmaceutico: "", noServido: true, incidencias: incidencias || "NULO", estado: "No servido" };
    } else {
      destino = { ...base, fechaEntrada: fe.iso || "", udsRecibidas: cell(row, "udsRecibidas"), farmaceutico: cell(row, "farmaceutico"), noServido: false, incidencias };
      destino.estado = estadoPedido(destino);
    }

    // corregible solo si el ÚNICO problema es el año de fecha, hay CN válido y no hay nombre
    const corregible = problemaSoloFecha && !!cnEntry && !nombreDetectado && problemas.length === 1;

    if (problemas.length) {
      rev.push({
        vale: valeRaw, problemas, corregible,
        original: { fechaPedido: cell(row, "fechaPedido"), cn: cnRaw, estupefaciente: cell(row, "estupefaciente"), incidencias: cell(row, "incidencias") },
        row: corregible ? destino : null,
        fechaCorregida: corregible ? fechaPedido : null,
      });
      continue;
    }

    const actual = pedidoPorVale[valeRaw.toLowerCase()];
    if (!actual) { add.push(destino); continue; }

    // Regla de NO-RETROCESO: si la app ya tiene recepción (Recibido/Incidencia/No
    // servido) y la fila del Sheet no la refleja (implicaría "Pendiente"), NO se
    // sobrescribe: va a revisar (no corregible) para que una persona lo mire.
    const estadoApp = estadoPedido(actual);
    if (RECEPCIONADO.indexOf(estadoApp) >= 0 && destino.estado === "Pendiente") {
      rev.push({
        vale: valeRaw,
        problemas: ["La app tiene una recepción que no está en el Sheet"],
        corregible: false,
        original: { fechaPedido: cell(row, "fechaPedido"), cn: cnRaw, estupefaciente: cell(row, "estupefaciente"), incidencias: cell(row, "incidencias") },
        row: null, fechaCorregida: null,
      });
      continue;
    }

    const esVacio = (v) => v === "" || v == null;
    const cambios = [];
    for (const campo of CAMPOS_COMPARAR) {
      const de = actual[campo], a = destino[campo];
      // "Vacío del Sheet no sobrescribe": si el Sheet no trae dato y la app sí, se ignora.
      if (esVacio(a) && !esVacio(de)) continue;
      let dif;
      if (campo === "fechaPedido" || campo === "fechaEntrada") dif = !mismaFecha(toDate, de, a);
      else if (campo === "udsPedidas" || campo === "udsRecibidas") dif = (esVacio(de) ? "" : String(Number(de))) !== (esVacio(a) ? "" : String(Number(a)));
      else if (campo === "noServido") dif = !!de !== !!a;
      else dif = String(esVacio(de) ? "" : de).trim() !== String(esVacio(a) ? "" : a).trim();
      if (dif) cambios.push({ campo, de, a });
    }
    if (cambios.length) {
      const merged = { ...actual };
      cambios.forEach((c) => { merged[c.campo] = c.a; });
      const estadoMerged = estadoPedido(merged);
      merged.estado = estadoMerged;
      if (estadoMerged !== estadoApp) cambios.push({ campo: "estado", de: estadoApp, a: estadoMerged });
      upd.push({ id: actual.id, vale: valeRaw, cambios, row: merged });
    }
  }

  return { add, upd, rev };
}
