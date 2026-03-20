// Grilla semanal completa: filas = agentes, columnas = días Lun–Dom
// v2: pasa novedades parciales a TurnoCell y horas acumuladas al modal de edición.
import { useMemo, useState } from "react";
import { ScheduleShift, ScheduleNovedad } from "@/types/schedules";
import type { AgenteBasico } from "@/hooks/useSchedules";
import { useScheduleNovedades } from "@/hooks/useSchedules";
import TurnoCell from "./TurnoCell";
import TurnoEditModal from "./TurnoEditModal";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function getDoW(fecha: string): number {
  const d = new Date(fecha + "T12:00:00").getDay();
  return d === 0 ? 6 : d - 1;
}

interface Props {
  agentes: AgenteBasico[];
  shifts: ScheduleShift[];
  semanaInicio: string;
  scheduleId: string;
  editable?: boolean;
  onShiftSaved?: () => void;
}

export default function SemanaGrid({ agentes, shifts, semanaInicio, scheduleId, editable = false, onShiftSaved }: Props) {
  const [editTarget, setEditTarget] = useState<{
    agente_id: string;
    nombre: string;
    fecha: string;
    shift?: ScheduleShift;
  } | null>(null);

  // Cargar novedades aprobadas de la semana para mostrar bloques en grilla
  const { data: novedades } = useScheduleNovedades(scheduleId);
  const novedadesAprobadas = useMemo(() =>
    (novedades ?? []).filter((n) => n.estado === "aprobado"),
    [novedades]
  );

  // Mapa agente+fecha → novedad parcial aprobada
  const novedadMap = useMemo(() => {
    const m: Record<string, ScheduleNovedad> = {};
    for (const n of novedadesAprobadas) {
      if (!n.es_dia_completo) {
        m[`${n.agente_id}-${n.fecha}`] = n;
      }
    }
    return m;
  }, [novedadesAprobadas]);

  // Mapa agente+dow → shift
  const shiftMap = useMemo(() => {
    const m: Record<string, ScheduleShift> = {};
    for (const s of shifts) {
      const key = `${s.agente_id}-${getDoW(s.fecha)}`;
      if (import.meta.env.DEV && m[key]) {
        console.warn(`[SemanaGrid] Colisión en shiftMap: agente ${s.agente_id} fecha ${s.fecha}`);
      }
      m[key] = s;
    }
    return m;
  }, [shifts]);

  // Merge agentes activos + agentes con shifts
  const agentesMerged = useMemo(() => {
    const base = new Map<string, string>(agentes.map((a) => [a.user_id, a.nombre]));
    for (const s of shifts) {
      if (!base.has(s.agente_id)) {
        base.set(s.agente_id, (s.agente as { nombre: string } | undefined)?.nombre ?? s.agente_id);
      }
    }
    return Array.from(base.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [agentes, shifts]);

  // Fechas exactas de la semana
  const fechas = useMemo(() => {
    return DIAS.map((_, i) => {
      const d = new Date(semanaInicio + "T12:00:00");
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [semanaInicio]);

  if (agentesMerged.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No hay agentes activos en esta campaña.
      </div>
    );
  }

  // Horas acumuladas por agente en la semana (para validación en TurnoEditModal)
  function getHorasAcumuladas(agenteId: string, excludeFecha?: string): number {
    return DIAS.reduce((acc, _, i) => {
      const s = shiftMap[`${agenteId}-${i}`];
      if (!s) return acc;
      if (excludeFecha && s.fecha === excludeFecha) return acc;
      return acc + (s.horas_dia ?? 0);
    }, 0);
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
                <th key={d} className="px-2 py-2 text-center font-semibold min-w-[100px]">
                  <div>{d}</div>
                  <div className="font-normal text-muted-foreground">
                    {new Date(fechas[i] + "T12:00:00").toLocaleDateString("es-CO", {
                      day: "2-digit", month: "short",
                    })}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agentesMerged.map(([agenteId, nombre]) => {
              const totalHoras = DIAS.reduce((acc, _, i) => {
                const s = shiftMap[`${agenteId}-${i}`];
                return acc + (s?.horas_dia ?? 0);
              }, 0);

              // Solo alerta si supera 42h con margen (para tolerar rounding de decimales)
              const superaTope = totalHoras > 42.1;
              const totalLabel = totalHoras > 0
                ? `${totalHoras % 1 === 0 ? totalHoras.toFixed(0) : totalHoras.toFixed(2)}h`
                : "—";

              return (
                <tr key={agenteId} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium truncate max-w-[144px]">
                    {nombre}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${superaTope ? "text-destructive" : "text-muted-foreground"}`}>
                    {totalLabel}
                    {superaTope && <span className="block text-[10px] font-normal">+42h</span>}
                  </td>
                  {DIAS.map((_, i) => {
                    const shift = shiftMap[`${agenteId}-${i}`];
                    const novedadParcial = shift
                      ? novedadMap[`${agenteId}-${shift.fecha}`]
                      : undefined;

                    return (
                      <td key={i} className="px-1.5 py-1.5">
                        <TurnoCell
                          shift={shift}
                          editable={editable}
                          novedadHoras={
                            novedadParcial?.hora_inicio_novedad
                              ? {
                                  hora_inicio: novedadParcial.hora_inicio_novedad,
                                  hora_fin: novedadParcial.hora_fin_novedad ?? "",
                                  tipo: novedadParcial.tipo_novedad,
                                }
                              : null
                          }
                          onClick={(s) =>
                            editable &&
                            setEditTarget({
                              agente_id: agenteId,
                              nombre,
                              fecha: fechas[i],
                              shift: s,
                            })
                          }
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
          horasAcumuladasSemana={getHorasAcumuladas(
            editTarget.agente_id,
            editTarget.fecha
          )}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            onShiftSaved?.();
          }}
        />
      )}
    </>
  );
}
