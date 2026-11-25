import type { Workbook } from "exceljs";
import { loadExcelJS } from "./excel";
import { APP_NAME } from "@/lib/constants";

type Celda = string | number | Date | null;

/** Columna que el usuario puede incluir o no en la exportación. */
export interface ColumnaDef<T, Ctx = undefined> {
  /** Identificador estable (se guarda como preferencia del usuario) */
  key: string;
  /** Encabezado en Excel; debe ser único dentro de la tabla */
  titulo: string;
  ancho: number;
  /** Formato de número o fecha de Excel */
  formato?: string;
  alinear?: "left" | "right";
  valor: (fila: T, ctx: Ctx) => Celda;
}

/** Lo que el diálogo de exportación necesita para listar las columnas. */
export interface ColumnaOpcion {
  key: string;
  titulo: string;
}

const FMT_FECHA = "dd/mm/yyyy";
const FMT_FECHA_HORA = "dd/mm/yyyy hh:mm";
const FMT_MONTO = "#,##0";

/**
 * ExcelJS escribe las fechas como UTC. Se desplaza el instante para que Excel muestre la misma
 * fecha y hora que ve el usuario en pantalla (hora local de Colombia).
 */
export function fechaLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
}

/**
 * Libro de una sola hoja con los datos como tabla de Excel (encabezado fijo, filtros y filas alternas).
 * `seleccion` son las claves de las columnas a incluir; sin ella van todas. El orden de las columnas
 * es siempre el de la definición, no el orden en que se marcaron.
 */
async function buildTableWorkbook<T, Ctx>(opts: {
  hoja: string;
  tabla: string;
  definicion: ColumnaDef<T, Ctx>[];
  seleccion?: string[];
  datos: T[];
  ctx: Ctx;
}): Promise<Workbook> {
  const elegidas = opts.seleccion
    ? opts.definicion.filter((c) => opts.seleccion!.includes(c.key))
    : opts.definicion;
  if (elegidas.length === 0) throw new Error("Selecciona al menos una columna para exportar.");

  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = `${APP_NAME} · Cámara de Comercio de Barranquilla`;
  wb.created = new Date();

  const ws = wb.addWorksheet(opts.hoja, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addTable({
    name: opts.tabla,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: elegidas.map((c) => ({ name: c.titulo, filterButton: true })),
    rows: opts.datos.map((fila) => elegidas.map((c) => c.valor(fila, opts.ctx))),
  });

  elegidas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.ancho;
    if (c.formato) col.numFmt = c.formato;
    if (c.alinear) col.alignment = { horizontal: c.alinear };
  });
  // El encabezado no lleva formato numérico ni de fecha
  ws.getRow(1).numFmt = "General";
  return wb;
}

const opciones = <T, Ctx>(def: ColumnaDef<T, Ctx>[]): ColumnaOpcion[] =>
  def.map(({ key, titulo }) => ({ key, titulo }));

// ── Casos ──

/** Campos del caso que se exportan (los mismos que trae la lista de Casos). */
export interface CasoExportable {
  id: number;
  fecha_caso: string;
  fecha_cierre: string | null;
  valor_pagar: number | null;
  descripcion_inicial: string;
  observacion_cierre: string | null;
  campana_id: string | null;
  transferido_a_campana_id: string | null;
  transferido_a_caso_id: number | null;
  clientes: {
    identificacion: string;
    nombre_contacto: string;
    razon_social: string | null;
    telefono: string | null;
    celular: string | null;
    correo: string | null;
  } | null;
  cat_estados: { nombre: string } | null;
  cat_tipo_servicio: { nombre: string } | null;
  cat_agentes: { nombre: string } | null;
  caso_destino: { campanas: { nombre: string } | null } | null;
}

interface CasosCtx {
  /** Nombre de la campaña por id; en blanco si no hay id */
  campana: (id: string | null) => string;
}

const CASOS_COLUMNAS: ColumnaDef<CasoExportable, CasosCtx>[] = [
  { key: "id", titulo: "ID", ancho: 9, alinear: "left", valor: (c) => c.id },
  { key: "fecha_caso", titulo: "Fecha del caso", ancho: 18, formato: FMT_FECHA_HORA, alinear: "left", valor: (c) => fechaLocal(c.fecha_caso) },
  { key: "identificacion", titulo: "NIT / Cédula", ancho: 16, alinear: "left", valor: (c) => c.clientes?.identificacion ?? null },
  { key: "cliente", titulo: "Cliente", ancho: 34, valor: (c) => c.clientes?.nombre_contacto ?? null },
  { key: "razon_social", titulo: "Razón social", ancho: 34, valor: (c) => c.clientes?.razon_social ?? null },
  { key: "telefono", titulo: "Teléfono", ancho: 14, alinear: "left", valor: (c) => c.clientes?.telefono ?? null },
  { key: "celular", titulo: "Celular", ancho: 14, alinear: "left", valor: (c) => c.clientes?.celular ?? null },
  { key: "correo", titulo: "Correo", ancho: 30, valor: (c) => c.clientes?.correo ?? null },
  { key: "campana", titulo: "Campaña", ancho: 24, valor: (c, x) => x.campana(c.campana_id) },
  { key: "tipo_servicio", titulo: "Tipo de servicio", ancho: 24, valor: (c) => c.cat_tipo_servicio?.nombre ?? null },
  { key: "estado", titulo: "Estado", ancho: 20, valor: (c) => c.cat_estados?.nombre ?? null },
  { key: "agente", titulo: "Agente", ancho: 28, valor: (c) => c.cat_agentes?.nombre ?? null },
  { key: "valor_pagar", titulo: "Valor a pagar", ancho: 16, formato: FMT_MONTO, valor: (c) => c.valor_pagar },
  { key: "descripcion", titulo: "Descripción inicial", ancho: 50, valor: (c) => c.descripcion_inicial },
  { key: "fecha_cierre", titulo: "Fecha de cierre", ancho: 18, formato: FMT_FECHA_HORA, alinear: "left", valor: (c) => fechaLocal(c.fecha_cierre) },
  { key: "observacion_cierre", titulo: "Observación de cierre", ancho: 50, valor: (c) => c.observacion_cierre },
  { key: "campana_destino", titulo: "Campaña destino", ancho: 24, valor: (c, x) => c.caso_destino?.campanas?.nombre ?? x.campana(c.transferido_a_campana_id) },
  { key: "nuevo_caso", titulo: "Nuevo caso #", ancho: 14, alinear: "left", valor: (c) => c.transferido_a_caso_id },
];

/** Columnas que se pueden elegir al exportar casos, en el orden del archivo. */
export const CASOS_OPCIONES: ColumnaOpcion[] = opciones(CASOS_COLUMNAS);

export async function buildCasosWorkbook(
  casos: CasoExportable[],
  /** Nombre de la campaña por id; devuelve "—" si no la encuentra */
  campanaName: (id: string | null) => string,
  /** Claves de las columnas a incluir; sin ella van todas */
  columnas?: string[],
): Promise<Workbook> {
  return buildTableWorkbook({
    hoja: "Casos",
    tabla: "Casos",
    definicion: CASOS_COLUMNAS,
    seleccion: columnas,
    datos: casos,
    ctx: { campana: (id) => (id ? campanaName(id) : "") },
  });
}

// ── Clientes ──

export interface ClienteExportable {
  id: number;
  identificacion: string;
  nombre_contacto: string;
  tipo_cliente: string;
  razon_social: string | null;
  telefono: string | null;
  celular: string | null;
  correo: string | null;
  created_at: string | null;
}

const CLIENTES_COLUMNAS: ColumnaDef<ClienteExportable>[] = [
  { key: "id", titulo: "ID", ancho: 9, alinear: "left", valor: (c) => c.id },
  { key: "identificacion", titulo: "NIT / Cédula", ancho: 16, alinear: "left", valor: (c) => c.identificacion },
  { key: "nombre_contacto", titulo: "Nombre del contacto", ancho: 36, valor: (c) => c.nombre_contacto },
  { key: "tipo_cliente", titulo: "Tipo", ancho: 12, valor: (c) => c.tipo_cliente },
  { key: "razon_social", titulo: "Razón social", ancho: 36, valor: (c) => c.razon_social },
  { key: "telefono", titulo: "Teléfono", ancho: 14, alinear: "left", valor: (c) => c.telefono },
  { key: "celular", titulo: "Celular", ancho: 14, alinear: "left", valor: (c) => c.celular },
  { key: "correo", titulo: "Correo", ancho: 32, valor: (c) => c.correo },
  { key: "created_at", titulo: "Fecha de creación", ancho: 18, formato: FMT_FECHA, alinear: "left", valor: (c) => fechaLocal(c.created_at) },
];

/** Columnas que se pueden elegir al exportar clientes, en el orden del archivo. */
export const CLIENTES_OPCIONES: ColumnaOpcion[] = opciones(CLIENTES_COLUMNAS);

export async function buildClientesWorkbook(clientes: ClienteExportable[], columnas?: string[]): Promise<Workbook> {
  return buildTableWorkbook({
    hoja: "Clientes",
    tabla: "Clientes",
    definicion: CLIENTES_COLUMNAS,
    seleccion: columnas,
    datos: clientes,
    ctx: undefined,
  });
}
