// Grilla semanal completa: filas = agentes, columnas = días Lun–Dom
import { useMemo, useState } from "react";
import { ScheduleShift } from "@/types/schedules";
import TurnoCell from "./TurnoCell";
import TurnoEditModal from "./TurnoEditModal";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function getDoW(fecha: string): number {
  // 0=Dom,1=Lun…6=Sab  →  queremos 0=Lun…6=Dom
  const d = new Date(fecha + "T12:00:00").getDay();
  return d === 0 ? 6 : d - 1;
}

interface Props {
  shifts: ScheduleShift[];
  semanaInicio: string;   // "YYYY-MM-DD" lunes
  scheduleId: string;
  editable?: boolean;
  onShiftSaved?: () => void;
}

export default function SemanaGrid({ shifts, semanaInicio, scheduleId, editable = false, onShiftSaved }: Props) {
  const [editTarget, setEditTarget] = useState<{ agente_id: string; nombre: string; fecha: string; shift?: ScheduleShift } | null>(null);

  // Construir mapa agente → nombre
  const agentes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shifts) {
      if (!map.has(s.agente_id)) {
        map.set(s.agente_id, (s.agente as any)?.nombre ?? s.agente_id);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [shifts]);

  // Construir mapa agente+dow → shift
  // [B8] Detectar colisiones de clave (dos shifts del mismo agente en el mismo día)
  const shiftMap = useMemo(() => {
    const m: Record<string, ScheduleShift> = {};
    for (const s of shifts) {
      const key = `${s.agente_id}-${getDoW(s.fecha)}`;
      if (import.meta.env.DEV && m[key]) {
        console.warn(
          `[SemanaGrid] Colisión en shiftMap: agente ${s.agente_id} tiene más de un turno en fecha ${s.fecha}. ` +
          `El constraint UNIQUE (schedule_id, agente_id, fecha) debería prevenir esto. ` +
          `Verificar integridad de datos.`
        );
      }
      m[key] = s;
    }
    return m;
  }, [shifts]);

  // Fechas exactas de la semana (lun=0 … dom=6)
  const fechas = useMemo(() => {
    return DIAS.map((_, i) => {
      const d = new Date(semanaInicio + "T12:00:00");
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [semanaInicio]);

  if (agentes.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No hay turnos asignados para esta semana.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-semibold w-36">Asesor</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground w-14">Total</th>
              {DIAS.map((d, i) => (
                <th key={d} className="px-2 py-2 text-center font-semibold min-w-[90px]">
                  <div>{d}</div>
                  <div className="font-normal text-muted-foreground">
                    {new Date(fechas[i] + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agentes.map(([agenteId, nombre]) => {
              const totalHoras = DIAS.reduce((acc, _, i) => {
                const s = shiftMap[`${agenteId}-${i}`];
                return acc + (s?.horas_dia ?? 0);
              }, 0);

              return (
                <tr key={agenteId} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium truncate max-w-[144px]">
                    {nombre}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-muted-foreground">
                    {totalHoras > 0 ? `${totalHoras.toFixed(2)}h` : "—"}
                  </td>
                  {DIAS.map((_, i) => {
                    const shift = shiftMap[`${agenteId}-${i}`];
                    return (
                      <td key={i} className="px-1.5 py-1.5">
                        <TurnoCell
                          shift={shift}
                          editable={editable}
                          onClick={(s) => editable && setEditTarget({
                            agente_id: agenteId,
                            nombre,
                            fecha: fechas[i],
                            shift: s,
                          })}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <TurnoEditModal
          scheduleId={scheduleId}
          agente_id={editTarget.agente_id}
          agente_nombre={editTarget.nombre}
          fecha={editTarget.fecha}
          shift={editTarget.shift}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); onShiftSaved?.(); }}
        />
      )}
    </>
  );
}
