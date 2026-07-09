import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Home, ClipboardList, History, ShieldAlert, PackageSearch, CalendarX,
  AlertTriangle, Plus, Save, X, Upload, Search, CheckCircle2, Clock,
  Settings, RefreshCw, Cloud, CloudOff, Truck, FileSpreadsheet, Trash2,
  ChevronRight, Info, Pill, Syringe, Filter, ArrowRight, ListChecks, Bell
} from "lucide-react";

/* ============================================================================
   GESTOR DE ESTUPEFACIENTES — HUNSC
   Prototipo funcional con las 6 funcionalidades de EstupeFarma.
   Base de datos: Google Sheets vía Google Apps Script (ver Code.gs).
   Regla ABSOLUTA: nunca se manejan nombres de pacientes.
   ============================================================================ */

/* ---------------------------------------------------------------------------
   CONFIGURACIÓN — la URL del Web App de Apps Script se resuelve por prioridad:
   localStorage (lo pegado en Ajustes, persistente) → variable de entorno
   VITE_APPS_SCRIPT_URL (definida en Vercel) → "" (modo local con persistencia
   en este equipo). Ver resolveInitialUrl() más abajo.
--------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
   PALETA / ESTILOS
--------------------------------------------------------------------------- */
const C = {
  indigo: "#1E1B4B",
  indigo2: "#312E81",
  accent: "#6366F1",
  bg: "#F5F6FA",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#1F2937",
  sub: "#6B7280",
  green: "#16A34A",
  greenBg: "#DCFCE7",
  yellow: "#CA8A04",
  yellowBg: "#FEF9C3",
  red: "#DC2626",
  redBg: "#FEE2E2",
};

const dotPattern = {
  backgroundColor: C.indigo,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
  backgroundSize: "16px 16px",
};

/* ---------------------------------------------------------------------------
   CATÁLOGO OFICIAL (Código V) — sección 5 del contexto
--------------------------------------------------------------------------- */
const CATALOGO_ORALES = [
  ["V04751", "FENTANILO BUCAL 200 mcg comp", 100, 50],
  ["V04718", "FENTANILO BUCAL 400 mcg comp", 90, 45],
  ["V04740", "FENTANILO BUCAL 600 mcg comp", 0, 0],
  ["V04731", "FENTANILO BUCAL 800 mcg comp", 30, 15],
  ["V00639", "METADONA 5 mg comp or/sonda", 80, 40],
  ["V09424", "MORFINA RÁPIDA 10 mg comp (Sevredol)", 80, 40],
  ["V03592", "MORFINA MST LIB PROLONG 5 mg comp", 360, 180],
  ["V00655", "MORFINA MST LIB PROLONG 10 mg comp", 780, 390],
  ["V00656", "MORFINA MST LIB PROLONG 30 mg comp", 240, 120],
  ["V00657", "MORFINA MST LIB PROLONG 100 mg comp", 60, 15],
  ["V45673", "MORFINA sol oral 2 mg/1 mL 100mL (Oramorph)", 4, 2],
  ["V29931", "OXICODONA RÁPIDA 10 mg caps", 40, 20],
  ["V02175", "OXICODONA LIB PROLONGADA 10 mg comp", 300, 150],
  ["V02208", "OXICODONA LIB PROLONGADA 20 mg comp", 100, 50],
  ["V18636", "OXICODONA 10 mg/mL sol 30mL (Oxynorm)", 10, 5],
  ["T93631", "P METADONA CLORHIDRATO 100 g (O-29)", null, null],
];
const CATALOGO_IV = [
  ["V07610", "FENTANILO 150 mcg/3mL amp", 10000, 5000],
  ["V02257", "FENTANILO TRANSDÉRMICO 100 mcg/h parche", 20, 10],
  ["V02227", "FENTANILO TRANSDÉRMICO 12 mcg/h parche", 200, 100],
  ["V02258", "FENTANILO TRANSDÉRMICO 25 mcg/h parche", 160, 80],
  ["V02256", "FENTANILO TRANSDÉRMICO 50 mcg/h parche", 50, 30],
  ["V02715", "FENTANILO TRANSDÉRMICO 75 mcg/h parche", 20, 10],
  ["V02304", "PETIDINA (MEPERIDINA) 100 mg/2mL amp", 180, 90],
  ["V03200", "METADONA 10 mg/1mL amp IV/SC/ORAL", 48, 24],
  ["V19632", "REMIFENTANILO 1 mg/3mL vial", 60, 30],
  ["V19630", "REMIFENTANILO 5 mg/10mL vial", 700, 350],
  ["V19176", "MORFINA 10 mg/1mL amp 1%", 4000, 2000],
  ["V02015", "MORFINA 2% 20 mL (400 mg) vial parenteral", 40, 20],
  ["Y81210", "MORFINA 400 mg/10mL amp 4%", 20, 10],
  ["V02016", "MORFINA 4% 10 mL (400 mg) ampolla parenteral", 20, 10],
  ["Y50002", "PCA MORFINA 100 mg (mezcla)", 20, 10],
  ["Y94156", "MEZCLA EPI 131 mL BUPI 0,099% + FENTA 0,00019%", 20, 10],
];
const catalog = (grupo) =>
  (grupo === "ORAL" ? CATALOGO_ORALES : CATALOGO_IV).map(([cod, nombre, max, min]) => ({
    codigoV: cod, nombre, max, min, grupo,
  }));
const ALL_MEDS = [...catalog("ORAL"), ...catalog("IV")];
const medByV = Object.fromEntries(ALL_MEDS.map((m) => [m.codigoV, m]));

const PROVEEDORES = ["COFARTE", "COFARES", "KERN PHARMA", "BRAUN", "FERRER FARMA", "LAPHYSAN", "MUNDIPHARMA", "REIG JOFRE", "Otro"];

const TIPOS_INCIDENCIA = [
  "Carga manual SADE", "Descarga manual SADE", "Entrada mal registrada",
  "Movimiento por rotura incorrecto", "Movimiento por caducidad incorrecto",
  "Vale duplicado", "Cantidad incorrecta", "Otro",
];
const SISTEMAS = ["ATHOS SADE", "DRAGO Farma", "Libro físico"];

const ERROR_CATALOG = {
  E01: { nivel: "warn", nombre: "Carga manual sospechosa" },
  E02: { nivel: "warn", nombre: "Descarga manual sospechosa" },
  E03: { nivel: "crit", nombre: "Corrección rápida dispensación↔devolución" },
  E04: { nivel: "warn", nombre: "Devolución sin dispensación previa" },
  E05: { nivel: "crit", nombre: "Cantidad cero" },
  E06: { nivel: "crit", nombre: "Vale duplicado entre medicamentos" },
  E07: { nivel: "crit", nombre: "Palabra clave de corrección en nota" },
  E08: { nivel: "crit", nombre: "Stock final negativo" },
  E09: { nivel: "warn", nombre: "Carga sin variación de stock" },
  E10: { nivel: "crit", nombre: "Rotura fuera del SADE sin par completo" },
  E11: { nivel: "crit", nombre: "Descuadre en par de rotura" },
  E12: { nivel: "warn", nombre: "Caducidad sin par completo" },
};
const CRITICOS = ["E03", "E05", "E06", "E07", "E08", "E10", "E11"];

/* ---------------------------------------------------------------------------
   UTILIDADES
--------------------------------------------------------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);

// Serial de Excel -> Date (base 30/12/1899)
function excelSerialToDate(serial) {
  if (typeof serial !== "number" || isNaN(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}
function fmtDateTime(d) {
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function extraerCodigoV(txt) {
  if (!txt) return null;
  const m = String(txt).match(/([VYT]\d{5})/i);
  return m ? m[1].toUpperCase() : null;
}
// nivel de descuadre -> color
function discColor(v) {
  const a = Math.abs(Number(v) || 0);
  if (a === 0) return "none";
  if (a <= 10) return "warn";
  return "crit";
}
// nivel de stock frente a min/max
function stockLevel(real, med) {
  if (!med || med.max == null || med.min == null || (med.max === 0 && med.min === 0)) return null;
  if (real >= med.max) return { level: "ok", txt: "Stock óptimo" };
  if (real >= med.min) return { level: "warn", txt: "Pedir a laboratorio" };
  return { level: "crit", txt: "Pedir a cooperativa (urgente)" };
}

/* ---------------------------------------------------------------------------
   CAPA DE DATOS — Google Sheets (Apps Script) con fallback a memoria local
--------------------------------------------------------------------------- */
function makeApi(getUrl) {
  async function call(action, payload) {
    const url = getUrl();
    if (!url) throw new Error("no-url");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight CORS
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) throw new Error("http-" + res.status);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    return data;
  }
  return {
    connected: () => !!getUrl(),
    list: (sheet) => call("list", { sheet }),
    append: (sheet, row) => call("append", { sheet, row }),
    appendMany: (sheet, rows) => call("appendMany", { sheet, rows }),
    update: (sheet, id, row) => call("update", { sheet, id, row }),
    remove: (sheet, id) => call("remove", { sheet, id }),
  };
}

/* ---------------------------------------------------------------------------
   PERSISTENCIA LOCAL (offline-first)
   Los datos se guardan en localStorage (sobreviven a recarga y a estar sin red)
   y las escrituras pendientes se acumulan en un "outbox" que se vuelca al backend
   cuando hay conexión. El backend deduplica por `id`, así que reenviar la cola es
   idempotente (no duplica filas).
--------------------------------------------------------------------------- */
const LS = {
  url: "estupefarma.appsScriptUrl",
  outbox: "estupefarma.outbox",
  data: (sheet) => `estupefarma.data.${sheet}`,
};
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* cuota/privado */ } }
function lsDel(key) { try { localStorage.removeItem(key); } catch { /* noop */ } }

// URL inicial: localStorage → variable de entorno (Vercel) → ""
function resolveInitialUrl() {
  const stored = lsGet(LS.url, null);
  if (stored) return stored;
  return (import.meta.env && import.meta.env.VITE_APPS_SCRIPT_URL) || "";
}
function isOffline() { return typeof navigator !== "undefined" && navigator.onLine === false; }

// Cola de escrituras pendientes (outbox)
function outboxRead() { return lsGet(LS.outbox, []); }
function outboxWrite(ops) { lsSet(LS.outbox, ops); }
function outboxAdd(op) { const ops = outboxRead(); ops.push({ opId: uid(), ts: Date.now(), ...op }); outboxWrite(ops); return ops.length; }
// Vuelca la cola en orden FIFO. Ante error de red se detiene y conserva el resto.
async function outboxFlush(api) {
  if (!api.connected() || isOffline()) return outboxRead().length;
  let ops = outboxRead();
  while (ops.length) {
    const op = ops[0];
    try {
      if (op.action === "append") await api.append(op.sheet, op.row);
      else if (op.action === "appendMany") await api.appendMany(op.sheet, op.rows);
      else if (op.action === "update") await api.update(op.sheet, op.id, op.row);
      else if (op.action === "remove") await api.remove(op.sheet, op.id);
      ops.shift(); outboxWrite(ops);
    } catch (e) { break; } // se reintentará al recuperar conexión
  }
  return outboxRead().length;
}

// Normaliza una fila de la hoja "Catalogo" al shape de medicamento usado por la app
function normalizeMed(r) {
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const grupo = String(r.grupo || "").toUpperCase() === "IV" ? "IV" : "ORAL";
  return { codigoV: String(r.codigoV || "").trim(), nombre: String(r.nombre || "").trim(), grupo, max: num(r.max), min: num(r.min) };
}

/* ---------------------------------------------------------------------------
   ALERTAS — registro accionable de avisos de reposición (pedido) y del Detector.
   IDs deterministas para deduplicar en el backend (reenvío de cola idempotente).
--------------------------------------------------------------------------- */
function sanitizeId(s) { return String(s || "").replace(/[^a-zA-Z0-9]+/g, "_"); }
// Fusiona alertas nuevas preservando el estado (hecha/descartada) de las ya existentes
function mergeAlertas(prev, nuevas) {
  const byId = new Map(prev.map((a) => [a.id, a]));
  nuevas.forEach((n) => { const ex = byId.get(n.id); byId.set(n.id, ex ? { ...n, estado: ex.estado } : n); });
  return Array.from(byId.values());
}
// Alerta de reposición a partir de un aviso de inventario
function alertaReposicion(aviso, fecha) {
  return {
    id: `rep-${sanitizeId(aviso.codigoV)}-${sanitizeId(fecha)}`,
    origen: "inventario", tipo: "pedido", codigos: "",
    codigoV: aviso.codigoV, medicamento: aviso.nombre, nivel: aviso.level,
    fecha, detalle: `${aviso.accion} · stock real ${aviso.real}`, estado: "pendiente",
  };
}
// Alerta del Detector a partir de una fila del cruce con flags
function alertaDetector(r) {
  return {
    id: `det-${sanitizeId(r.codigoV)}-${sanitizeId(r.fecha)}-${sanitizeId(r.cantidad)}-${sanitizeId(r.alertas)}`,
    origen: "detector", tipo: "detector", codigos: r.alertas || "",
    codigoV: r.codigoV, medicamento: r.medicamento, nivel: r.nivel,
    fecha: r.fecha, detalle: `${r.tipo || "movimiento"} · ${r.cantidad} uds`, estado: "pendiente",
  };
}

/* ---------------------------------------------------------------------------
   PRIMITIVAS UI
--------------------------------------------------------------------------- */
function Badge({ level, children }) {
  const map = {
    none: { bg: "#F3F4F6", fg: C.sub },
    ok: { bg: C.greenBg, fg: C.green },
    warn: { bg: C.yellowBg, fg: C.yellow },
    crit: { bg: C.redBg, fg: C.red },
    info: { bg: "#E0E7FF", fg: C.accent },
  };
  const s = map[level] || map.none;
  return (
    <span style={{ background: s.bg, color: s.fg, padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Drawer({ open, title, onClose, children, footer, wide }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,15,40,0.45)" }} />
      <div style={{
        position: "absolute", top: 0, right: 0, height: "100%", width: wide ? 640 : 460, maxWidth: "94vw",
        background: "#fff", boxShadow: "-8px 0 30px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 17, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "14px 22px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}

const iconBtn = { background: "transparent", border: "none", cursor: "pointer", color: C.sub, padding: 6, borderRadius: 8, display: "inline-flex" };
const btnPrimary = { background: C.accent, color: "#fff", border: "none", padding: "9px 16px", borderRadius: 10, fontWeight: 600, cursor: "pointer", display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14 };
const btnGhost = { background: "#fff", color: C.text, border: `1px solid ${C.border}`, padding: "9px 16px", borderRadius: 10, fontWeight: 600, cursor: "pointer", display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14 };
const inputStyle = { width: "100%", padding: "9px 11px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 14, boxSizing: "border-box", color: C.text, background: "#fff" };
const labelStyle = { fontSize: 13, fontWeight: 600, color: C.sub, display: "block", marginBottom: 6, marginTop: 14 };

function Field({ label, children }) {
  return (<div><label style={labelStyle}>{label}</label>{children}</div>);
}
function Card({ children, style }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, ...style }}>{children}</div>;
}
function StatCard({ icon, label, value, sub, tone }) {
  const tones = { crit: C.red, warn: C.yellow, ok: C.green, info: C.accent };
  return (
    <Card style={{ flex: 1, minWidth: 190 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: tones[tone] || C.accent }}>
        {icon}<span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.text, marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}
function SectionTitle({ title, desc, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, color: C.text }}>{title}</h2>
        {desc && <p style={{ margin: "4px 0 0", color: C.sub, fontSize: 14 }}>{desc}</p>}
      </div>
      {right}
    </div>
  );
}
function GroupToggle({ value, onChange }) {
  return (
    <div style={{ display: "inline-flex", background: "#EEF0F6", borderRadius: 10, padding: 3 }}>
      {[["ORAL", "Orales", <Pill size={15} key="p" />], ["IV", "Intravenosos", <Syringe size={15} key="s" />]].map(([v, t, ic]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          border: "none", cursor: "pointer", padding: "7px 14px", borderRadius: 8, fontWeight: 600, fontSize: 13,
          display: "inline-flex", gap: 6, alignItems: "center",
          background: value === v ? "#fff" : "transparent", color: value === v ? C.text : C.sub,
          boxShadow: value === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
        }}>{ic}{t}</button>
      ))}
    </div>
  );
}
const th = { textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: C.sub, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
const td = { padding: "10px 12px", fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` };
const rowBg = { none: "#fff", warn: C.yellowBg, crit: C.redBg };

/* ===========================================================================
   1) INVENTARIO SEMANAL
=========================================================================== */
function buildInventarioRows(meds, grupo) {
  return meds.filter((m) => m.grupo === grupo).map((m) => ({ codigoV: m.codigoV, nombre: m.nombre, real: "", d07: "", maestro: "" }));
}
function InventarioSemanal({ onSaved, avisos, meds, medByV }) {
  const [grupo, setGrupo] = useState("ORAL");
  const [fecha, setFecha] = useState(todayISO());
  const [rows, setRows] = useState(() => ({ ORAL: buildInventarioRows(meds, "ORAL"), IV: buildInventarioRows(meds, "IV") }));
  const [saving, setSaving] = useState(false);

  const set = (i, campo, val) => {
    setRows((prev) => {
      const cp = { ...prev };
      const arr = [...cp[grupo]];
      arr[i] = { ...arr[i], [campo]: val.replace(/[^\d-]/g, "") };
      cp[grupo] = arr;
      return cp;
    });
  };
  const list = rows[grupo];

  const guardar = async () => {
    setSaving(true);
    const payloadRows = [];
    ["ORAL", "IV"].forEach((g) => rows[g].forEach((r) => {
      if (r.real === "" && r.d07 === "" && r.maestro === "") return;
      const real = Number(r.real || 0), d07 = Number(r.d07 || 0), maestro = Number(r.maestro || 0);
      payloadRows.push({
        id: uid(), fecha, grupo: g, codigoV: r.codigoV, nombre: r.nombre,
        real, d07, maestro, descRealD07: real - d07, descD07Maestro: d07 - maestro,
      });
    }));
    await onSaved({ fecha, filas: payloadRows });
    setSaving(false);
  };

  return (
    <div>
      <SectionTitle title="Inventario semanal" desc="Triple recuento: físico (fuente de verdad), ATHOS D07 y Maestro (DRAGO)."
        right={<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <GroupToggle value={grupo} onChange={setGrupo} />
          <button style={btnPrimary} disabled={saving} onClick={guardar}>
            {saving ? <RefreshCw size={16} /> : <Save size={16} />}{saving ? "Guardando…" : "Guardar inventario"}
          </button>
        </div>} />

      <Card style={{ marginBottom: 16, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <Field label="Fecha del inventario"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...inputStyle, width: 200 }} /></Field>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.sub, marginTop: 20 }}>
          <span><span style={{ ...legendDot, background: C.yellowBg, border: `1px solid ${C.yellow}` }} /> descuadre 1–10</span>
          <span><span style={{ ...legendDot, background: C.redBg, border: `1px solid ${C.red}` }} /> descuadre &gt;10</span>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead><tr>
              <th style={th}>Código V</th><th style={th}>Medicamento</th>
              <th style={th}>ATHOS REAL</th><th style={th}>ATHOS D07</th><th style={th}>MAESTRO</th>
              <th style={th}>Real − D07</th><th style={th}>D07 − Maestro</th><th style={th}>Stock</th>
            </tr></thead>
            <tbody>
              {list.map((r, i) => {
                const real = Number(r.real || 0), d07 = Number(r.d07 || 0), maestro = Number(r.maestro || 0);
                const filled = r.real !== "" || r.d07 !== "" || r.maestro !== "";
                const dRD = real - d07, dDM = d07 - maestro;
                const lvl = discColor(dRD) === "crit" || discColor(dDM) === "crit" ? "crit" : (discColor(dRD) === "warn" || discColor(dDM) === "warn" ? "warn" : "none");
                const sl = filled ? stockLevel(real, medByV[r.codigoV]) : null;
                return (
                  <tr key={r.codigoV} style={{ background: filled ? rowBg[lvl] : "#fff" }}>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.codigoV}</td>
                    <td style={{ ...td, minWidth: 220 }}>{r.nombre}</td>
                    <td style={td}><input value={r.real} onChange={(e) => set(i, "real", e.target.value)} style={miniInput} placeholder="—" /></td>
                    <td style={td}><input value={r.d07} onChange={(e) => set(i, "d07", e.target.value)} style={miniInput} placeholder="—" /></td>
                    <td style={td}><input value={r.maestro} onChange={(e) => set(i, "maestro", e.target.value)} style={miniInput} placeholder="—" /></td>
                    <td style={td}>{filled ? <Badge level={discColor(dRD)}>{dRD > 0 ? "+" : ""}{dRD}</Badge> : "—"}</td>
                    <td style={td}>{filled ? <Badge level={discColor(dDM)}>{dDM > 0 ? "+" : ""}{dDM}</Badge> : "—"}</td>
                    <td style={td}>{sl ? <Badge level={sl.level}>{sl.txt}</Badge> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {avisos && avisos.length > 0 && (
        <Card style={{ marginTop: 16, borderColor: C.yellow, background: C.yellowBg }}>
          <div style={{ fontWeight: 700, color: C.text, display: "flex", gap: 8, alignItems: "center" }}><Truck size={17} /> Avisos de reposición del último inventario guardado</div>
          <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: C.text, fontSize: 13 }}>
            {avisos.map((a, i) => <li key={i} style={{ marginBottom: 4 }}><b>{a.nombre}</b> ({a.codigoV}) — {a.accion} · stock real {a.real}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
const miniInput = { width: 74, padding: "7px 8px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, textAlign: "center" };
const legendDot = { display: "inline-block", width: 12, height: 12, borderRadius: 3, verticalAlign: "middle", marginRight: 4 };

/* ===========================================================================
   2) INVENTARIOS ANTERIORES
=========================================================================== */
function InventariosAnteriores({ inventarios }) {
  const fechas = useMemo(() => [...new Set(inventarios.map((r) => r.fecha))].sort().reverse(), [inventarios]);
  const [sel, setSel] = useState(fechas[0] || "");
  const [grupo, setGrupo] = useState("ORAL");
  useEffect(() => { if (!sel && fechas[0]) setSel(fechas[0]); }, [fechas, sel]);

  const filas = inventarios.filter((r) => r.fecha === sel && r.grupo === grupo);
  const descPorFecha = (f) => inventarios.filter((r) => r.fecha === f && (discColor(r.descRealD07) !== "none" || discColor(r.descD07Maestro) !== "none")).length;

  return (
    <div>
      <SectionTitle title="Inventarios anteriores" desc="Consulta en solo lectura de inventarios guardados." right={<GroupToggle value={grupo} onChange={setGrupo} />} />
      {fechas.length === 0 ? (
        <Card><Empty icon={<History size={26} />} text="Aún no hay inventarios guardados. Registra uno en «Inventario semanal»." /></Card>
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Card style={{ width: 260, alignSelf: "flex-start" }}>
            <div style={{ fontWeight: 700, marginBottom: 10, color: C.text }}>Fechas</div>
            {fechas.map((f) => {
              const n = descPorFecha(f);
              return (
                <button key={f} onClick={() => setSel(f)} style={{
                  width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                  border: `1px solid ${sel === f ? C.accent : C.border}`, background: sel === f ? "#EEF0FF" : "#fff",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmtDate(f)}</span>
                  {n > 0 ? <Badge level={n > 3 ? "crit" : "warn"}>{n} descuadres</Badge> : <Badge level="ok">OK</Badge>}
                </button>
              );
            })}
          </Card>
          <Card style={{ flex: 1, minWidth: 460, padding: 0, overflow: "hidden", alignSelf: "flex-start" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead><tr>
                  <th style={th}>Código V</th><th style={th}>Medicamento</th><th style={th}>REAL</th><th style={th}>D07</th><th style={th}>MAESTRO</th><th style={th}>Real−D07</th><th style={th}>D07−Maestro</th>
                </tr></thead>
                <tbody>
                  {filas.map((r) => {
                    const lvl = discColor(r.descRealD07) === "crit" || discColor(r.descD07Maestro) === "crit" ? "crit" : (discColor(r.descRealD07) === "warn" || discColor(r.descD07Maestro) === "warn" ? "warn" : "none");
                    return (
                      <tr key={r.id} style={{ background: rowBg[lvl] }}>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.codigoV}</td>
                        <td style={td}>{r.nombre}</td>
                        <td style={td}>{r.real}</td><td style={td}>{r.d07}</td><td style={td}>{r.maestro}</td>
                        <td style={td}><Badge level={discColor(r.descRealD07)}>{r.descRealD07 > 0 ? "+" : ""}{r.descRealD07}</Badge></td>
                        <td style={td}><Badge level={discColor(r.descD07Maestro)}>{r.descD07Maestro > 0 ? "+" : ""}{r.descD07Maestro}</Badge></td>
                      </tr>
                    );
                  })}
                  {filas.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: C.sub }}>Sin datos para esta fecha y grupo.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   3) DETECTOR DE ALERTAS
   Lector robusto (multi-hoja + cabecera real) · Código V desde su columna ·
   cruce tolerante por huella (Código V + cantidad + cantidad final) ·
   orden intradía por secuencia de filas del Histórico · diagnóstico visible.
=========================================================================== */

// Busca una cabecera que contenga alguno de los términos (y ninguno de los excluidos)
function findCol(obj, includeAny, excludeAny) {
  excludeAny = excludeAny || [];
  for (const k of Object.keys(obj)) {
    const lk = String(k).toLowerCase();
    if (includeAny.some((t) => lk.includes(t)) && !excludeAny.some((t) => lk.includes(t))) return obj[k];
  }
  return "";
}

// Localiza la fila de cabeceras aunque haya títulos o el filtro de búsqueda encima
function detectHeaderRow(aoa) {
  const tokens = ["fecha", "cantidad", "tipo", "medicamento", "estupefac", "vale", "dispensador", "usuario", "denominaci", "codigo", "código", "suma"];
  const top = Math.min(aoa.length, 20);
  for (let i = 0; i < top; i++) {
    const row = (aoa[i] || []).map((c) => String(c).toLowerCase());
    const hits = tokens.filter((t) => row.some((c) => c.includes(t))).length;
    if (hits >= 3) return i;
  }
  return 0;
}

// Convierte una hoja en objetos usando la cabecera detectada
function sheetToObjects(ws) {
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
  if (!aoa.length) return [];
  const hr = detectHeaderRow(aoa);
  const headers = (aoa[hr] || []).map((h) => String(h).trim());
  const out = [];
  for (let i = hr + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    if (r.every((c) => c === "" || c == null)) continue;
    const o = {};
    headers.forEach((h, idx) => { if (h) o[h] = r[idx]; });
    out.push(o);
  }
  return out;
}

// Lee el .xlsx quedándose con la pestaña que tenga más filas. cellDates:false para
// conservar el serial de fecha con sus decimales (ahí vive la hora).
function readWorkbookSmart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        let best = [], bestName = "";
        wb.SheetNames.forEach((name) => {
          const objs = sheetToObjects(wb.Sheets[name]);
          if (objs.length > best.length) { best = objs; bestName = name; }
        });
        resolve({ rows: best, sheet: bestName });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function dayStr(d) { return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : ""; }

function normalizeRow(raw, origen, idx) {
  const fechaRaw = findCol(raw, ["fecha"]);
  let fecha = null, hasTime = false;
  if (typeof fechaRaw === "number") { fecha = excelSerialToDate(fechaRaw); hasTime = (fechaRaw % 1) !== 0; }
  else if (fechaRaw) { const d = new Date(fechaRaw); if (!isNaN(d.getTime())) { fecha = d; hasTime = (d.getHours() + d.getMinutes()) > 0; } }

  // Código V: primero de su columna propia (Histórico: "Medicamento Código"), si no del nombre (Libro)
  const codCol = findCol(raw, ["codigo", "código"]);
  const medNombre = findCol(raw, ["denominaci", "estupefac", "medicamento"], ["codigo", "código"]);
  const codigoV = extraerCodigoV(codCol) || extraerCodigoV(medNombre) || "";

  const cantidad = Number(findCol(raw, ["cantidad"], ["final", "dispensador"])) || 0;
  const cfRaw = findCol(raw, ["cantidad final"], ["dispensador"]); // global, presente en ambos archivos
  const cantFinal = cfRaw === "" ? null : (Number(cfRaw) || 0);
  const tipo = String(findCol(raw, ["tipo"]) || findCol(raw, ["descripcion", "descripción"]) || "").trim();

  return {
    id: uid(), origen, idx,
    codigoV,
    medicamento: String(medNombre || "").trim(),
    fecha, hasTime, day: dayStr(fecha), fechaTxt: fecha ? fmtDateTime(fecha) : "",
    tipo,
    medico: String(findCol(raw, ["medico", "médico", "facultativo", "prescriptor"], ["paciente"]) || "").trim(),
    usuario: String(findCol(raw, ["usuario"]) || "").trim(),
    vale: String(findCol(raw, ["vale"]) || "").trim(),
    nota: String(findCol(raw, ["nota", "observ"]) || "").trim(),
    unidad: String(findCol(raw, ["unidad de enfermer", "servicio"]) || "").trim(),
    cantidad, cantFinal,
    destino: String(findCol(raw, ["proveedor", "descripcion", "descripción", "nota"]) || ""),
  };
}

// Fusiona una fila del Libro con su pareja del Histórico. El Histórico manda en el
// orden cronológico intradía (seqBase) y en usuario; el Libro aporta vale/nota.
function mergeLH(l, h) {
  return {
    ...l, ...h, id: l.id, cruce: "ambos", seqBase: h.idx,
    codigoV: l.codigoV || h.codigoV,
    medicamento: l.medicamento || h.medicamento,
    tipo: l.tipo || h.tipo,
    vale: l.vale || h.vale,
    nota: l.nota || h.nota,
    medico: h.medico || l.medico,
    usuario: h.usuario || l.usuario,
    cantidad: l.cantidad || h.cantidad,
    cantFinal: l.cantFinal != null ? l.cantFinal : h.cantFinal,
    hasTime: l.hasTime || h.hasTime,
    day: l.day || h.day,
    fecha: l.hasTime ? l.fecha : (h.hasTime ? h.fecha : l.fecha),
    fechaTxt: l.hasTime ? l.fechaTxt : (h.hasTime ? h.fechaTxt : (l.fechaTxt || h.fechaTxt)),
  };
}

function esTipo(row, kw) { return row.tipo.toLowerCase().includes(kw); }

// Proximidad: por minutos si ambos tienen hora; por adyacencia de secuencia (mismo día) si no
function proximos(a, b, mins, seqWin) {
  if (!a.day || !b.day || a.day !== b.day) return false;
  if (a.hasTime && b.hasTime && a.fecha && b.fecha) return Math.abs(a.fecha - b.fecha) <= mins * 60000;
  return Math.abs(a.seq - b.seq) <= (seqWin || 3);
}

function analizarMovimientos(rows) {
  const KW = ["error", "subsanaci", "anulad", "compensaci", "falso", "falsa"];
  // Orden temporal: día + (hora real si existe; si no, la secuencia de origen)
  const sorted = [...rows].sort((a, b) => {
    const da = a.day || "", db = b.day || "";
    if (da !== db) return da < db ? -1 : 1;
    if (a.hasTime && b.hasTime && a.fecha && b.fecha) return a.fecha - b.fecha;
    return (a.seqBase || 0) - (b.seqBase || 0);
  });
  sorted.forEach((r, i) => { r.seq = i; });

  const byV = {};
  sorted.forEach((r) => { (byV[r.codigoV] = byV[r.codigoV] || []).push(r); });

  // Vale duplicado entre medicamentos (E06), ignorando vales de reposición / entradas sin vale oficial
  const valeMap = {};
  sorted.forEach((r) => { if (r.vale && !/^(repo|intercambio|pr[eé]stamo|metadona|nombre)/i.test(r.vale)) (valeMap[r.vale] = valeMap[r.vale] || new Set()).add(r.codigoV); });
  const valesMulti = new Set(Object.entries(valeMap).filter(([, s]) => s.size > 1).map(([v]) => v));

  return sorted.map((r) => {
    const flags = [];
    if (r.cantidad === 0) flags.push("E05");
    if (r.cantFinal != null && r.cantFinal < 0) flags.push("E08");
    if (r.vale && valesMulti.has(r.vale)) flags.push("E06");
    const low = (r.nota + " " + r.tipo).toLowerCase();
    if (KW.some((k) => low.includes(k))) flags.push("E07");
    if (esTipo(r, "carga")) flags.push("E01");
    if (esTipo(r, "descarga")) flags.push("E02");
    if (esTipo(r, "carga") && r.cantFinal != null) {
      const arr = byV[r.codigoV]; const idx = arr.indexOf(r);
      if (idx > 0 && arr[idx - 1].cantFinal === r.cantFinal) flags.push("E09");
    }
    if (esTipo(r, "dispensaci")) {
      if (sorted.some((o) => o !== r && esTipo(o, "devoluci") && proximos(r, o, 60, 3))) flags.push("E03");
    }
    if (esTipo(r, "devoluci")) {
      const arr = byV[r.codigoV] || [];
      const ok = arr.some((o) => o !== r && esTipo(o, "dispensaci") && proximos(r, o, 48 * 60, 10) && Math.abs(o.cantidad - r.cantidad) <= Math.max(1, r.cantidad * 0.5));
      if (!ok) flags.push("E04");
    }
    if (esTipo(r, "dispensaci") && /99000000|rotura/i.test(r.destino + r.medicamento + r.nota)) {
      const arr = byV[r.codigoV] || [];
      const par = arr.find((o) => o !== r && esTipo(o, "devoluci") && proximos(r, o, 120, 4));
      if (!par) flags.push("E10"); else if (par.cantidad !== r.cantidad) flags.push("E11");
    }
    if (/caduc/i.test(low + r.medicamento) && !/99999944/.test(r.destino)) flags.push("E12");

    const nivel = flags.some((f) => ERROR_CATALOG[f] && ERROR_CATALOG[f].nivel === "crit") ? "crit" : (flags.length ? "warn" : "none");
    return { ...r, flags, nivel };
  });
}

function DetectorAlertas({ onResumen, onGuardarCruce, sheetsConnected, onNombrePaciente }) {
  const [libro, setLibro] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [resultado, setResultado] = useState(null);
  const [diag, setDiag] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");
  const [soloAlertas, setSoloAlertas] = useState(false);

  const guardarEnSheets = async () => {
    if (!resultado || !onGuardarCruce) return;
    setGuardando(true);
    const intervalo = desde || hasta ? `${desde || "?"} → ${hasta || "?"}` : "";
    const rows = resultado.map((r) => ({
      id: uid(),
      medicamento: r.medicamento,
      codigoV: r.codigoV,
      fecha: r.fechaTxt || r.day || "",
      tipo: r.tipo,
      medico: r.medico || "",
      cantidad: r.cantidad,
      cantFinal: r.cantFinal ?? "",
      usuario: r.usuario || "",
      alertas: r.flags.join(" "),
      nivel: r.nivel,
      intervalo,
    }));
    await onGuardarCruce(rows);
    setGuardando(false); setGuardado(true);
  };

  const onDrop = (setter) => (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setter(f); };

  const procesar = async () => {
    setError(""); setProcesando(true); setGuardado(false);
    try {
      const [L, H] = await Promise.all([
        libro ? readWorkbookSmart(libro) : { rows: [], sheet: "" },
        historico ? readWorkbookSmart(historico) : { rows: [], sheet: "" },
      ]);
      const rowsL = L.rows.map((r, i) => normalizeRow(r, "Libro", i));
      const rowsH = H.rows.map((r, i) => normalizeRow(r, "Histórico", i));

      // Aviso de privacidad: posible nombre de paciente en notas -> se avisa y no se usa
      const posibleNombre = [...rowsL, ...rowsH].some((r) => /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(r.nota));
      if (posibleNombre && onNombrePaciente) onNombrePaciente();

      // Cruce tolerante — Paso 1: huella fuerte (Código V | cantidad | cantidad final global)
      const fp = (r) => `${r.codigoV}|${r.cantidad}|${r.cantFinal}`;
      const poolH = new Map();
      rowsH.forEach((r) => { const k = fp(r); (poolH.get(k) || poolH.set(k, []).get(k)).push(r); });
      const unified = [];
      const usadosH = new Set();
      const restoL = [];
      rowsL.forEach((r) => {
        const arr = poolH.get(fp(r));
        const h = arr && arr.find((x) => !usadosH.has(x.id));
        if (h) { usadosH.add(h.id); unified.push(mergeLH(r, h)); } else restoL.push(r);
      });
      // Paso 2: huella débil (Código V | cantidad | día) para lo no casado
      const poolH2 = new Map();
      rowsH.forEach((r) => { if (!usadosH.has(r.id)) { const k = `${r.codigoV}|${r.cantidad}|${r.day}`; (poolH2.get(k) || poolH2.set(k, []).get(k)).push(r); } });
      restoL.forEach((r) => {
        const arr = poolH2.get(`${r.codigoV}|${r.cantidad}|${r.day}`);
        const h = arr && arr.find((x) => !usadosH.has(x.id));
        if (h) { usadosH.add(h.id); unified.push(mergeLH(r, h)); }
        else unified.push({ ...r, cruce: "solo Libro", seqBase: r.idx });
      });
      rowsH.forEach((r) => { if (!usadosH.has(r.id)) unified.push({ ...r, cruce: "solo Histórico", seqBase: r.idx }); });

      const analizados = analizarMovimientos(unified);
      setResultado(analizados);
      setDiag({ libro: rowsL.length, historico: rowsH.length, cruzadas: unified.filter((u) => u.cruce === "ambos").length, hojaL: L.sheet, hojaH: H.sheet });

      // Aviso ligero en Inicio: solo el recuento del último análisis (sin volcar la lista)
      const nc = analizados.filter((r) => r.nivel === "crit").length;
      const nw = analizados.filter((r) => r.nivel === "warn").length;
      if (onResumen) onResumen({ criticas: nc, vigilar: nw, fecha: Date.now() });
    } catch (err) { setError("No se pudieron procesar los archivos: " + err.message); }
    setProcesando(false);
  };

  const vista = resultado ? (soloAlertas ? resultado.filter((r) => r.flags.length) : resultado) : [];
  const nCrit = resultado ? resultado.filter((r) => r.nivel === "crit").length : 0;
  const nWarn = resultado ? resultado.filter((r) => r.nivel === "warn").length : 0;

  return (
    <div>
      <SectionTitle title="Detector de alertas" desc="Cruza el Libro de Estupefacientes con el Histórico del SADE y detecta movimientos sospechosos (E01–E12)." />
      {!resultado && (
        <Card>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[["Libro de Estupefacientes", libro, setLibro], ["Histórico del SADE", historico, setHistorico]].map(([tit, val, set]) => (
              <div key={tit} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(set)} style={{
                flex: 1, minWidth: 260, border: `2px dashed ${val ? C.accent : C.border}`, borderRadius: 14, padding: 26, textAlign: "center", background: val ? "#EEF0FF" : "#FAFBFF",
              }}>
                <FileSpreadsheet size={30} color={val ? C.accent : C.sub} />
                <div style={{ fontWeight: 700, marginTop: 8, color: C.text }}>{tit}</div>
                {val ? <div style={{ color: C.accent, fontSize: 13, marginTop: 6 }}>{val.name}</div>
                  : <div style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>Arrastra el .xlsx aquí o selecciónalo</div>}
                <label style={{ ...btnGhost, marginTop: 12, cursor: "pointer", display: "inline-flex" }}>
                  <Upload size={15} /> Elegir archivo
                  <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => set(e.target.files[0])} />
                </label>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="Intervalo — desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ ...inputStyle, width: 190 }} /></Field>
            <Field label="Intervalo — hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ ...inputStyle, width: 190 }} /></Field>
            <button style={{ ...btnPrimary, opacity: libro && historico ? 1 : 0.5 }} disabled={!libro || !historico || procesando} onClick={procesar}>
              {procesando ? <RefreshCw size={16} /> : <ShieldAlert size={16} />}{procesando ? "Analizando…" : "Cruzar y analizar"}
            </button>
          </div>
          {error && <div style={{ marginTop: 12, color: C.red, fontSize: 13 }}>{error}</div>}
          <div style={{ marginTop: 14, fontSize: 12, color: C.sub, display: "flex", gap: 6, alignItems: "center" }}><Info size={14} /> El serial de fecha del SADE se conserva con su hora si existe; si no, se respeta el orden de filas del Histórico como cronología intradía. Los nombres de paciente nunca se almacenan.</div>
        </Card>
      )}

      {resultado && (
        <>
          {diag && (
            <Card style={{ marginBottom: 14, background: "#F8F9FF" }}>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: C.text }}>
                <span style={{ fontWeight: 700 }}>Diagnóstico del cruce:</span>
                <span>Libro <b>{diag.libro}</b> filas{diag.hojaL ? ` · hoja "${diag.hojaL}"` : ""}</span>
                <span>Histórico <b>{diag.historico}</b> filas{diag.hojaH ? ` · hoja "${diag.hojaH}"` : ""}</span>
                <span>Cruzadas <b>{diag.cruzadas}</b></span>
                {(diag.libro === 0 || diag.historico === 0) && <Badge level="crit">Un archivo se leyó vacío — revisa la hoja/cabecera</Badge>}
                {diag.libro > 0 && diag.historico > 0 && diag.cruzadas === 0 && <Badge level="warn">Sin coincidencias — probable fecha aplanada (sin hora) o Código V no reconocido</Badge>}
              </div>
            </Card>
          )}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <Badge level="crit">{nCrit} críticas</Badge>
            <Badge level="warn">{nWarn} de vigilar</Badge>
            <Badge level="none">{resultado.length} movimientos</Badge>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, color: C.text, cursor: "pointer", marginLeft: 8 }}>
              <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} /> Ver solo movimientos con alerta
            </label>
            <button
              style={{ ...btnPrimary, marginLeft: "auto", opacity: (sheetsConnected && !guardado) ? 1 : 0.55 }}
              disabled={!sheetsConnected || guardando || guardado}
              onClick={guardarEnSheets}
              title={sheetsConnected ? "Guardar la tabla completa en la pestaña Cruces" : "Configura la conexión con Sheets para guardar"}>
              {guardando ? <RefreshCw size={15} /> : guardado ? <CheckCircle2 size={15} /> : <Save size={15} />}
              {guardando ? "Guardando…" : guardado ? "Guardado en Sheets" : "Guardar tabla en base de datos"}
            </button>
            <button style={btnGhost} onClick={() => { setResultado(null); setDiag(null); setLibro(null); setHistorico(null); setGuardado(false); }}><RefreshCw size={15} /> Nuevo análisis</button>
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                <thead><tr>
                  <th style={th}>Medicamento</th><th style={th}>Código V</th><th style={th}>Fecha movimiento</th><th style={th}>Tipo de movimiento</th><th style={th}>Médico</th><th style={th}>Cantidad</th><th style={th}>Cantidad final</th><th style={th}>Usuario</th><th style={th}>Alertas</th>
                </tr></thead>
                <tbody>
                  {vista.map((r) => (
                    <tr key={r.id} style={{ background: rowBg[r.nivel] }}>
                      <td style={{ ...td, minWidth: 210 }}>{r.medicamento}{r.cruce !== "ambos" && <span style={{ marginLeft: 6, fontSize: 11, color: C.sub }}>({r.cruce})</span>}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.codigoV || "—"}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{r.fechaTxt || r.day || "—"}</td>
                      <td style={td}>{r.tipo || "—"}</td>
                      <td style={td}>{r.medico || "—"}</td>
                      <td style={td}>{r.cantidad}</td>
                      <td style={td}>{r.cantFinal ?? "—"}</td>
                      <td style={td}>{r.usuario || "—"}</td>
                      <td style={td}>{r.flags.length ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{r.flags.map((f) => <Badge key={f} level={ERROR_CATALOG[f].nivel}>{f}</Badge>)}</div> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: C.text }}>Leyenda de códigos detectados</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[...new Set(resultado.flatMap((r) => r.flags))].sort().map((f) => (
                <span key={f} style={{ fontSize: 12, color: C.text }}><Badge level={ERROR_CATALOG[f].nivel}>{f}</Badge> {ERROR_CATALOG[f].nombre}</span>
              ))}
              {resultado.every((r) => !r.flags.length) && <span style={{ fontSize: 13, color: C.sub }}>Sin alertas detectadas en el intervalo.</span>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ===========================================================================
   4) REGISTRO DE PEDIDOS
=========================================================================== */
function estadoPedido(p) {
  if (p.noServido) return "No servido";
  if (p.fechaEntrada) {
    if ((Number(p.udsRecibidas) < Number(p.udsPedidas)) || (p.incidencias && p.incidencias.trim())) return "Incidencia";
    return "Recibido";
  }
  return "Pendiente";
}
const estadoBadge = { Pendiente: "info", Recibido: "ok", Incidencia: "warn", "No servido": "crit" };

function RegistroPedidos({ pedidos, onCreate, onUpdate, meds, prefill, clearPrefill }) {
  const [openNew, setOpenNew] = useState(false);
  const [openRecep, setOpenRecep] = useState(null);
  const [f, setF] = useState({});
  const [r, setR] = useState({});

  // Prefill desde una alerta de reposición: abre el drawer con el medicamento cargado
  useEffect(() => { if (prefill) { setF({ ...prefill }); setOpenNew(true); } }, [prefill]);

  const cerrarNuevo = () => { setOpenNew(false); setF({}); if (clearPrefill) clearPrefill(); };
  const crear = async () => {
    const nuevo = { id: uid(), ...f, uds: f.udsPedidas, estado: "Pendiente", noServido: false, avisoLlegada: false };
    await onCreate(nuevo); cerrarNuevo();
  };
  const recepcionar = async () => {
    const upd = { ...openRecep, ...r, noServido: !!r.noServido };
    upd.estado = estadoPedido(upd);
    await onUpdate(upd); setOpenRecep(null); setR({});
  };
  const avisar = async (p) => { await onUpdate({ ...p, avisoLlegada: true, horaAviso: new Date().toISOString() }); };

  return (
    <div>
      <SectionTitle title="Registro de pedidos" desc="Sustituye el Excel de seguimiento de pedidos a proveedor." right={<button style={btnPrimary} onClick={() => setOpenNew(true)}><Plus size={16} /> Nuevo pedido</button>} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead><tr>
              <th style={th}>Vale</th><th style={th}>CN</th><th style={th}>Estupefaciente</th><th style={th}>Proveedor</th><th style={th}>F. pedido</th><th style={th}>Pedidas</th><th style={th}>Recibidas</th><th style={th}>Estado</th><th style={th}>Acción</th>
            </tr></thead>
            <tbody>
              {pedidos.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: C.sub, padding: 26 }}>Sin pedidos registrados.</td></tr>}
              {pedidos.map((p) => {
                const est = estadoPedido(p);
                return (
                  <tr key={p.id}>
                    <td style={td}>{p.vale}</td><td style={td}>{p.cn}</td><td style={{ ...td, minWidth: 200 }}>{p.estupefaciente}</td>
                    <td style={td}>{p.proveedor}</td><td style={td}>{fmtDate(p.fechaPedido)}</td><td style={td}>{p.udsPedidas}</td>
                    <td style={td}>{p.udsRecibidas ?? "—"}</td>
                    <td style={td}><Badge level={estadoBadge[est]}>{est}</Badge></td>
                    <td style={td}>
                      {est === "Pendiente" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          {!p.avisoLlegada && <button style={microBtn} onClick={() => avisar(p)}><Truck size={13} /> Avisar llegada</button>}
                          <button style={{ ...microBtn, background: C.accent, color: "#fff", border: "none" }} onClick={() => { setOpenRecep(p); setR({ fechaEntrada: todayISO(), udsRecibidas: p.udsPedidas }); }}>Recepcionar</button>
                        </div>
                      ) : <button style={microBtn} onClick={() => { setOpenRecep(p); setR({ fechaEntrada: p.fechaEntrada || todayISO(), udsRecibidas: p.udsRecibidas ?? p.udsPedidas, farmaceutico: p.farmaceutico, incidencias: p.incidencias, noServido: p.noServido }); }}>Editar</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Nuevo pedido */}
      <Drawer open={openNew} title="Nuevo pedido" onClose={cerrarNuevo}
        footer={<><button style={btnGhost} onClick={cerrarNuevo}>Cancelar</button><button style={btnPrimary} onClick={crear}><Save size={15} /> Crear</button></>}>
        <Field label="Nº de vale"><input style={inputStyle} value={f.vale || ""} onChange={(e) => setF({ ...f, vale: e.target.value })} /></Field>
        <Field label="CN (Código Nacional)"><input style={inputStyle} value={f.cn || ""} onChange={(e) => setF({ ...f, cn: e.target.value })} /></Field>
        <Field label="Estupefaciente (Código V + nombre)">
          <select style={inputStyle} value={f.estupefaciente || ""} onChange={(e) => setF({ ...f, estupefaciente: e.target.value })}>
            <option value="">— Seleccionar —</option>
            {meds.map((m) => <option key={m.codigoV} value={`${m.codigoV} · ${m.nombre}`}>{m.codigoV} · {m.nombre}</option>)}
          </select>
        </Field>
        <Field label="Fecha de pedido"><input type="date" style={inputStyle} value={f.fechaPedido || todayISO()} onChange={(e) => setF({ ...f, fechaPedido: e.target.value })} /></Field>
        <Field label="Unidades pedidas"><input type="number" style={inputStyle} value={f.udsPedidas || ""} onChange={(e) => setF({ ...f, udsPedidas: e.target.value })} /></Field>
        <Field label="Proveedor">
          <select style={inputStyle} value={f.proveedor || ""} onChange={(e) => setF({ ...f, proveedor: e.target.value })}>
            <option value="">— Seleccionar —</option>{PROVEEDORES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Incidencias previas (opcional)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={f.incidenciasPrevias || ""} onChange={(e) => setF({ ...f, incidenciasPrevias: e.target.value })} /></Field>
      </Drawer>

      {/* Recepción */}
      <Drawer open={!!openRecep} title="Recepción de pedido" onClose={() => setOpenRecep(null)}
        footer={<><button style={btnGhost} onClick={() => setOpenRecep(null)}>Cancelar</button><button style={btnPrimary} onClick={recepcionar}><Save size={15} /> Guardar recepción</button></>}>
        {openRecep && <>
          <div style={{ background: "#F3F4F6", borderRadius: 10, padding: 12, fontSize: 13, color: C.text }}>
            <b>{openRecep.estupefaciente}</b><br />Vale {openRecep.vale} · {openRecep.udsPedidas} uds pedidas · {openRecep.proveedor}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, fontWeight: 600, color: C.text }}>
            <input type="checkbox" checked={!!r.noServido} onChange={(e) => setR({ ...r, noServido: e.target.checked })} /> No lo sirven / Pedido anulado
          </label>
          {!r.noServido ? <>
            <Field label="Fecha de entrada"><input type="date" style={inputStyle} value={r.fechaEntrada || ""} onChange={(e) => setR({ ...r, fechaEntrada: e.target.value })} /></Field>
            <Field label="Unidades recibidas"><input type="number" style={inputStyle} value={r.udsRecibidas ?? ""} onChange={(e) => setR({ ...r, udsRecibidas: e.target.value })} /></Field>
            <Field label="Farmacéutico que recepciona"><input style={inputStyle} value={r.farmaceutico || ""} onChange={(e) => setR({ ...r, farmaceutico: e.target.value })} /></Field>
            <Field label="Incidencias (opcional)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={r.incidencias || ""} onChange={(e) => setR({ ...r, incidencias: e.target.value })} /></Field>
          </> : (
            <Field label="Explicación de la incidencia (obligatorio)"><textarea style={{ ...inputStyle, minHeight: 80, borderColor: (r.incidencias && r.incidencias.trim()) ? C.border : C.red }} value={r.incidencias || ""} onChange={(e) => setR({ ...r, incidencias: e.target.value })} placeholder="Motivo por el que no se sirvió el pedido" /></Field>
          )}
        </>}
      </Drawer>
    </div>
  );
}
const microBtn = { fontSize: 12, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center", color: C.text, fontWeight: 600 };

/* ===========================================================================
   5) REGISTRO DE MEDICAMENTOS CADUCADOS
=========================================================================== */
function Caducados({ caducados, onCreate }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({});
  const [q, setQ] = useState("");
  const [d1, setD1] = useState(""); const [d2, setD2] = useState("");

  const guardar = async () => { await onCreate({ id: uid(), ...f }); setOpen(false); setF({}); };
  const list = caducados
    .filter((c) => !q || (c.nombre || "").toLowerCase().includes(q.toLowerCase()) || (c.cn || "").includes(q))
    .filter((c) => (!d1 || c.fechaCaducidad >= d1) && (!d2 || c.fechaCaducidad <= d2))
    .sort((a, b) => (b.fechaCaducidad || "").localeCompare(a.fechaCaducidad || ""));

  return (
    <div>
      <SectionTitle title="Medicamentos caducados" desc="Fuente de datos de la futura Declaración Semestral de Caducados." right={<button style={btnPrimary} onClick={() => setOpen(true)}><Plus size={16} /> Registrar caducado</button>} />
      <Card style={{ marginBottom: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 220 }}><label style={labelStyle}><Search size={13} style={{ verticalAlign: "middle" }} /> Buscar por nombre o CN</label><input style={inputStyle} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Field label="Desde"><input type="date" style={{ ...inputStyle, width: 170 }} value={d1} onChange={(e) => setD1(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" style={{ ...inputStyle, width: 170 }} value={d2} onChange={(e) => setD2(e.target.value)} /></Field>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>CN</th><th style={th}>Nombre</th><th style={th}>Lote</th><th style={th}>Fecha caducidad</th><th style={th}>Uds. caducadas</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: C.sub, padding: 26 }}>Sin registros.</td></tr>}
            {list.map((c) => (
              <tr key={c.id}><td style={td}>{c.cn}</td><td style={td}>{c.nombre}</td><td style={td}>{c.lote}</td><td style={td}>{fmtDate(c.fechaCaducidad)}</td><td style={td}>{c.unidades}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Drawer open={open} title="Registrar medicamento caducado" onClose={() => setOpen(false)}
        footer={<><button style={btnGhost} onClick={() => setOpen(false)}>Cancelar</button><button style={btnPrimary} onClick={guardar}><Save size={15} /> Guardar</button></>}>
        <Field label="CN (Código Nacional)"><input style={inputStyle} value={f.cn || ""} onChange={(e) => setF({ ...f, cn: e.target.value })} /></Field>
        <Field label="Nombre del medicamento"><input style={inputStyle} value={f.nombre || ""} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Lote"><input style={inputStyle} value={f.lote || ""} onChange={(e) => setF({ ...f, lote: e.target.value })} /></Field>
        <Field label="Fecha de caducidad"><input type="date" style={inputStyle} value={f.fechaCaducidad || ""} onChange={(e) => setF({ ...f, fechaCaducidad: e.target.value })} /></Field>
        <Field label="Unidades caducadas"><input type="number" style={inputStyle} value={f.unidades || ""} onChange={(e) => setF({ ...f, unidades: e.target.value })} /></Field>
      </Drawer>
    </div>
  );
}

/* ===========================================================================
   6) REGISTRO DE INCIDENCIAS
=========================================================================== */
function Incidencias({ incidencias, onCreate, onUpdate, prefill, clearPrefill, meds }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({});

  useEffect(() => { if (prefill) { setF({ estado: "Pendiente", ...prefill }); setOpen(true); } }, [prefill]);

  const guardar = async () => {
    if (f.id) await onUpdate(f); else await onCreate({ id: uid(), estado: "Pendiente", ...f });
    setOpen(false); setF({}); if (clearPrefill) clearPrefill();
  };
  const abrir = (inc) => { setF(inc || { estado: "Pendiente", fechaHora: new Date().toISOString().slice(0, 16) }); setOpen(true); };

  const stats = {
    activas: incidencias.filter((i) => i.estado !== "Resuelta").length,
    pend: incidencias.filter((i) => i.estado === "Pendiente").length,
    resueltasMes: incidencias.filter((i) => i.estado === "Resuelta").length,
    total: incidencias.length,
  };
  const grupos = ["Pendiente", "En revisión", "Resuelta"];

  return (
    <div>
      <SectionTitle title="Registro de incidencias" desc="Movimientos anómalos documentados con su resolución." right={<button style={btnPrimary} onClick={() => abrir()}><Plus size={16} /> Nueva incidencia</button>} />
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard icon={<AlertTriangle size={18} />} label="Activas" value={stats.activas} tone="warn" />
        <StatCard icon={<Clock size={18} />} label="Pendientes" value={stats.pend} tone="crit" />
        <StatCard icon={<CheckCircle2 size={18} />} label="Resueltas" value={stats.resueltasMes} tone="ok" />
        <StatCard icon={<ListChecks size={18} />} label="Total historial" value={stats.total} tone="info" />
      </div>
      {grupos.map((g) => {
        const items = incidencias.filter((i) => (i.estado || "Pendiente") === g);
        if (!items.length) return null;
        return (
          <div key={g} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: C.sub, fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{g} ({items.length})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12 }}>
              {items.map((i) => (
                <Card key={i.id} style={{ cursor: "pointer" }} >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{i.tipo || "Incidencia"}</div>
                    <Badge level={i.estado === "Resuelta" ? "ok" : i.estado === "En revisión" ? "info" : "warn"}>{i.estado}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 6 }}>{i.medicamento}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{i.fechaHora?.replace("T", " ")} · {i.sistema} · {i.cantidad} uds</div>
                  {i.descripcion && <div style={{ fontSize: 12, color: C.text, marginTop: 8 }}>{i.descripcion.slice(0, 110)}{i.descripcion.length > 110 ? "…" : ""}</div>}
                  <button style={{ ...microBtn, marginTop: 10 }} onClick={() => abrir(i)}>Abrir <ChevronRight size={13} /></button>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
      {incidencias.length === 0 && <Card><Empty icon={<ShieldAlert size={26} />} text="Sin incidencias registradas." /></Card>}

      <Drawer open={open} wide title={f.id ? "Editar incidencia" : "Nueva incidencia"} onClose={() => { setOpen(false); if (clearPrefill) clearPrefill(); }}
        footer={<><button style={btnGhost} onClick={() => { setOpen(false); if (clearPrefill) clearPrefill(); }}>Cancelar</button><button style={btnPrimary} onClick={guardar}><Save size={15} /> Guardar</button></>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Tipo de incidencia"><select style={inputStyle} value={f.tipo || ""} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">—</option>{TIPOS_INCIDENCIA.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Sistema involucrado"><select style={inputStyle} value={f.sistema || ""} onChange={(e) => setF({ ...f, sistema: e.target.value })}><option value="">—</option>{SISTEMAS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <Field label="Medicamento comprometido (Código V + nombre)">
          <select style={inputStyle} value={f.medicamento || ""} onChange={(e) => setF({ ...f, medicamento: e.target.value })}>
            <option value="">—</option>{meds.map((m) => <option key={m.codigoV} value={`${m.codigoV} · ${m.nombre}`}>{m.codigoV} · {m.nombre}</option>)}
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Fecha y hora"><input type="datetime-local" style={inputStyle} value={f.fechaHora || ""} onChange={(e) => setF({ ...f, fechaHora: e.target.value })} /></Field>
          <Field label="Cantidad afectada"><input type="number" style={inputStyle} value={f.cantidad || ""} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></Field>
        </div>
        <Field label="Movimiento registrado (lo que apareció en el sistema)"><input style={inputStyle} value={f.movimiento || ""} onChange={(e) => setF({ ...f, movimiento: e.target.value })} /></Field>
        <Field label="Descripción del problema"><textarea style={{ ...inputStyle, minHeight: 70 }} value={f.descripcion || ""} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Field>
        <Field label="Medida correctiva adoptada (puede rellenarse después)"><textarea style={{ ...inputStyle, minHeight: 70 }} value={f.medida || ""} onChange={(e) => setF({ ...f, medida: e.target.value })} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Estado"><select style={inputStyle} value={f.estado || "Pendiente"} onChange={(e) => setF({ ...f, estado: e.target.value })}>{["Pendiente", "En revisión", "Resuelta"].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Farmacéutico que registra"><input style={inputStyle} value={f.farmaceutico || ""} onChange={(e) => setF({ ...f, farmaceutico: e.target.value })} /></Field>
        </div>
      </Drawer>
    </div>
  );
}

/* ===========================================================================
   INICIO
=========================================================================== */
function Inicio({ inventarios, pedidos, resumenAlertas, avisosRepo, goTo }) {
  const fechas = [...new Set(inventarios.map((r) => r.fecha))].sort().reverse();
  const ultima = fechas[0];
  const dias = ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86400000) : null;
  const ultInv = inventarios.filter((r) => r.fecha === ultima);
  const descuadres = ultInv.filter((r) => discColor(r.descRealD07) !== "none" || discColor(r.descD07Maestro) !== "none");
  const descOral = descuadres.filter((r) => r.grupo === "ORAL").length;
  const descIV = descuadres.filter((r) => r.grupo === "IV").length;
  const sinDesc = ultInv.length - descuadres.length;
  const pendPedidos = pedidos.filter((p) => estadoPedido(p) === "Pendiente").length;
  const avisadosLlegada = pedidos.filter((p) => estadoPedido(p) === "Pendiente" && p.avisoLlegada);

  return (
    <div>
      <SectionTitle title="Inicio" desc="Estado general de la gestión de estupefacientes del Servicio de Farmacia." />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard icon={<ClipboardList size={18} />} label="Desde último inventario" value={dias == null ? "—" : `${dias} días`} sub={ultima ? fmtDate(ultima) : "Sin inventarios"} tone="info" />
        <StatCard icon={<AlertTriangle size={18} />} label="Descuadres activos" value={descuadres.length} sub={`${descOral} orales · ${descIV} IV`} tone={descuadres.length ? "warn" : "ok"} />
        <StatCard icon={<CheckCircle2 size={18} />} label="Sin descuadre" value={ultInv.length ? `${sinDesc}/${ultInv.length}` : "—"} tone="ok" />
        <StatCard icon={<PackageSearch size={18} />} label="Pedidos pendientes" value={pendPedidos} tone={pendPedidos ? "warn" : "ok"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <div style={{ fontWeight: 700, color: C.text, display: "flex", gap: 8, alignItems: "center" }}><ShieldAlert size={17} /> Detector de alertas
            {resumenAlertas && resumenAlertas.fecha && <span style={{ marginLeft: "auto" }}><Badge level={resumenAlertas.criticas ? "crit" : "ok"}>{resumenAlertas.criticas} críticas</Badge></span>}
          </div>
          {(!resumenAlertas || !resumenAlertas.fecha) ? (
            <Empty small icon={<ShieldAlert size={22} />} text="Aún no has ejecutado el Detector de alertas." />
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, color: C.text }}>Último análisis: <b>{resumenAlertas.criticas}</b> críticas · <b>{resumenAlertas.vigilar}</b> de vigilar</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{fmtDateTime(new Date(resumenAlertas.fecha))}</div>
              <button style={{ ...microBtn, marginTop: 10, background: C.accent, color: "#fff", border: "none" }} onClick={() => goTo("detector")}>Ver detalle en el Detector <ArrowRight size={13} /></button>
            </div>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, color: C.text, display: "flex", gap: 8, alignItems: "center" }}><Truck size={17} /> Pedidos llegados pendientes de recepción</div>
            {avisadosLlegada.length === 0 ? <Empty small icon={<Truck size={22} />} text="Sin avisos de llegada pendientes." />
              : avisadosLlegada.map((p) => (
                <div key={p.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.estupefaciente}</div><div style={{ fontSize: 12, color: C.sub }}>Vale {p.vale} · avisado {p.horaAviso ? fmtDateTime(new Date(p.horaAviso)) : ""}</div></div>
                  <button style={{ ...microBtn, background: C.accent, color: "#fff", border: "none" }} onClick={() => goTo("pedidos")}>Recepcionar</button>
                </div>
              ))}
          </Card>
          <Card>
            <div style={{ fontWeight: 700, color: C.text, display: "flex", gap: 8, alignItems: "center" }}><PackageSearch size={17} /> Avisos de reposición de stock</div>
            {(!avisosRepo || avisosRepo.length === 0) ? <Empty small icon={<PackageSearch size={22} />} text="Sin avisos de reposición del último inventario." />
              : avisosRepo.map((a, i) => (
                <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, marginTop: 8, background: a.level === "crit" ? C.redBg : C.yellowBg }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.nombre} <span style={{ fontFamily: "monospace", fontSize: 11, color: C.sub }}>({a.codigoV})</span></div>
                  <div style={{ fontSize: 12, color: C.sub }}>{a.accion} · stock real {a.real}</div>
                </div>
              ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Empty({ icon, text, small }) {
  return (
    <div style={{ textAlign: "center", padding: small ? "16px 8px" : "34px 16px", color: C.sub }}>
      <div style={{ opacity: 0.5 }}>{icon}</div>
      <div style={{ marginTop: 8, fontSize: small ? 12 : 14 }}>{text}</div>
    </div>
  );
}

/* ===========================================================================
   ALERTAS (accionables)
=========================================================================== */
function AlertasView({ alertas, onEstado, onPedir }) {
  const [tipo, setTipo] = useState("todos");
  const [verCerradas, setVerCerradas] = useState(false);

  const codigos = useMemo(() => {
    const s = new Set();
    alertas.forEach((a) => String(a.codigos || "").split(/\s+/).filter(Boolean).forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [alertas]);

  const filtradas = alertas.filter((a) => {
    if (!verCerradas && a.estado !== "pendiente") return false;
    if (tipo === "todos") return true;
    if (tipo === "pedido") return a.tipo === "pedido";
    return String(a.codigos || "").split(/\s+/).includes(tipo);
  });
  const pend = alertas.filter((a) => a.estado === "pendiente").length;
  const estadoBadgeLevel = { pendiente: "warn", hecha: "ok", descartada: "none" };

  return (
    <div>
      <SectionTitle title="Alertas" desc="Avisos de reposición (pedir medicamento) y alertas del Detector (E01–E12), accionables."
        right={<div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, width: "auto" }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            <option value="pedido">Pedido (reposición)</option>
            {codigos.map((c) => <option key={c} value={c}>{c}{ERROR_CATALOG[c] ? ` · ${ERROR_CATALOG[c].nombre}` : ""}</option>)}
          </select>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, color: C.text, cursor: "pointer" }}>
            <input type="checkbox" checked={verCerradas} onChange={(e) => setVerCerradas(e.target.checked)} /> Ver hechas/descartadas
          </label>
        </div>} />

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Badge level={pend ? "warn" : "ok"}>{pend} pendientes</Badge>
        <Badge level="none">{alertas.length} en total</Badge>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead><tr>
              <th style={th}>Nivel</th><th style={th}>Tipo</th><th style={th}>Medicamento</th>
              <th style={th}>Código V</th><th style={th}>Fecha</th><th style={th}>Detalle</th>
              <th style={th}>Estado</th><th style={th}>Acciones</th>
            </tr></thead>
            <tbody>
              {filtradas.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: C.sub, padding: 26 }}>Sin alertas para este filtro.</td></tr>}
              {filtradas.map((a) => (
                <tr key={a.id} style={{ background: a.estado !== "pendiente" ? "#F9FAFB" : (rowBg[a.nivel] || "#fff") }}>
                  <td style={td}><Badge level={a.nivel || "none"}>{a.nivel === "crit" ? "Crítica" : a.nivel === "warn" ? "Vigilar" : "—"}</Badge></td>
                  <td style={td}>{a.tipo === "pedido" ? <Badge level="info">Pedido</Badge> : (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {String(a.codigos || "").split(/\s+/).filter(Boolean).map((c) => <Badge key={c} level={ERROR_CATALOG[c] ? ERROR_CATALOG[c].nivel : "none"}>{c}</Badge>)}
                    </div>
                  )}</td>
                  <td style={{ ...td, minWidth: 200 }}>{a.medicamento}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{a.codigoV || "—"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{a.fecha ? (String(a.fecha).includes("-") ? fmtDate(a.fecha) : a.fecha) : "—"}</td>
                  <td style={td}>{a.detalle}</td>
                  <td style={td}><Badge level={estadoBadgeLevel[a.estado] || "none"}>{a.estado}</Badge></td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {a.estado === "pendiente" ? <>
                        {a.tipo === "pedido" && <button style={{ ...microBtn, background: C.accent, color: "#fff", border: "none" }} onClick={() => onPedir(a)}><PackageSearch size={13} /> Pedir</button>}
                        <button style={microBtn} onClick={() => onEstado(a.id, "hecha")}><CheckCircle2 size={13} /> Hecha</button>
                        <button style={microBtn} onClick={() => onEstado(a.id, "descartada")}><X size={13} /> Descartar</button>
                      </> : (
                        <button style={microBtn} onClick={() => onEstado(a.id, "pendiente")}><RefreshCw size={13} /> Reabrir</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ===========================================================================
   APP PRINCIPAL
=========================================================================== */
const NAV = [
  ["inicio", "Inicio", Home],
  ["inventario", "Inventario semanal", ClipboardList],
  ["anteriores", "Inventarios anteriores", History],
  ["detector", "Detector de alertas", ShieldAlert],
  ["alertas", "Alertas", Bell],
  ["pedidos", "Registro de pedidos", PackageSearch],
  ["caducados", "Med. caducados", CalendarX],
  ["incidencias", "Incidencias", AlertTriangle],
];

export default function App() {
  const [view, setView] = useState("inicio");
  const [url, setUrl] = useState(resolveInitialUrl);
  const urlRef = useRef(url); urlRef.current = url;
  const api = useMemo(() => makeApi(() => urlRef.current), []);
  const [openSettings, setOpenSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [pendientes, setPendientes] = useState(() => outboxRead().length);

  // Estados de datos — inicializados desde localStorage (sobreviven a recarga / sin red)
  const [inventarios, setInventarios] = useState(() => lsGet(LS.data("Inventarios"), []));
  const [pedidos, setPedidos] = useState(() => lsGet(LS.data("Pedidos"), []));
  const [caducados, setCaducados] = useState(() => lsGet(LS.data("Caducados"), []));
  const [incidencias, setIncidencias] = useState(() => lsGet(LS.data("Incidencias"), []));
  const [meds, setMeds] = useState(() => lsGet(LS.data("Catalogo"), ALL_MEDS));
  const [alertas, setAlertas] = useState(() => lsGet(LS.data("Alertas"), []));
  const [resumenAlertas, setResumenAlertas] = useState(null);
  const [avisosRepo, setAvisosRepo] = useState([]);
  const [incPrefill, setIncPrefill] = useState(null);
  const [pedidoPrefill, setPedidoPrefill] = useState(null);

  const medByV = useMemo(() => Object.fromEntries(meds.map((m) => [m.codigoV, m])), [meds]);

  const notify = (msg, tone = "ok") => { setToast({ msg, tone }); setTimeout(() => setToast(null), 3200); };

  // Persistir cada dataset en localStorage cuando cambie
  useEffect(() => { lsSet(LS.data("Inventarios"), inventarios); }, [inventarios]);
  useEffect(() => { lsSet(LS.data("Pedidos"), pedidos); }, [pedidos]);
  useEffect(() => { lsSet(LS.data("Caducados"), caducados); }, [caducados]);
  useEffect(() => { lsSet(LS.data("Incidencias"), incidencias); }, [incidencias]);
  useEffect(() => { lsSet(LS.data("Catalogo"), meds); }, [meds]);
  useEffect(() => { lsSet(LS.data("Alertas"), alertas); }, [alertas]);

  // Vuelca la cola de escrituras pendientes al backend (idempotente por id)
  const flush = async () => { const restantes = await outboxFlush(api); setPendientes(restantes); return restantes; };

  // Carga desde Sheets (incluye el catálogo de medicamentos de la hoja "Catalogo")
  const cargar = async () => {
    if (!urlRef.current) return;
    setSyncing(true);
    try {
      await flush(); // primero sube lo pendiente para no pisarlo con la lectura
      const [inv, ped, cad, inc] = await Promise.all([
        api.list("Inventarios"), api.list("Pedidos"), api.list("Caducados"), api.list("Incidencias"),
      ]);
      setInventarios(inv.rows || []); setPedidos(ped.rows || []); setCaducados(cad.rows || []);
      setIncidencias(inc.rows || []);
      // Catálogo y alertas se leen aparte: si el backend aún no tiene la hoja, no rompen el resto
      try {
        const cat = await api.list("Catalogo");
        if (cat && cat.rows && cat.rows.length) setMeds(cat.rows.map(normalizeMed)); // hoja vacía → se mantiene la semilla
      } catch (e2) { /* backend sin hoja Catalogo: se usa la semilla local */ }
      try {
        const ale = await api.list("Alertas");
        if (ale && ale.rows) setAlertas(ale.rows);
      } catch (e3) { /* backend sin hoja Alertas: se mantienen las locales */ }
      notify("Datos cargados desde Google Sheets");
    } catch (e) { notify("Sin conexión a Sheets — trabajando en local", "warn"); }
    setSyncing(false);
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  // Reintentar la cola automáticamente al recuperar conexión
  useEffect(() => {
    const onOnline = () => { flush().then((n) => { if (n === 0) notify("Sincronizado con Google Sheets"); }); cargar(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line
  }, []);

  // Encola una escritura (persistida en el outbox) y la intenta enviar ya si hay conexión
  const enqueue = async (op) => { const n = outboxAdd(op); setPendientes(n); return flush(); };

  // Alertas — cambiar estado (hecha/descartada/pendiente) y pedir desde una alerta
  const marcarAlerta = async (id, estado) => {
    const actual = alertas.find((a) => a.id === id);
    setAlertas((prev) => prev.map((a) => a.id === id ? { ...a, estado } : a));
    await enqueue({ action: "update", sheet: "Alertas", id, row: { ...(actual || { id }), estado } });
  };
  const pedirDesdeAlerta = (a) => { setPedidoPrefill({ estupefaciente: `${a.codigoV} · ${a.medicamento}`, _alertaId: a.id }); setView("pedidos"); };

  // Sufijo de aviso cuando la escritura queda pendiente de sincronizar
  const pendSuffix = () => (!api.connected() || isOffline()) ? " · pendiente de sincronizar" : "";

  // Inventario (una escritura por lotes a la pestaña Inventarios)
  const guardarInventario = async ({ fecha, filas }) => {
    setInventarios((prev) => [...prev, ...filas]);
    await enqueue({ action: "appendMany", sheet: "Inventarios", rows: filas });
    // Avisos de reposición → se muestran y se registran como alertas accionables (pedido)
    const avisos = [];
    filas.forEach((f) => { const sl = stockLevel(f.real, medByV[f.codigoV]); if (sl && (sl.level === "warn" || sl.level === "crit")) avisos.push({ codigoV: f.codigoV, nombre: f.nombre, accion: sl.txt, real: f.real, level: sl.level }); });
    setAvisosRepo(avisos);
    if (avisos.length) {
      const alertRows = avisos.map((a) => alertaReposicion(a, fecha));
      setAlertas((prev) => mergeAlertas(prev, alertRows));
      await enqueue({ action: "appendMany", sheet: "Alertas", rows: alertRows });
    }
    notify(`Inventario guardado (${filas.length} líneas)${avisos.length ? ` · ${avisos.length} avisos de reposición` : ""}${pendSuffix()}`);
  };

  // Pedidos
  const crearPedido = async (p) => {
    const alertaId = p._alertaId; if (alertaId) delete p._alertaId; // enlace opcional a una alerta de reposición
    setPedidos((prev) => [p, ...prev]);
    await enqueue({ action: "append", sheet: "Pedidos", row: p });
    if (alertaId) await marcarAlerta(alertaId, "hecha");
    notify("Pedido creado" + pendSuffix());
  };
  const actualizarPedido = async (p) => { setPedidos((prev) => prev.map((x) => x.id === p.id ? p : x)); await enqueue({ action: "update", sheet: "Pedidos", id: p.id, row: p }); if (p.avisoLlegada && estadoPedido(p) === "Pendiente") notify("Aviso de llegada registrado — notificado al supervisor"); else notify("Pedido actualizado" + pendSuffix()); };

  // Caducados
  const crearCaducado = async (c) => { setCaducados((prev) => [c, ...prev]); await enqueue({ action: "append", sheet: "Caducados", row: c }); notify("Caducado registrado" + pendSuffix()); };

  // Incidencias
  const crearIncidencia = async (i) => { setIncidencias((prev) => [i, ...prev]); await enqueue({ action: "append", sheet: "Incidencias", row: i }); notify("Incidencia registrada" + pendSuffix()); };
  const actualizarIncidencia = async (i) => { setIncidencias((prev) => prev.map((x) => x.id === i.id ? i : x)); await enqueue({ action: "update", sheet: "Incidencias", id: i.id, row: i }); notify("Incidencia actualizada" + pendSuffix()); };

  // Resumen ligero del último análisis del Detector (solo recuento, sin checklist)
  const registrarResumenAlertas = (r) => { setResumenAlertas(r); if (r.criticas > 0) notify(`Detector: ${r.criticas} alertas críticas en el último análisis`, "warn"); };
  // Guarda la tabla completa del cruce en la pestaña "Cruces" (por lotes, vía cola offline-first)
  const guardarCruce = async (rows) => {
    await enqueue({ action: "appendMany", sheet: "Cruces", rows });
    // Las filas con flags se registran además como alertas accionables del detector
    const alertRows = rows.filter((r) => r.alertas && String(r.alertas).trim()).map(alertaDetector);
    if (alertRows.length) {
      setAlertas((prev) => mergeAlertas(prev, alertRows));
      await enqueue({ action: "appendMany", sheet: "Alertas", rows: alertRows });
    }
    notify(`Cruce guardado (${rows.length} filas)${alertRows.length ? ` · ${alertRows.length} alertas` : ""}${pendSuffix()}`);
  };

  const connected = api.connected();
  const alertasPend = alertas.filter((a) => a.estado === "pendiente").length;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: C.bg, color: C.text }}>
      {/* SIDEBAR */}
      <aside style={{ ...dotPattern, width: 240, color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "22px 20px 16px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>Gestor de Estupefacientes</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3 }}>Servicio de Farmacia · HUNSC</div>
        </div>
        <nav style={{ flex: 1, padding: "6px 12px" }}>
          {NAV.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setView(id)} style={{
              width: "100%", display: "flex", gap: 11, alignItems: "center", padding: "10px 12px", marginBottom: 4,
              borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "left",
              background: view === id ? "rgba(255,255,255,0.14)" : "transparent", color: view === id ? "#fff" : "rgba(255,255,255,0.72)",
            }}>
              <Icon size={17} /> {label}
              {id === "inicio" && resumenAlertas && resumenAlertas.criticas > 0 && <span style={{ marginLeft: "auto", background: C.red, borderRadius: 999, fontSize: 11, padding: "1px 7px" }}>{resumenAlertas.criticas}</span>}
              {id === "alertas" && alertasPend > 0 && <span style={{ marginLeft: "auto", background: C.accent, borderRadius: 999, fontSize: 11, padding: "1px 7px" }}>{alertasPend}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <button onClick={() => setOpenSettings(true)} style={{ width: "100%", display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "9px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {connected ? <Cloud size={15} /> : <CloudOff size={15} />} {connected ? "Sheets conectado" : "Configurar Sheets"}
          </button>
          {pendientes > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#FCD34D", textAlign: "center", display: "flex", gap: 5, alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={12} /> {pendientes} cambio{pendientes > 1 ? "s" : ""} sin sincronizar
            </div>
          )}
        </div>
      </aside>

      {/* CONTENIDO */}
      <main style={{ flex: 1, overflowY: "auto", padding: "26px 30px" }}>
        {!connected && (
          <div style={{ background: C.yellowBg, border: `1px solid ${C.yellow}`, color: "#854d0e", borderRadius: 12, padding: "10px 14px", marginBottom: 18, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
            <CloudOff size={16} /> Modo local: los datos se guardan en este equipo y se sincronizarán con Google Sheets al configurar la URL del Web App (botón «Configurar Sheets»).
          </div>
        )}
        {view === "inicio" && <Inicio inventarios={inventarios} pedidos={pedidos} resumenAlertas={resumenAlertas} avisosRepo={avisosRepo} goTo={setView} />}
        {view === "inventario" && <InventarioSemanal onSaved={guardarInventario} avisos={avisosRepo} meds={meds} medByV={medByV} />}
        {view === "anteriores" && <InventariosAnteriores inventarios={inventarios} />}
        {view === "detector" && <DetectorAlertas onResumen={registrarResumenAlertas} onGuardarCruce={guardarCruce} sheetsConnected={connected} onNombrePaciente={() => notify("⚠️ Posible nombre de paciente detectado y excluido del procesamiento", "crit")} />}
        {view === "alertas" && <AlertasView alertas={alertas} onEstado={marcarAlerta} onPedir={pedirDesdeAlerta} />}
        {view === "pedidos" && <RegistroPedidos pedidos={pedidos} onCreate={crearPedido} onUpdate={actualizarPedido} meds={meds} prefill={pedidoPrefill} clearPrefill={() => setPedidoPrefill(null)} />}
        {view === "caducados" && <Caducados caducados={caducados} onCreate={crearCaducado} />}
        {view === "incidencias" && <Incidencias incidencias={incidencias} onCreate={crearIncidencia} onUpdate={actualizarIncidencia} prefill={incPrefill} clearPrefill={() => setIncPrefill(null)} meds={meds} />}
      </main>

      {/* AJUSTES */}
      <Drawer open={openSettings} title="Conexión con Google Sheets" onClose={() => setOpenSettings(false)}
        footer={<><button style={btnGhost} onClick={() => setOpenSettings(false)}>Cerrar</button><button style={btnPrimary} onClick={async () => { const u = (url || "").trim(); if (u) lsSet(LS.url, u); else lsDel(LS.url); setUrl(u); setOpenSettings(false); await cargar(); }}><RefreshCw size={15} /> Guardar y sincronizar</button></>}>
        <p style={{ fontSize: 13, color: C.sub, marginTop: 0 }}>Pega la URL del <b>Web App</b> generada al desplegar el Apps Script (<code>Code.gs</code>). Se guarda en este equipo, así que <b>no hay que volver a introducirla</b>. Cada funcionalidad se guarda en su propia pestaña del Google Sheets.</p>
        <Field label="URL del Web App (…/exec)"><input style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" /></Field>
        <div style={{ marginTop: 12, fontSize: 12, color: C.sub }}>Estado: {connected ? <Badge level="ok">Conectado</Badge> : <Badge level="warn">Modo local</Badge>} {syncing && "· sincronizando…"} {pendientes > 0 && <Badge level="warn">{pendientes} sin sincronizar</Badge>}</div>
        <div style={{ marginTop: 16, background: "#F3F4F6", borderRadius: 10, padding: 12, fontSize: 12, color: C.text }}>
          Pestañas: <b>Inventarios, Pedidos, Caducados, Incidencias, Cruces, Catalogo</b>. Ninguna almacena nombres de paciente. Si defines <code>VITE_APPS_SCRIPT_URL</code> en Vercel, la URL viene ya configurada por defecto.
        </div>
      </Drawer>

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 60,
          background: toast.tone === "crit" ? C.red : toast.tone === "warn" ? C.yellow : C.indigo, color: "#fff",
          padding: "11px 18px", borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
