import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logActivity } from "@/hooks/useActivityLog";
import { errorMessage } from "@/lib/errors";
import { EXPORT_MAX_ROWS } from "@/lib/fetchForExport";
import type { ColumnaOpcion } from "@/lib/reports/tablesExcel";

interface Props {
  /** Qué se exporta, para la auditoría y para recordar las columnas elegidas ("casos", "clientes") */
  entity: string;
  /** Etiqueta en plural para los textos ("casos", "clientes") */
  label: string;
  columns: ColumnaOpcion[];
  /** Registros que cumplen los filtros actuales */
  totalCount: number;
  /** Genera y descarga el archivo con las columnas elegidas; devuelve cuántos registros incluyó */
  onExport: (columnKeys: string[]) => Promise<number>;
  disabled?: boolean;
  /** Filtros aplicados, para dejarlos en el registro de auditoría */
  details?: Record<string, unknown>;
}

const storageKey = (entity: string) => `export-columnas:${entity}`;

/** Columnas elegidas la última vez (solo las que siguen existiendo); todas si no hay preferencia. */
function loadSelection(entity: string, columns: ColumnaOpcion[]): string[] {
  const all = columns.map((c) => c.key);
  try {
    const raw = localStorage.getItem(storageKey(entity));
    if (!raw) return all;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return all;
    const valid = all.filter((k) => saved.includes(k));
    return valid.length > 0 ? valid : all;
  } catch {
    return all;
  }
}

function saveSelection(entity: string, keys: string[]) {
  try { localStorage.setItem(storageKey(entity), JSON.stringify(keys)); } catch { /* sin almacenamiento: no pasa nada */ }
}

/** Botón "Exportar Excel": abre un diálogo para elegir columnas y descarga todos los registros del filtro actual. */
export function ExportExcelDialog({ entity, label, columns, totalCount, onExport, disabled, details }: Props) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const overLimit = totalCount > EXPORT_MAX_ROWS;

  const openDialog = () => {
    setSelected(loadSelection(entity, columns));
    setOpen(true);
  };

  const toggle = (key: string, checked: boolean) =>
    setSelected((s) => (checked ? [...s, key] : s.filter((k) => k !== key)));

  const handleExport = async () => {
    // Siempre en el orden de la definición, sin importar el orden en que se marcaron
    const keys = columns.map((c) => c.key).filter((k) => selected.includes(k));
    if (keys.length === 0) return;
    setExporting(true);
    try {
      const filas = await onExport(keys);
      saveSelection(entity, keys);
      toast.success(`Excel generado con ${filas.toLocaleString("es-CO")} ${filas === 1 ? "registro" : "registros"}`);
      // La descarga ya ocurrió: un fallo del registro de auditoría no debe mostrarse como fallo de la exportación
      logActivity("EXPORT", entity, undefined, { formato: "xlsx", filas, columnas: keys.length, ...details }).catch(() => undefined);
      setOpen(false);
    } catch (err) {
      toast.error("No se pudo exportar: " + errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={openDialog} disabled={disabled}>
        <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
        Exportar Excel
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!exporting) setOpen(o); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Exportar {label} a Excel</DialogTitle>
            <DialogDescription>
              Se exportarán {totalCount.toLocaleString("es-CO")} {totalCount === 1 ? "registro" : "registros"} que cumplen los filtros actuales, en un solo archivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p id={`export-cols-${entity}`} className="text-sm font-medium">
                Columnas ({selected.length} de {columns.length})
              </p>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" disabled={exporting}
                  onClick={() => setSelected(columns.map((c) => c.key))}>Todas</Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" disabled={exporting}
                  onClick={() => setSelected([])}>Ninguna</Button>
              </div>
            </div>
            <div role="group" aria-labelledby={`export-cols-${entity}`} className="grid gap-2 sm:grid-cols-2">
              {columns.map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`export-${entity}-${c.key}`}
                    checked={selected.includes(c.key)}
                    disabled={exporting}
                    onCheckedChange={(checked) => toggle(c.key, checked === true)}
                  />
                  <Label htmlFor={`export-${entity}-${c.key}`} className="cursor-pointer font-normal">{c.titulo}</Label>
                </div>
              ))}
            </div>
            {selected.length === 0 && <p className="text-xs text-destructive">Selecciona al menos una columna</p>}
            {overLimit && (
              <p className="text-xs text-destructive">
                Hay más de {EXPORT_MAX_ROWS.toLocaleString("es-CO")} registros: aplica filtros para exportar menos.
              </p>
            )}
            {!overLimit && totalCount > 20000 && (
              <p className="text-xs text-muted-foreground">
                Es un archivo grande: puede tardar un momento en generarse. No cierres la página mientras se exporta.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={exporting}>Cancelar</Button>
            <Button type="button" onClick={handleExport} disabled={exporting || selected.length === 0 || overLimit}>
              {exporting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Exportando...</>
                : <><FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />Exportar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
