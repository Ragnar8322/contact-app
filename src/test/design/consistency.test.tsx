import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { roleLabel } from "@/lib/roleUtils";
import { actividadLabel } from "@/types/schedules";
import { EstadoBadge } from "@/components/cases/EstadoBadge";

const sources = import.meta.glob(
  ["/src/pages/**/*.tsx", "/src/components/**/*.tsx", "!/src/components/ui/**"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("consistencia visual", () => {
  it("no se usan emojis como íconos (se usan los íconos de lucide)", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(30);
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2705}\u{23F3}]/u;
    const offenders = Object.entries(sources).flatMap(([path, code]) =>
      code.split("\n").flatMap((line, i) => (emoji.test(line) ? [`${path}:${i + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  it("no hay botones con colores fijos fuera del tema (índigo, violeta, ámbar)", () => {
    const offenders = Object.entries(sources).flatMap(([path, code]) =>
      [...code.matchAll(/<Button[^>]*className="[^"]*\b(?:bg|text|border)-(?:indigo|violet|amber)-\d+/g)].map(() => path),
    );
    expect(offenders).toEqual([]);
  });

  it("los roles se muestran en español", () => {
    expect(roleLabel("agent")).toBe("Agente");
    expect(roleLabel("admin")).toBe("Administrador");
    expect(roleLabel("Supervisor")).toBe("Supervisor");
    expect(roleLabel("otro")).toBe("otro");
  });

  it("las actividades no muestran el valor interno con guion bajo", () => {
    expect(actividadLabel("No_aplica")).toBe("No aplica");
    expect(actividadLabel("GAP")).toBe("GAP");
  });

  it("EstadoBadge muestra el estado y un ícono para Transferido", () => {
    const { container } = render(<EstadoBadge nombre="Transferido" />);
    expect(screen.getByText("Transferido")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    render(<EstadoBadge nombre={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
