import { describe, it, expect } from "vitest";
import { pedidosPendientes, nombreSinCodigoV, numeroAlbaran, esPedidoReal, toLocalYMD, filtrarParaAlbaran } from "./albaran.js";

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

describe("esPedidoReal", () => {
  it("rechaza filas de plantilla sin medicamento", () => {
    expect(esPedidoReal({ estupefaciente: "" })).toBe(false);
    expect(esPedidoReal({ estupefaciente: null })).toBe(false);
    expect(esPedidoReal({})).toBe(false);
    expect(esPedidoReal({ estupefaciente: "-" })).toBe(false);
    expect(esPedidoReal({ estupefaciente: "—" })).toBe(false);
    expect(esPedidoReal({ estupefaciente: "V00655 · " })).toBe(false);
  });
  it("acepta pedidos con medicamento", () => {
    expect(esPedidoReal({ estupefaciente: "V00655 · MORFINA MST 10 mg" })).toBe(true);
    expect(esPedidoReal({ estupefaciente: "MORFINA sin codigo" })).toBe(true);
  });
});

describe("toLocalYMD (fecha local de Canarias)", () => {
  it("'aaaa-mm-dd' se devuelve igual", () => {
    expect(toLocalYMD("2026-10-01")).toBe("2026-10-01");
  });
  it("ISO de medianoche de Canarias NO se desplaza de día", () => {
    // medianoche del 01/10/2026 en Canarias (verano, UTC+1) = 2026-09-30T23:00Z
    expect(toLocalYMD("2026-09-30T23:00:00.000Z")).toBe("2026-10-01");
  });
  it("vacío/nulo/ilegible → null", () => {
    expect(toLocalYMD("")).toBe(null);
    expect(toLocalYMD(null)).toBe(null);
    expect(toLocalYMD("fecha mala")).toBe(null);
  });
});

describe("filtrarParaAlbaran", () => {
  const pedidos = [
    { id: "010", vale: "010", estupefaciente: "V19176 · MORFINA 10 mg/1mL amp 1%", proveedor: "BRAUN", fechaPedido: "2026-09-15" },
    { id: "020", vale: "020", estupefaciente: "V02208 · OXICODONA LIB PROLONGADA 20 mg comp", proveedor: "FERRER FARMA", fechaPedido: "2026-10-13" },
    { id: "023", vale: "023", estupefaciente: "V02175 · OXICODONA LIB PROLONGADA 10 mg comp", proveedor: "MUNDIPHARMA", fechaPedido: "2026-10-15" },
    { id: "030", vale: "030", estupefaciente: "", proveedor: "MUNDIPHARMA", fechaPedido: "" },                                      // no real
    { id: "031", vale: "031", estupefaciente: "V00655 · ", proveedor: "KERN PHARMA", fechaPedido: "2026-10-20" },                   // no real
    { id: "016", vale: "016", estupefaciente: "V00655 · MORFINA MST 10 mg comp", proveedor: "KERN PHARMA", fechaPedido: "2026-10-05", fechaEntrada: "2026-10-06", udsRecibidas: 5, udsPedidas: 5 }, // Recibido
  ];
  const deps = { estadoPedido };
  it("corte 01/10/2026: salen 020 y 023; 010 oculto; 030/031 ni salen ni cuentan", () => {
    const r = filtrarParaAlbaran(pedidos, { fechaCorte: "2026-10-01", proveedor: "TODOS" }, deps);
    expect(r.visibles.map((p) => p.vale)).toEqual(["020", "023"]);
    expect(r.ocultosPorCorte.map((p) => p.vale)).toEqual(["010"]);
    expect(r.proveedores).toEqual(["FERRER FARMA", "MUNDIPHARMA"]);
  });
  it("corte 01/09/2026: salen 010, 020 y 023; sin ocultos", () => {
    const r = filtrarParaAlbaran(pedidos, { fechaCorte: "2026-09-01", proveedor: "TODOS" }, deps);
    expect(r.visibles.map((p) => p.vale)).toEqual(["010", "020", "023"]);
    expect(r.ocultosPorCorte).toEqual([]);
  });
  it("sin corte: salen 010, 020 y 023", () => {
    const r = filtrarParaAlbaran(pedidos, { fechaCorte: "", proveedor: "TODOS" }, deps);
    expect(r.visibles.map((p) => p.vale)).toEqual(["010", "020", "023"]);
  });
  it("el proveedor se aplica tras el corte; enVentana no depende del proveedor", () => {
    const r = filtrarParaAlbaran(pedidos, { fechaCorte: "2026-09-01", proveedor: "FERRER FARMA" }, deps);
    expect(r.visibles.map((p) => p.vale)).toEqual(["020"]);
    expect(r.enVentana.map((p) => p.vale)).toEqual(["010", "020", "023"]);
  });
});
