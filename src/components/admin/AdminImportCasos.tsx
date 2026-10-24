import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { validateRow, useClearStaging, useInsertStaging, useConfirmImport, type StagingRow, type ImportResult } from "@/hooks/useImportCasos";
import { useCampana } from "@/contexts/CampanaContext";

const TEMPLATE_HEADERS = [
  "cliente_identificacion",
  "agente_correo",
  "estado",
  "tipo_servicio",
  "descripcion_inicial",
  "fecha_caso",
  "valor_pagar",
];

const STEPS = ["upload", "preview", "done"] as const;
type Step = typeof STEPS[number];

export default function AdminImportCasos() {
  const [step, setStep]     = useState<Step>("upload");
  const [rows, setRows]     = useState<StagingRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [resultado, setResultado] = useState<ImportResult | null>(null);

  const { campanaActiva } = useCampana();
  const clearMutation   = useClearStaging();
  const insertMutation  = useInsertStaging();
  const confirmMutation = useConfirmImport();

  const valid   = rows.filter(r => r._valid);
  const invalid = rows.filter(r => !r._valid);

  // Parse Excel with dynamic import (xlsx already lazy from Fase 5)
  const parseFile = useCallback(async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb     = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws     = wb.Sheets[wb.SheetNames[0]];
      const raw    = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
      const parsed = raw.map((r, i) => validateRow(r, i + 2)); // row 2 = first data row
      setRows(parsed);
      setFileName(file.name);
      setStep("preview");
    } catch {
      toast.error("No se pudo leer el archivo. Asegúrate de que sea .xlsx o .xls");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "application/vnd.ms-excel": [".xls"] },
    maxFiles: 1,
    onDrop: ([file]) => file && parseFile(file),
  });

  const handleConfirm = async () => {
    try {
      await clearMutation.mutateAsync();
      await insertMutation.mutateAsync(rows);
      const r = await confirmMutation.mutateAsync(campanaActiva?.id ?? null);
      setResultado(r);
      if (r.inserted > 0) toast.success(`${r.inserted} casos importados en ${campanaActiva?.nombre ?? "la campaña activa"}`);
      if (r.skipped > 0) toast.warning(`${r.skipped} filas rechazadas`, { description: "Revisa el detalle para corregirlas." });
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al importar";
      toast.error(msg);
    }
  };

  const handleReset = () => {
    setResultado(null);
    setRows([]);
    setFileName("");
    setStep("upload");
  };

  // Download template
  const handleTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ["900123456", "agente@camarabaq.org.co", "Registrado", "Renovación Web", "Solicita renovación de matrícula", "15/01/2026", "$150.000"],
    ]);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_importacion_casos.xlsx");
  };

  const isLoading = clearMutation.isPending || insertMutation.isPending || confirmMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Progress steps */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "preview", "done"] as Step[]).map((s, i) => (
          <>
            <span key={s} className={`flex items-center gap-1 font-medium ${
              step === s ? "text-primary" : STEPS.indexOf(step) > i ? "text-success" : "text-muted-foreground"
            }`}>
              {STEPS.indexOf(step) > i ? <CheckCircle2 className="h-4 w-4" /> : <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">{i + 1}</span>}
              {s === "upload" ? "Cargar archivo" : s === "preview" ? "Revisar" : "Completado"}
            </span>
            {i < 2 && <span className="text-muted-foreground">→</span>}
          </>
        ))}
      </div>

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleTemplate}>
              <Download className="h-4 w-4 mr-1" />Descargar plantilla
            </Button>
          </div>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">{isDragActive ? "Suelta el archivo aquí" : "Arrastra tu archivo Excel aquí"}</p>
            <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar · .xlsx / .xls</p>
          </div>
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              El archivo debe tener las columnas <strong>cliente_identificacion, agente_correo, estado, tipo_servicio, descripcion_inicial y fecha_caso</strong>; <strong>valor_pagar</strong> es opcional.
              Si no tienes el correo del agente puedes usar la columna <strong>agente_nombre</strong>. Las fechas pueden ir como 2026-01-15 o 15/01/2026, y los montos como 150000 o $150.000.
              Descarga la plantilla para ver el formato exacto.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-sm">{fileName}</span>
              <Badge variant="secondary">{rows.length} filas</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="h-4 w-4 mr-1" />Cancelar
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-muted">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold">{rows.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total filas</p>
              </CardContent>
            </Card>
            <Card className="border-success/30 bg-success/10">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-success">{valid.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Válidas</p>
              </CardContent>
            </Card>
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-destructive">{invalid.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Con errores</p>
              </CardContent>
            </Card>
          </div>

          {invalid.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {invalid.length} fila(s) tienen errores y <strong>no se importarán</strong>. Corrígelas en el Excel y vuelve a cargar, o continúa importando solo las filas válidas.
              </AlertDescription>
            </Alert>
          )}

          {/* Table preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Vista previa (primeras 50 filas)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Identificación</TableHead>
                      <TableHead>Agente</TableHead>
                      <TableHead>Estado caso</TableHead>
                      <TableHead>Tipo servicio</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Errores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((row) => (
                      <TableRow key={row._rowIndex} className={row._valid ? "" : "bg-red-50 dark:bg-red-950/20"}>
                        <TableCell className="text-xs text-muted-foreground">{row._rowIndex}</TableCell>
                        <TableCell>
                          {row._valid
                            ? <CheckCircle2 className="h-4 w-4 text-success" aria-label="Válida" />
                            : <XCircle className="h-4 w-4 text-destructive" aria-label="Con errores" />}
                        </TableCell>
                        <TableCell className="text-xs">{row.cliente_identificacion ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.agente_correo ?? row.agente_nombre ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.estado ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.tipo_servicio ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.fecha_caso ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.valor_pagar ?? "—"}</TableCell>
                        <TableCell className="text-xs text-destructive max-w-[200px]">
                          {row._errors.join(" · ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleReset} disabled={isLoading}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={valid.length === 0 || isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</>
                : <><CheckCircle2 className="h-4 w-4 mr-2" />Confirmar importación ({valid.length} casos)</>}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Done */}
      {step === "done" && resultado && (
        <div className="space-y-4">
          <Card className={resultado.skipped === 0 ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}>
            <CardContent className="py-10 text-center space-y-3">
              {resultado.skipped === 0
                ? <CheckCircle2 className="h-14 w-14 text-success mx-auto" aria-hidden="true" />
                : <AlertTriangle className="h-14 w-14 text-warning mx-auto" aria-hidden="true" />}
              <h3 className="text-xl font-bold">
                {resultado.inserted} {resultado.inserted === 1 ? "caso importado" : "casos importados"}
              </h3>
              {(resultado.skipped > 0 || invalid.length > 0) && (
                <p className="text-sm text-muted-foreground">
                  {resultado.skipped > 0 && `${resultado.skipped} filas rechazadas al procesar. `}
                  {invalid.length > 0 && `${invalid.length} filas con errores de formato no se enviaron.`}
                </p>
              )}
              <Button onClick={handleReset} className="mt-2">Importar otro archivo</Button>
            </CardContent>
          </Card>

          {resultado.rechazados.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Filas rechazadas</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Fila</TableHead>
                      <TableHead>Identificación</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.rechazados.map((rr) => (
                      <TableRow key={rr.fila}>
                        <TableCell className="font-mono text-xs">{rr.fila}</TableCell>
                        <TableCell className="text-xs">{rr.identificacion ?? "—"}</TableCell>
                        <TableCell className="text-xs">{rr.motivo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
