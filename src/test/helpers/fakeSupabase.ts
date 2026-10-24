/**
 * Supabase simulado en memoria para probar hooks de datos sin red.
 * Soporta lo que usan los hooks: select, eq, neq, gte, lte, in, not(col, "is", null),
 * is, or (solo `col.ilike.patron`), order, range, limit, single, maybeSingle, insert, update,
 * delete y rpc.
 * Las tablas se sirven tal cual (los embeds como `cat_estados(nombre)` deben venir ya
 * anidados en las filas); `select` no recorta columnas.
 */
type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

export interface Llamada {
  tabla: string;
  op: "select" | "insert" | "update" | "delete";
  valores?: unknown;
  filtros: string[];
}

export interface FakeSupabaseOptions {
  tablas?: Record<string, Row[]>;
  rpc?: Record<string, (args: Record<string, unknown>) => unknown>;
  /** Error a devolver para una tabla u operación ("tabla" o "tabla.op") */
  errores?: Record<string, { message: string; code?: string }>;
}

const valorDe = (row: Row, col: string) => row[col];

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  private filtros: Filter[] = [];
  private descripcion: string[] = [];
  private desde = 0;
  private hasta = Infinity;
  private orden: { col: string; asc: boolean }[] = [];
  private modo: "many" | "single" | "maybeSingle" = "many";
  private op: Llamada["op"] = "select";
  private valores: unknown;
  private conteo = false;

  constructor(private db: FakeSupabase, private tabla: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.conteo = true;
    return this;
  }
  insert(valores: unknown) { this.op = "insert"; this.valores = valores; return this; }
  update(valores: unknown) { this.op = "update"; this.valores = valores; return this; }
  delete() { this.op = "delete"; return this; }

  private filtro(desc: string, f: Filter) { this.descripcion.push(desc); this.filtros.push(f); return this; }
  eq(col: string, v: unknown) { return this.filtro(`${col}=eq.${v}`, (r) => valorDe(r, col) === v); }
  neq(col: string, v: unknown) { return this.filtro(`${col}=neq.${v}`, (r) => valorDe(r, col) !== v); }
  gte(col: string, v: string | number) { return this.filtro(`${col}=gte.${v}`, (r) => (valorDe(r, col) as string | number) >= v); }
  lte(col: string, v: string | number) { return this.filtro(`${col}=lte.${v}`, (r) => (valorDe(r, col) as string | number) <= v); }
  in(col: string, vs: unknown[]) { return this.filtro(`${col}=in.(${vs.length})`, (r) => vs.includes(valorDe(r, col))); }
  is(col: string, v: null) { return this.filtro(`${col}=is.${v}`, (r) => valorDe(r, col) == v); }
  not(col: string, op: string, v: unknown) {
    if (op !== "is" || v !== null) throw new Error(`not(${op}) no soportado`);
    return this.filtro(`${col}=not.is.null`, (r) => valorDe(r, col) != null);
  }
  or(expr: string, opts?: { referencedTable?: string }) {
    const condiciones = expr.split(",").map((c) => {
      const [col, op, ...resto] = c.split(".");
      if (op !== "ilike") throw new Error(`or(${op}) no soportado`);
      const patron = new RegExp("^" + resto.join(".").split("%").map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
      return (r: Row) => {
        const base = opts?.referencedTable ? (r[opts.referencedTable] as Row | null) : r;
        return patron.test(String(base?.[col] ?? ""));
      };
    });
    return this.filtro(`or=(${expr})${opts?.referencedTable ? `@${opts.referencedTable}` : ""}`, (r) => condiciones.some((c) => c(r)));
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) { this.orden.push({ col, asc: opts?.ascending ?? true }); return this; }
  range(from: number, to: number) { this.desde = from; this.hasta = to; return this; }
  limit(n: number) { this.hasta = this.desde + n - 1; return this; }
  single() { this.modo = "single"; return this; }
  maybeSingle() { this.modo = "maybeSingle"; return this; }

  private ejecutar() {
    this.db.llamadas.push({ tabla: this.tabla, op: this.op, valores: this.valores, filtros: this.descripcion });
    const error = this.db.errores[`${this.tabla}.${this.op}`] ?? this.db.errores[this.tabla];
    if (error) return { data: null, error, count: null };

    const tabla = (this.db.tablas[this.tabla] ??= []);
    const coincide = (r: Row) => this.filtros.every((f) => f(r));

    if (this.op === "insert") {
      const nuevas = (Array.isArray(this.valores) ? this.valores : [this.valores]) as Row[];
      tabla.push(...nuevas.map((n) => ({ ...n })));
      return { data: this.modo === "many" ? nuevas : nuevas[0], error: null };
    }
    if (this.op === "update") {
      const afectadas = tabla.filter(coincide);
      afectadas.forEach((r) => Object.assign(r, this.valores));
      return { data: this.modo === "many" ? afectadas : afectadas[0] ?? null, error: null };
    }
    if (this.op === "delete") {
      const restantes = tabla.filter((r) => !coincide(r));
      const borradas = tabla.length - restantes.length;
      this.db.tablas[this.tabla] = restantes;
      return { data: null, error: null, count: borradas };
    }

    let filas = tabla.filter(coincide);
    for (const { col, asc } of [...this.orden].reverse()) {
      filas = [...filas].sort((a, b) => {
        const x = valorDe(a, col) as string | number, y = valorDe(b, col) as string | number;
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
      });
    }
    const total = filas.length;
    filas = filas.slice(this.desde, this.hasta + 1);
    if (this.modo === "single") {
      return filas.length === 1
        ? { data: filas[0], error: null }
        : { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
    }
    if (this.modo === "maybeSingle") return { data: filas[0] ?? null, error: null };
    return { data: filas, error: null, count: this.conteo ? total : null };
  }

  then<A = { data: unknown; error: unknown }, B = never>(
    ok?: ((v: { data: unknown; error: unknown; count?: number | null }) => A | PromiseLike<A>) | null,
    fail?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.ejecutar()).then(ok, fail);
  }
}

export class FakeSupabase {
  tablas: Record<string, Row[]>;
  errores: Record<string, { message: string; code?: string }>;
  llamadas: Llamada[] = [];
  rpcLlamadas: { fn: string; args: Record<string, unknown> }[] = [];
  private rpcs: Record<string, (args: Record<string, unknown>) => unknown>;

  constructor(opts: FakeSupabaseOptions = {}) {
    this.tablas = structuredClone(opts.tablas ?? {});
    this.errores = opts.errores ?? {};
    this.rpcs = opts.rpc ?? {};
  }

  from(tabla: string) { return new Query(this, tabla); }

  async rpc(fn: string, args: Record<string, unknown> = {}) {
    this.rpcLlamadas.push({ fn, args });
    const error = this.errores[`rpc.${fn}`];
    if (error) return { data: null, error };
    const impl = this.rpcs[fn];
    if (!impl) return { data: null, error: { message: `rpc ${fn} no simulada` } };
    return { data: await impl(args), error: null };
  }

  /** Lecturas hechas a una tabla, para verificar paginación y lotes */
  lecturas(tabla: string) { return this.llamadas.filter((l) => l.tabla === tabla && l.op === "select"); }
}
