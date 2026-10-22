// =============================================================================
// Lógica PURA del Inventario Rápido (F1 / F17). Sin efectos ni red.
// Privacidad: nada de esto toca datos de paciente. Identificador = Código V.
// =============================================================================

// Id determinista de una línea de inventario → upsert por (fecha, grupo, Código V).
// Guardar dos veces el mismo inventario actualiza la misma fila, nunca duplica.
export function invRowId(fecha, grupo, codigoV) {
  return `inv-${String(fecha)}-${String(grupo)}-${String(codigoV)}`;
}

// ¿Tiene valor un campo? Vacío ("" / null / undefined / solo espacios) = NO.
// Un 0 es un recuento válido y SÍ cuenta como relleno.
export function tieneValor(v) {
  return String(v == null ? "" : v).trim() !== "";
}

// Solo enteros ≥ 0: quita todo lo que no sea dígito (se descarta el signo y el resto).
export function soloEnteroNoNeg(v) {
  return String(v == null ? "" : v).replace(/[^\d]/g, "");
}

// Estado de un inventario (fecha+grupo) a partir de sus líneas guardadas y de la
// lista de medicamentos de ese grupo. "Todos los medicamentos" = todo el grupo.
//   Completo                 → todos tienen REAL, D07 y MAESTRO
//   Incompleto · falta MAESTRO → todos tienen REAL y D07, falta algún MAESTRO
//   Incompleto               → falta algún REAL o D07
export function estadoInventario(filasGuardadas, medsGrupo) {
  const meds = medsGrupo || [];
  if (!meds.length) return "Incompleto";
  const byV = {};
  (filasGuardadas || []).forEach((r) => { byV[r.codigoV] = r; });
  let faltaRD = false, faltaM = false;
  meds.forEach((m) => {
    const r = byV[m.codigoV] || {};
    if (!tieneValor(r.real) || !tieneValor(r.d07)) faltaRD = true;
    if (!tieneValor(r.maestro)) faltaM = true;
  });
  if (faltaRD) return "Incompleto";
  return faltaM ? "Incompleto · falta MAESTRO" : "Completo";
}

export const esInventarioCompleto = (estado) => estado === "Completo";

// Nivel de badge para mostrar el estado en la interfaz.
export function nivelEstado(estado) {
  if (estado === "Completo") return "ok";
  return "warn";
}

// Clave del borrador local por inventario (device). No contiene datos de paciente.
export function borradorKey(fecha, grupo) {
  return `estupefarma:inv-borrador:${String(fecha)}:${String(grupo)}`;
}
