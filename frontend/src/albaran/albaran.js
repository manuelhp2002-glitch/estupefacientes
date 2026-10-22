// =============================================================================
// Lógica PURA del albarán de recepción (F4). Sin efectos ni llamadas de red.
// `estadoPedido` se INYECTA (no se duplica): es su única fuente de verdad.
// Solo lectura: nada de esto escribe en la base de datos.
// =============================================================================

// Pedidos que se pueden meter en un albarán: solo los Pendientes de recepcionar.
// Los pendientes con aviso de llegada siguen siendo Pendientes, así que entran.
export function pedidosPendientes(pedidos, estadoPedido) {
  return (pedidos || []).filter((p) => estadoPedido(p) === "Pendiente");
}

// ¿Es un pedido REAL? El Sheet trae filas de plantilla con solo el nº de vale o el
// proveedor, pero sin medicamento: no son pedidos. Un pedido es real si su campo
// `estupefaciente` tiene un nombre: no vacío, ni null, ni un guion, y si viene como
// "<CódigoV> · <nombre>" la parte del nombre tampoco puede estar vacía ("V00655 · ").
export function esPedidoReal(p) {
  const s = String((p && p.estupefaciente) == null ? "" : p.estupefaciente).trim();
  if (!s || s === "-" || s === "—") return false;
  const m = s.match(/^[VYT]\d{5}\s*·\s*(.*)$/i);
  if (m) return m[1].trim().length > 0;
  return true;
}

// Fecha local de Canarias en "aaaa-mm-dd" (o null). `fechaPedido` puede venir como
// "aaaa-mm-dd" (ya local, se devuelve igual) o como ISO de medianoche de Canarias,
// que en UTC cae el día anterior: se formatea con los getters LOCALES, nunca por el
// timestamp UTC, para que no se desplace de día.
export function toLocalYMD(fecha) {
  if (fecha == null || fecha === "") return null;
  if (typeof fecha === "string") {
    const m = fecha.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Pipeline de filtrado del albarán, en orden: 1) real, 2) pendiente, 3) fecha de
// corte, 4) proveedor. `estadoPedido` se inyecta en `deps` (no se duplica).
// Devuelve:
//   enVentana      → reales + pendientes + dentro del corte (antes de proveedor)
//   visibles       → enVentana filtrado por proveedor (lo que se lista)
//   ocultosPorCorte→ reales + pendientes que caen antes del corte (o sin fecha con corte)
//   proveedores    → proveedores presentes en enVentana (para el select)
//   totalReales    → reales + pendientes, sin corte (para decidir el estado "vacío")
// La comparación es por fecha local "aaaa-mm-dd" (orden lexicográfico = cronológico).
export function filtrarParaAlbaran(pedidos, opts, deps) {
  const { fechaCorte, proveedor } = opts || {};
  const { estadoPedido } = deps || {};
  const base = pedidosPendientes(pedidos, estadoPedido).filter(esPedidoReal);
  const corte = fechaCorte ? String(fechaCorte).trim() : "";
  const enVentana = [], ocultosPorCorte = [];
  base.forEach((p) => {
    if (!corte) { enVentana.push(p); return; }
    const ymd = toLocalYMD(p.fechaPedido);
    if (ymd == null) { ocultosPorCorte.push(p); return; } // sin fecha + hay corte → oculto
    if (ymd >= corte) enVentana.push(p); else ocultosPorCorte.push(p);
  });
  const proveedores = [...new Set(enVentana.map((p) => String(p.proveedor || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const prov = proveedor && proveedor !== "TODOS" ? proveedor : null;
  const visibles = prov ? enVentana.filter((p) => String(p.proveedor || "").trim() === prov) : enVentana;
  return { enVentana, visibles, ocultosPorCorte, proveedores, totalReales: base.length };
}

// Nombre del estupefaciente sin el prefijo de Código V. El campo se guarda como
// "<CódigoV> · <nombre>" (p. ej. "V00655 · MORFINA MST…"). Si no tiene ese formato,
// se devuelve el texto tal cual. El Código V no debe verse en la lista de elección.
export function nombreSinCodigoV(estupefaciente) {
  const s = String(estupefaciente == null ? "" : estupefaciente).trim();
  const m = s.match(/^[VYT]\d{5}\s*·\s*(.+)$/i);
  return m ? m[1].trim() : s;
}

// Número informativo de albarán: "ALB-AAAAMMDD-NN" (fecha local de Canarias).
// NN es el contador del día en este navegador; nunca se guarda en la base de datos.
export function numeroAlbaran(fecha, contador) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const nn = String(Math.max(1, Number(contador) || 1)).padStart(2, "0");
  return `ALB-${yyyy}${mm}${dd}-${nn}`;
}
