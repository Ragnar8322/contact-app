import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CaseIdButton } from "@/components/cases/CaseIdButton";
import TurnoCell from "@/components/schedules/TurnoCell";
import type { ScheduleShift } from "@/types/schedules";

vi.mock("@/contexts/CampanaContext", () => ({ useCampana: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signOut: vi.fn(), profile: { nombre: "Ana" } }) }));
import { useCampana } from "@/contexts/CampanaContext";
import SelectCampaign from "@/pages/SelectCampaign";

describe("acciones principales con teclado", () => {
  it("abre un caso con Tab + Enter", async () => {
    const onOpen = vi.fn();
    render(<CaseIdButton id={42} onOpen={onOpen} />);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Abrir caso #42" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("elige campaña con Tab + Enter", async () => {
    const setCampanaActiva = vi.fn();
    const campanas = [
      { id: "c1", nombre: "Renovación Web", descripcion: null },
      { id: "c2", nombre: "Asesoría Especializada", descripcion: "Atención VIP" },
    ];
    (useCampana as ReturnType<typeof vi.fn>).mockReturnValue({ campanas, setCampanaActiva, noCampaigns: false });
    render(<SelectCampaign />);

    await userEvent.tab(); // "Cerrar sesión"
    await userEvent.tab(); // primera campaña
    await userEvent.tab(); // segunda campaña
    expect(screen.getByRole("button", { name: /Asesoría Especializada/ })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(setCampanaActiva).toHaveBeenCalledWith(campanas[1]);
  });

  describe("celda de la grilla de horarios", () => {
    const shift = {
      id: "s1", schedule_id: "w1", agente_id: "a1", fecha: "2026-03-16",
      tipo_actividad: "No_aplica", hora_inicio: null, hora_fin: null, hora_almuerzo: null,
      duracion_almuerzo: 0, horas_dia: 0, observacion: null, shift_type_id: null,
      created_at: "", updated_at: "",
    } as ScheduleShift;

    it("editable: es un botón con nombre descriptivo y responde a Espacio", async () => {
      const onClick = vi.fn();
      render(<TurnoCell shift={shift} editable onClick={onClick} label="Ana Pérez, lunes 16 mar" />);
      const btn = screen.getByRole("button", { name: "Editar turno: Ana Pérez, lunes 16 mar, No aplica" });
      await userEvent.tab();
      expect(btn).toHaveFocus();
      await userEvent.keyboard(" ");
      expect(onClick).toHaveBeenCalledWith(shift);
    });

    it("vacía y editable: botón para asignar", () => {
      render(<TurnoCell editable onClick={vi.fn()} label="Ana Pérez, martes 17 mar" />);
      expect(screen.getByRole("button", { name: "Asignar turno: Ana Pérez, martes 17 mar" })).toBeInTheDocument();
    });

    it("solo lectura: no es enfocable y muestra el texto legible", () => {
      render(<TurnoCell shift={shift} label="Ana Pérez, lunes 16 mar" />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByText("No aplica")).toBeInTheDocument();
    });
  });
});
