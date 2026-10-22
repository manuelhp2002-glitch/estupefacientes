import { describe, it, expect } from "vitest";
import { pedidosPendientes, nombreSinCodigoV, numeroAlbaran } from "./albaran.js";

// Zona horaria de Canarias, como el navegador del servicio
process.env.TZ = "Atlantic/Canary";

// estadoPedido real (resumen del monolito) para no acoplar la prueba a mocks frágiles
const estadoPedido = (p) => {
  if (p.noServido) return "No servido";
  if (p.fechaEntrada) {
    if ((Number(p.udsRecibidas) < Number(p.udsPedidas)) || (p.incidencias && String(p.incidencias).trim())) return "Incidencia";
    return "Recibido";
  }
  return "Pendiente";
};

describe("pedidosPendientes", () => {
  const pedidos = [
    { id: "a", vale: "016", noServido: false, fechaEntrada: "2026-10-10", udsRecibidas: 5, udsPedidas: 5 }, // Recibido
    { id: "b", vale: "020" },                                                                                // Pendiente
    { id: "c", vale: "028", avisoLlegada: true },                                                            // Pendiente con aviso
    { id: "d", vale: "x", noServido: true },                                                                 // No servido
    { id: "e", vale: "y", fechaEntrada: "2026-10-10", udsRecibidas: 2, udsPedidas: 5 },                      // Incidencia
  ];
  it("deja solo los Pendientes (el aviso de llegada sigue siendo Pendiente)", () => {
    const res = pedidosPendientes(pedidos, estadoPedido);
    expect(res.map((p) => p.vale)).toEqual(["020", "028"]);
  });
  it("tolera lista vacía o nula", () => {
    expect(pedidosPendientes([], estadoPedido)).toEqual([]);
    expect(pedidosPendientes(null, estadoPedido)).toEqual([]);
  });
});

describe("nombreSinCodigoV", () => {
  it("quita el prefijo Código V", () => {
    expect(nombreSinCodigoV("V00655 · MORFINA MST LIB PROLONG 10 mg comp")).toBe("MORFINA MST LIB PROLONG 10 mg comp");
    expect(nombreSinCodigoV("T93631 · P METADONA CLORHIDRATO 100 g")).toBe("P METADONA CLORHIDRATO 100 g");
  });
  it("si no tiene ese formato, devuelve el texto tal cual", () => {
    expect(nombreSinCodigoV("MORFINA sin código")).toBe("MORFINA sin código");
    expect(nombreSinCodigoV("")).toBe("");
    expect(nombreSinCodigoV(null)).toBe("");
  });
});

describe("numeroAlbaran", () => {
  it("formatea ALB-AAAAMMDD-NN con la fecha local", () => {
    expect(numeroAlbaran(new Date(2026, 9, 21), 1)).toBe("ALB-20261021-01");
    expect(numeroAlbaran(new Date(2026, 9, 21), 12)).toBe("ALB-20261021-12");
  });
  it("un contador inválido cae a 01", () => {
    expect(numeroAlbaran(new Date(2026, 0, 5), 0)).toBe("ALB-20260105-01");
    expect(numeroAlbaran(new Date(2026, 0, 5), undefined)).toBe("ALB-20260105-01");
  });
});
