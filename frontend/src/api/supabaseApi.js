/* ============================================================================
   CAPA DE DATOS — Supabase
   Misma interfaz que makeApi() (Apps Script) para que el resto de la app no
   cambie: list / append / appendMany / update / remove / leerRegistroPedidos.

   La app trabaja con objetos "estilo Sheets" (claves camelCase, celdas vacías
   como "", fechas como ISO "…Z"). Este módulo traduce en ambos sentidos:
     app  → BD : camelCase → snake_case, "" → null, fechas/números/booleanos
                 tipados; claves desconocidas → columna `extra` (jsonb).
     BD   → app: snake_case → camelCase, null → "", fechas → ISO "…Z",
                 claves de `extra` devueltas tal cual.
   Un valor que no encaja en su tipo (p. ej. "240??" en un número) no se pierde:
   se guarda en extra.<campo>__raw y se devuelve igual que llegó.

   Regla de privacidad (CLAUDE.md §1): mismo guard que Code.gs en notas de
   importación. Nunca se guardan nombres de paciente.
============================================================================ */
import { createClient } from "@supabase/supabase-js";

// Error que no se arregla reintentando (restricción de la BD, id inexistente,
// borrado no permitido…). La cola lo aparta en vez de quedarse atascada.
export class PermanentError extends Error {
  constructor(msg) { super(msg); this.name = "PermanentError"; this.permanent = true; }
}

// Pestaña de la app → tabla y tipos de sus columnas (camelCase de la app)
const T = { text: "text", int: "int", num: "num", bool: "bool", date: "date" };
export const SCHEMA = {
  Inventarios: { table: "inventarios", fields: { fecha: T.date, grupo: T.text, codigoV: T.text, nombre: T.text, real: T.int, d07: T.int, maestro: T.int, descRealD07: T.int, descD07Maestro: T.int } },
  Pedidos: { table: "pedidos", fields: { vale: T.text, cn: T.text, estupefaciente: T.text, proveedor: T.text, fechaPedido: T.date, udsPedidas: T.int, uds: T.int, udsRecibidas: T.int, fechaEntrada: T.date, farmaceutico: T.text, noServido: T.bool, incidencias: T.text, incidenciasPrevias: T.text, avisoLlegada: T.bool, horaAviso: T.date, estado: T.text } },
  Caducados: { table: "caducados", fields: { cn: T.text, nombre: T.text, lote: T.text, fechaCaducidad: T.date, unidades: T.int, declaracion: T.text } },
  Incidencias: { table: "incidencias", fields: { tipo: T.text, tipoOtro: T.text, medicamento: T.text, fechaHora: T.date, movimiento: T.text, cantidad: T.int, sistema: T.text, descripcion: T.text, medida: T.text, estado: T.text, farmaceutico: T.text } },
  Cruces: { table: "cruces", fields: { medicamento: T.text, codigoV: T.text, fecha: T.date, tipo: T.text, medico: T.text, cantidad: T.num, cantFinal: T.num, usuario: T.text, alertas: T.text, nivel: T.text, intervalo: T.text } },
  Alertas: { table: "alertas", fields: { origen: T.text, tipo: T.text, codigos: T.text, codigoV: T.text, medicamento: T.text, nivel: T.text, fecha: T.date, detalle: T.text, estado: T.text } },
  Consumos: { table: "consumos", fields: { codigoV: T.text, media: T.num, origen: T.text, fechaCarga: T.date } },
  Catalogo: { table: "catalogo", fields: { codigoV: T.text, nombre: T.text, grupo: T.text, min: T.int, max: T.int } },
  // Filas especiales de "Catalogo" (id __config__, __cncatalog__, __declaraciones__)
  AppConfig: { table: "app_config", fields: { nombre: T.text, json: T.text } },
};
export const TABLAS = Object.values(SCHEMA).map((s) => s.table);
const esIdEspecial = (id) => /^__[a-z_]+__$/.test(String(id || ""));
// En Sheets, Catalogo llevaba también las filas especiales: se enrutan a app_config
function destino(sheet, id) {
  if (sheet === "Catalogo" && esIdEspecial(id)) return SCHEMA.AppConfig;
  const s = SCHEMA[sheet];
  if (!s) throw new PermanentError("Pestaña no permitida: " + sheet);
  return s;
}

const snake = (k) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()).replace(/([a-z])(\d)/g, "$1_$2");
const camel = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
// Columnas cuyo nombre no sale de la regla automática
const SNAKE_FIX = { descRealD07: "desc_real_d07", descD07Maestro: "desc_d07_maestro", d07: "d07", codigoV: "codigo_v" };
const toCol = (k) => SNAKE_FIX[k] || snake(k);
const COL_FIX = Object.fromEntries(Object.entries(SNAKE_FIX).map(([a, b]) => [b, a]));
const toKey = (c) => COL_FIX[c] || camel(c);

/* ---------------------------------------------------------------------------
   Conversión de valores
--------------------------------------------------------------------------- */
const pad = (n) => String(n).padStart(2, "0");
// Fecha tal como la interpretaba Sheets (zona del navegador = Canarias).
// Devuelve un ISO "…Z" o undefined si no se puede leer.
export function parseFecha(v) {
  if (v instanceof Date) return isNaN(v) ? undefined : v.toISOString();
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, +m[3]).toISOString();
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/))) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).toISOString();
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/))) {
    const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return d.getMonth() === +m[2] - 1 ? d.toISOString() : undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(s)) { const d = new Date(s); return isNaN(d) ? undefined : d.toISOString(); }
  return undefined;
}
function convertir(tipo, v) {
  // Los booleanos de la app son "no marcado" cuando vienen vacíos (columna NOT NULL)
  if ((v === "" || v == null) && tipo === T.bool) return { ok: true, v: false };
  if (v === "" || v == null) return { ok: true, v: null };
  switch (tipo) {
    case T.int: { const n = Number(v); return Number.isInteger(n) ? { ok: true, v: n } : { ok: false }; }
    case T.num: { const n = Number(v); return Number.isFinite(n) ? { ok: true, v: n } : { ok: false }; }
    case T.bool: {
      if (v === true || v === false) return { ok: true, v };
      const s = String(v).trim().toLowerCase();
      if (s === "true" || s === "verdadero") return { ok: true, v: true };
      if (s === "false" || s === "falso") return { ok: true, v: false };
      return { ok: false };
    }
    case T.date: { const iso = parseFecha(v); return iso ? { ok: true, v: iso } : { ok: false }; }
    default: return { ok: true, v: typeof v === "string" ? v : String(v) };
  }
}

// Objeto de la app → fila de la BD. `parcial`: solo las claves presentes (update).
export function aFila(schema, obj) {
  const fila = {}; const extra = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (k === "id") { fila.id = String(v); continue; }
    if (k === "extra" || k === "createdAt" || k === "updatedAt") continue;
    const tipo = schema.fields[k];
    if (!tipo) { if (v !== undefined) extra[k] = v; continue; }
    const r = convertir(tipo, v);
    if (r.ok) fila[toCol(k)] = r.v;
    else { fila[toCol(k)] = null; extra[k + "__raw"] = v; }
  }
  return { fila, extra };
}

// Fila de la BD → objeto de la app (como lo devolvía Sheets)
export function aObjeto(schema, fila) {
  const o = {};
  const extra = fila.extra || {};
  for (const [c, v] of Object.entries(fila)) {
    if (c === "extra" || c === "created_at" || c === "updated_at") continue;
    const k = toKey(c);
    const tipo = c === "id" ? T.text : schema.fields[k];
    if (v == null) { o[k] = extra[k + "__raw"] !== undefined ? extra[k + "__raw"] : ""; continue; }
    o[k] = tipo === T.date ? new Date(v).toISOString() : (tipo === T.num || tipo === T.int) ? Number(v) : v;
  }
  for (const [k, v] of Object.entries(extra)) if (!k.endsWith("__raw") && !(k in o)) o[k] = v;
  return o;
}

/* ---------------------------------------------------------------------------
   Guard de privacidad (igual que Code.gs): notas de importación con aspecto de
   "Nombre Apellido" no se guardan.
--------------------------------------------------------------------------- */
const FREE_TEXT_FIELDS = ["nota", "notas", "observacion", "observaciones"];
const NAME_RE = /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/;
function violaPrivacidad(row) {
  return FREE_TEXT_FIELDS.some((k) => typeof (row || {})[k] === "string" && NAME_RE.test(row[k]));
}

// Clasifica errores de Supabase: red/servidor → reintentable; resto → permanente
function lanzar(error, contexto) {
  const msg = `${contexto}: ${error.message || error}`;
  const code = String(error.code || "");
  const reintentable = !code || code === "PGRST000" || code === "PGRST001" || code === "PGRST002" || /fetch|network|timeout|Failed/i.test(error.message || "");
  if (reintentable) throw new Error(msg);
  throw new PermanentError(msg);
}

/* ---------------------------------------------------------------------------
   API
--------------------------------------------------------------------------- */
export function makeSupabaseApi({ url, anonKey, sheetsApi }) {
  const sb = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null;

  async function selectAll(schema) {
    const out = []; const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from(schema.table).select("*")
        .order("created_at", { ascending: true }).order("id", { ascending: true })
        .range(from, from + page - 1);
      if (error) lanzar(error, "list " + schema.table);
      out.push(...data);
      if (data.length < page) break;
    }
    return out.map((f) => aObjeto(schema, f));
  }

  async function insertar(sheet, rows) {
    // Agrupa por tabla destino (Catalogo puede repartir entre catalogo y app_config)
    const grupos = new Map();
    for (const row of rows) {
      if (!row || row.id == null || row.id === "") throw new PermanentError("append requiere un 'id'.");
      if (violaPrivacidad(row)) { console.warn(`Fila omitida por posible nombre de paciente (${sheet})`); continue; }
      const schema = destino(sheet, row.id);
      const { fila, extra } = aFila(schema, row);
      fila.extra = extra;
      if (!grupos.has(schema)) grupos.set(schema, []);
      grupos.get(schema).push(fila);
    }
    let added = 0;
    for (const [schema, filas] of grupos) {
      // Idempotente como Code.gs: si el id ya existe no se duplica ni se pisa
      const { data, error } = await sb.from(schema.table)
        .upsert(filas, { onConflict: "id", ignoreDuplicates: true }).select("id");
      if (error) lanzar(error, "append " + schema.table);
      added += (data || []).length;
    }
    return added;
  }

  return {
    backend: "supabase",
    connected: () => !!sb,
    client: sb,

    async list(sheet) {
      if (sheet === "Catalogo") {
        const [meds, cfg] = await Promise.all([selectAll(SCHEMA.Catalogo), selectAll(SCHEMA.AppConfig)]);
        // Mismo aspecto que las filas especiales en Sheets
        const especiales = cfg.map((c) => ({ codigoV: "", grupo: "", min: "", max: "", ...c }));
        return { rows: [...meds, ...especiales] };
      }
      return { rows: await selectAll(destino(sheet)) };
    },

    async append(sheet, row) { const n = await insertar(sheet, [row]); return { ok: true, dup: n === 0 }; },

    async appendMany(sheet, rows) { return { added: await insertar(sheet, rows || []) }; },

    async update(sheet, id, row) {
      if (id == null || id === "") throw new PermanentError("update requiere 'id'.");
      if (violaPrivacidad(row)) { console.warn(`Update omitido por posible nombre de paciente (${sheet})`); return { ok: true, skipped: "privacy" }; }
      const schema = destino(sheet, id);
      const { fila, extra } = aFila(schema, { ...row, id });
      delete fila.id;
      // Igual que Sheets: las claves sin columna se fusionan con las que ya había
      if (Object.keys(extra).length) {
        const { data: actual, error: e1 } = await sb.from(schema.table).select("extra").eq("id", String(id)).maybeSingle();
        if (e1) lanzar(e1, "update " + schema.table);
        fila.extra = { ...((actual && actual.extra) || {}), ...extra };
      }
      const { data, error } = await sb.from(schema.table).update(fila).eq("id", String(id)).select("id");
      if (error) lanzar(error, "update " + schema.table);
      if (!data || !data.length) throw new PermanentError(`No existe el id ${id} en ${sheet}`);
      return { ok: true };
    },

    async remove(sheet) {
      throw new PermanentError(`Borrado no permitido en ${sheet}: los registros de estupefacientes no se eliminan.`);
    },

    // Sigue leyendo el Sheet compartido de pedidos a través del Apps Script (solo lectura)
    leerRegistroPedidos: (p) => {
      if (!sheetsApi || !sheetsApi.connected()) return Promise.reject(new Error("Falta la URL del Apps Script para leer el registro de pedidos"));
      return sheetsApi.leerRegistroPedidos(p);
    },

    // Avisa (con un pequeño retardo para agrupar ráfagas) cuando otro equipo cambia algo
    subscribe(onChange) {
      if (!sb) return () => {};
      let t = null;
      const ch = sb.channel("estupefarma-cambios");
      TABLAS.forEach((table) => ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(t); t = setTimeout(onChange, 800);
      }));
      ch.subscribe();
      return () => { clearTimeout(t); sb.removeChannel(ch); };
    },
  };
}
