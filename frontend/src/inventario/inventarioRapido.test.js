import { describe, it, expect } from "vitest";
import { invRowId, tieneValor, soloEnteroNoNeg, estadoInventario } from "./inventarioRapido.js";

describe("invRowId (upsert por fecha+grupo+codigoV)", () => {
  it("es determinista", () => {
    expect(invRowId("2026-10-19", "ORAL", "V00655")).toBe("inv-2026-10-19-ORAL-V00655");
    expect(invRowId("2026-10-19", "ORAL", "V00655")).toBe(invRowId("2026-10-19", "ORAL", "V00655"));
  });
  it("distingue grupo y fecha", () => {
    expect(invRowId("2026-10-19", "IV", "V00655")).not.toBe(invRowId("2026-10-19", "ORAL", "V00655"));
  });
});

describe("tieneValor (vacío ≠ 0)", () => {
  it("0 cuenta como relleno", () => { expect(tieneValor(0)).toBe(true); expect(tieneValor("0")).toBe(true); });
  it("vacío/espacios/null no cuentan", () => {
    expect(tieneValor("")).toBe(false);
    expect(tieneValor("   ")).toBe(false);
    expect(tieneValor(null)).toBe(false);
    expect(tieneValor(undefined)).toBe(false);
  });
});

describe("soloEnteroNoNeg", () => {
  it("quita todo lo no numérico (incl. el signo)", () => {
    expect(soloEnteroNoNeg("12")).toBe("12");
    expect(soloEnteroNoNeg("-5")).toBe("5");
    expect(soloEnteroNoNeg("1a2b")).toBe("12");
    expect(soloEnteroNoNeg("")).toBe("");
  });
});

describe("estadoInventario", () => {
  const meds = [{ codigoV: "A" }, { codigoV: "B" }];
  it("Completo cuando todos tienen los tres valores", () => {
    const filas = [{ codigoV: "A", real: 5, d07: 5, maestro: 5 }, { codigoV: "B", real: 0, d07: 0, maestro: 0 }];
    expect(estadoInventario(filas, meds)).toBe("Completo");
  });
  it("Incompleto · falta MAESTRO cuando todos tienen REAL y D07 pero falta un MAESTRO", () => {
    const filas = [{ codigoV: "A", real: 5, d07: 5, maestro: 5 }, { codigoV: "B", real: 2, d07: 2, maestro: "" }];
    expect(estadoInventario(filas, meds)).toBe("Incompleto · falta MAESTRO");
  });
  it("Incompleto cuando falta algún REAL o D07", () => {
    const filas = [{ codigoV: "A", real: 5, d07: "", maestro: "" }];
    expect(estadoInventario(filas, meds)).toBe("Incompleto");
  });
  it("un medicamento sin fila guardada cuenta como vacío (Incompleto)", () => {
    const filas = [{ codigoV: "A", real: 5, d07: 5, maestro: 5 }]; // falta B entero
    expect(estadoInventario(filas, meds)).toBe("Incompleto");
  });
});
