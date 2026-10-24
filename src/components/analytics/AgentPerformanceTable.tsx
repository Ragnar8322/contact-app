import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RendimientoAgente } from "@/lib/analytics";

const ROWS_PER_PAGE = 20;
const formatNumber = (n: number) => n.toLocaleString("es-CO");

/** Tabla paginada de rendimiento. Para volver a la primera página, cambiar su `key`. */
export function AgentPerformanceTable({ agentes }: { agentes: RendimientoAgente[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(agentes.length / ROWS_PER_PAGE);
  const visibles = agentes.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Rendimiento por Agente</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agente</TableHead>
              <TableHead className="text-right">Casos Asignados</TableHead>
              <TableHead className="text-right">Gestiones</TableHead>
              <TableHead className="text-right">Renovados</TableHead>
              <TableHead className="text-right">Tasa Renovación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((agent) => (
              <TableRow key={agent.agente}>
                <TableCell className="font-medium">{agent.agente}</TableCell>
                <TableCell className="text-right">{formatNumber(agent.casosAsignados)}</TableCell>
                <TableCell className="text-right">{formatNumber(agent.gestiones)}</TableCell>
                <TableCell className="text-right">{formatNumber(agent.renovados)}</TableCell>
                <TableCell className="text-right">
                  <span className={cn(agent.tasaRenovacion >= 50 ? "text-success" : agent.tasaRenovacion >= 25 ? "text-warning" : "text-red-600")}>
                    {`${agent.tasaRenovacion.toFixed(1)}%`}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {page * ROWS_PER_PAGE + 1} - {Math.min((page + 1) * ROWS_PER_PAGE, agentes.length)} de {agentes.length}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Siguiente</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
