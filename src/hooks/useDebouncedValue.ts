import { useEffect, useState } from "react";

/** Devuelve `value` solo cuando deja de cambiar durante `delayMs` (búsquedas mientras se escribe). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
