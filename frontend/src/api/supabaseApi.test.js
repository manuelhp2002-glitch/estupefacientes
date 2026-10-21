import { describe, it, expect } from "vitest";
import { SCHEMA, aFila, aObjeto, parseFecha } from "./supabaseApi.js";

// Las pruebas asumen la zona horaria de Canarias, como el navegador del servicio
process.env.TZ = "Atlantic/Canary";

describe("parseFecha (misma lectura que hacía Google Sheets)", () => {
  it("fecha simple = medianoche de Canarias", () => {
    expect(parseFecha("2026-10-02")).toBe("2026-10-01T23:00:00.000Z"); // horario de verano
    expect(parseFecha("2026-12-02")).toBe("2026-12-02T00:00:00.000Z"); // invierno
  });
  it("dd/mm/aaaa hh:mm del Detector", () => {
    expect(parseFecha("29/06/2026 06:00")).toBe("2026-06-29T05:00:00.000Z");
  });
  it("datetime-local de Incidencias", () => {
    expect(parseFecha("2026-07-10T13:20")).toBe("2026-07-10T12:20:00.000Z");
  });
  it("ISO con Z se respeta", () => {
    expect(parseFecha("2026-07-09T15:51:00.827Z")).toBe("2026-07-09T15:51:00.827Z");
  });
  it("fechas imposibles o texto → no se inventa nada", () => {
    expect(parseFecha("31/02/2026")).toBeUndefined();
    expect(parseFecha("13/10/0206x")).toBeUndefined();
  });
});

describe("ida y vuelta app ⇄ BD", () => {
  it("un pedido vuelve igual que lo devolvía Sheets", () => {
    const pedido = {
      id: "abc", vale: "HA1", cn: "700636", estupefaciente: "V00639 · METADONA 5 mg comp or/sonda",
      fechaPedido: "2026-10-02", udsPedidas: "160", uds: "160", udsRecibidas: "", fechaEntrada: "",
      farmaceutico: "", noServido: false, incidencias: "", avisoLlegada: false, horaAviso: "", estado: "Pendiente",
    };
    const { fila, extra } = aFila(SCHEMA.Pedidos, pedido);
    expect(extra).toEqual({});
    expect(fila).toMatchObject({ uds_pedidas: 160, uds_recibidas: null, fecha_pedido: "2026-10-01T23:00:00.000Z", no_servido: false });
    const vuelta = aObjeto(SCHEMA.Pedidos, { ...fila, extra, created_at: "x", updated_at: "x" });
    expect(vuelta).toMatchObject({ udsPedidas: 160, udsRecibidas: "", fechaEntrada: "", fechaPedido: "2026-10-01T23:00:00.000Z", noServido: false, estado: "Pendiente" });
    expect(vuelta).not.toHaveProperty("createdAt");
  });
  it("valores que no encajan no se pierden (extra.__raw)", () => {
    const { fila, extra } = aFila(SCHEMA.Pedidos, { id: "x", udsPedidas: "240??" });
    expect(fila.uds_pedidas).toBeNull();
    expect(extra).toEqual({ udsPedidas__raw: "240??" });
    expect(aObjeto(SCHEMA.Pedidos, { ...fila, extra }).udsPedidas).toBe("240??");
  });
  it("claves nuevas de la app viajan en extra", () => {
    const { fila, extra } = aFila(SCHEMA.Incidencias, { id: "i", tipo: "Otro", campoNuevo: 7 });
    expect(extra).toEqual({ campoNuevo: 7 });
    expect(aObjeto(SCHEMA.Incidencias, { ...fila, extra }).campoNuevo).toBe(7);
  });
  it("nombres de columna especiales del inventario", () => {
    const { fila } = aFila(SCHEMA.Inventarios, { id: "n", codigoV: "V04751", d07: 3, descRealD07: -1, descD07Maestro: 0 });
    expect(fila).toMatchObject({ codigo_v: "V04751", d07: 3, desc_real_d07: -1, desc_d07_maestro: 0 });
    const o = aObjeto(SCHEMA.Inventarios, { ...fila, extra: {} });
    expect(o).toMatchObject({ codigoV: "V04751", d07: 3, descRealD07: -1, descD07Maestro: 0 });
  });
  it("numeric de Postgres (texto) vuelve como número", () => {
    expect(aObjeto(SCHEMA.Consumos, { id: "c", media: "2.3", extra: {} }).media).toBe(2.3);
  });
});
