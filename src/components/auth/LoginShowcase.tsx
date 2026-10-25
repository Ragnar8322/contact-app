import type { CSSProperties, ReactNode } from "react";
import { ArrowRightLeft, CalendarDays, ShieldCheck } from "lucide-react";
import { EstadoBadge } from "@/components/cases/EstadoBadge";
import { APP_MONOGRAM, APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de muestra inclinada `giro` grados. Entra escalonada y flota suavemente con un ciclo
 * propio (ver .tarjeta-flotante en index.css); con «reducir movimiento» queda quieta.
 */
function Tarjeta({ children, retraso, giro, ciclo, className }: {
  children: ReactNode; retraso: number; giro: number; ciclo: number; className?: string;
}) {
  const vars = { "--retraso": `${retraso}ms`, "--giro": `${giro}deg`, "--ciclo": `${ciclo}s` } as CSSProperties;
  return (
    <div
      className={cn("tarjeta-flotante rounded-2xl bg-card p-4 text-card-foreground shadow-xl shadow-black/25 dark:ring-1 dark:ring-white/10", className)}
      style={vars}
    >
      {children}
    </div>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

// Barras de la mini gráfica (decorativas)
const BARRAS = [30, 52, 41, 64, 88];

/**
 * Panel de marca del inicio de sesión: muestra lo que hace la plataforma con datos de ejemplo.
 * Es decorativo (aria-hidden) y solo aparece en pantallas grandes.
 */
export function LoginShowcase() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-panel p-12 text-brand-panel-foreground lg:flex lg:w-1/2 xl:p-14">
      {/* Resplandor de fondo */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-panel-foreground font-bold text-brand-panel" aria-hidden="true">
          {APP_MONOGRAM}
        </div>
        <div>
          <p className="text-lg font-semibold leading-tight">{APP_NAME}</p>
          <p className="text-xs opacity-80">Cámara de Comercio de Barranquilla</p>
        </div>
      </div>

      <div aria-hidden="true" className="relative mx-auto my-8 grid w-full max-w-[480px] grid-cols-2 gap-4">
        <Tarjeta retraso={100} giro={-2} ciclo={6.5}>
          <Rotulo>Caso #1042</Rotulo>
          <p className="text-sm font-semibold leading-tight">Comercializadora Ejemplo S.A.S.</p>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">Renovación de matrícula</p>
          <EstadoBadge nombre="Renovado" />
        </Tarjeta>

        <Tarjeta retraso={200} giro={2} ciclo={7.5} className="self-end">
          <Rotulo>Renovaciones del mes</Rotulo>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold">1.284</span>
            <span className="text-xs font-semibold text-success">Meta 1.500</span>
          </div>
          <div className="mt-3 flex h-10 items-end gap-1.5">
            {BARRAS.map((alto, i) => (
              <div key={i} className={cn("flex-1 rounded-t-sm", i === BARRAS.length - 1 ? "bg-primary" : "bg-secondary")} style={{ height: `${alto}%` }} />
            ))}
          </div>
        </Tarjeta>

        <Tarjeta retraso={300} giro={-1.5} ciclo={7}>
          <Rotulo>Transferencia</Rotulo>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            Asesoría Especializada
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Asignado al supervisor de la campaña</p>
        </Tarjeta>

        <Tarjeta retraso={400} giro={1.5} ciclo={8}>
          <Rotulo>SLA de la campaña</Rotulo>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-success" />
            0 casos vencidos
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-[86%] rounded-full bg-primary" />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">86% atendidos a tiempo</p>
        </Tarjeta>

        <Tarjeta retraso={500} giro={-1} ciclo={6.8} className="col-span-2 mx-auto w-4/5">
          <Rotulo>Horario publicado</Rotulo>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            Lunes a viernes · 7:30 – 16:30
          </p>
        </Tarjeta>
      </div>

      <div className="relative mx-auto max-w-md text-center">
        <p className="font-display text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
          La renovación mercantil, gestionada en un solo lugar.
        </p>
        <p className="mt-3 text-sm opacity-80">Casos, clientes, campañas y horarios del equipo de renovación.</p>
      </div>
    </div>
  );
}
