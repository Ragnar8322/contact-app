import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import CasesFilterBar from "@/components/cases/CasesFilterBar";

// Reproduce el bug: new Date("2026-03-15") es medianoche UTC, que en Bogotá
// (UTC-5) cae el 14. El botón mostraba un día menos que el filtro aplicado.
const originalTZ = process.env.TZ;
beforeAll(() => { process.env.TZ = "America/Bogota"; });
afterAll(() => { process.env.TZ = originalTZ; });

describe("CasesFilterBar — fechas", () => {
  it("muestra la fecha elegida sin correrla un día", () => {
    render(
      <CasesFilterBar
        filters={{ fechaDesde: "2026-03-15", fechaHasta: "2026-03-31" }}
        searchText=""
        onSearchTextChange={() => {}}
        onFiltersChange={() => {}}
        estados={[]}
        tiposServicio={[]}
        agentes={[]}
        showAgenteFilter={false}
      />
    );
    expect(screen.getByRole("button", { name: /15\/03\/2026/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /31\/03\/2026/ })).toBeInTheDocument();
  });
});
