/**
 * Número de caso como botón real: se enfoca con Tab y se abre con Enter/Espacio.
 * Las filas de la tabla siguen siendo clicables con el mouse como atajo.
 */
export function CaseIdButton({ id, onOpen }: { id: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Abrir caso #${id}`}
    >
      #{id}
    </button>
  );
}
