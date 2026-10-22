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
