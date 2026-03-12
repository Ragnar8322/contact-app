import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { validateRow, useClearStaging, useInsertStaging, useConfirmImport, type StagingRow } from "@/hooks/useImportCasos";

const TEMPLATE_HEADERS = [
  "cliente_identificacion",
  "agente_nombre",
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
      await confirmMutation.mutateAsync();
      toast.success(`✅ ${valid.length} casos importados correctamente`);
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al importar";
      toast.error(msg);
    }
  };

  const handleReset = () => {
    setRows([]);
    setFileName("");
    setStep("upload");
  };

  // Download template
  const handleTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ["123456789", "Juan Pérez", "Activo", "Renovación", "Descripción del caso", "2026-01-15", "150000"],
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
              step === s ? "text-primary" : STEPS.indexOf(step) > i ? "text-green-600" : "text-muted-foreground"
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
              El archivo debe tener las columnas: <strong>cliente_identificacion, agente_nombre, estado, tipo_servicio, descripcion_inicial, fecha_caso</strong> (valor_pagar opcional).
              Los nombres de columna son flexibles — descarga la plantilla para ver el formato exacto.
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
              <Trash2 className="h-4 w-4 mr-1" />Cancelar
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
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-green-600">{valid.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Válidas ✅</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-red-600">{invalid.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Con errores ❌</p>
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
                            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                            : <XCircle className="h-4 w-4 text-red-600" />}
                        </TableCell>
                        <TableCell className="text-xs">{row.cliente_identificacion ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.agente_nombre ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.estado ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.tipo_servicio ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.fecha_caso ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.valor_pagar ?? "—"}</TableCell>
                        <TableCell className="text-xs text-red-600 max-w-[200px]">
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
      {step === "done" && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-16 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
            <h3 className="text-xl font-bold text-green-700">{valid.length} casos importados exitosamente</h3>
            {invalid.length > 0 && (
              <p className="text-sm text-muted-foreground">{invalid.length} filas con errores fueron omitidas.</p>
            )}
            <Button onClick={handleReset} className="mt-4">Importar otro archivo</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
