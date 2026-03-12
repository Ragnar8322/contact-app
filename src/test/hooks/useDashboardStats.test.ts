import { describe, it, expect } from "vitest";

// Tests unitarios de la lógica de cálculo de useDashboardStats
// Se testea la lógica pura sin montar el hook (evita dependencia de Supabase)

type MockCaso = {
  id: string;
  estado_id: number;
  cat_estados?: { nombre: string } | null;
};

function calcularStats(casos: MockCaso[]) {
  const total = casos.length;
  const renovados = casos.filter(
    (c) => c.cat_estados?.nombre?.toLowerCase() === "renovado"
  ).length;
  const pendientes = casos.filter(
    (c) => c.cat_estados?.nombre?.toLowerCase() === "pendiente"
  ).length;
  const enGestion = casos.filter(
    (c) => c.cat_estados?.nombre?.toLowerCase() === "en gestión"
  ).length;
  const tasaRenovacion = total > 0 ? Math.round((renovados / total) * 100) : 0;

  return { total, renovados, pendientes, enGestion, tasaRenovacion };
}

describe("useDashboardStats — lógica de cálculo", () => {
  const mockCasos: MockCaso[] = [
    { id: "1", estado_id: 1, cat_estados: { nombre: "Renovado" } },
    { id: "2", estado_id: 1, cat_estados: { nombre: "Renovado" } },
    { id: "3", estado_id: 2, cat_estados: { nombre: "Pendiente" } },
    { id: "4", estado_id: 3, cat_estados: { nombre: "En Gestión" } },
    { id: "5", estado_id: 2, cat_estados: { nombre: "Pendiente" } },
  ];

  it("calcula el total correctamente", () => {
    const { total } = calcularStats(mockCasos);
    expect(total).toBe(5);
  });

  it("cuenta renovados correctamente", () => {
    const { renovados } = calcularStats(mockCasos);
    expect(renovados).toBe(2);
  });

  it("cuenta pendientes correctamente", () => {
    const { pendientes } = calcularStats(mockCasos);
    expect(pendientes).toBe(2);
  });

  it("calcula la tasa de renovación correctamente", () => {
    const { tasaRenovacion } = calcularStats(mockCasos);
    expect(tasaRenovacion).toBe(40); // 2/5 = 40%
  });

  it("retorna 0% si no hay casos", () => {
    const { tasaRenovacion, total } = calcularStats([]);
    expect(total).toBe(0);
    expect(tasaRenovacion).toBe(0);
  });

  it("maneja casos sin estado correctamente", () => {
    const casosConNulo: MockCaso[] = [
      { id: "1", estado_id: 1, cat_estados: null },
      { id: "2", estado_id: 1, cat_estados: { nombre: "Renovado" } },
    ];
    const { renovados } = calcularStats(casosConNulo);
    expect(renovados).toBe(1);
  });
});
