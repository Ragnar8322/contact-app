import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom no implementa estas APIs de puntero y desplazamiento que usan los Select de Radix
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// Node 22+ define su propio localStorage global (sin almacenamiento si no se pasa --localstorage-file)
// y tapa el de jsdom: se reemplaza por uno en memoria
if (typeof globalThis.localStorage?.getItem !== "function") {
  const datos = new Map<string, string>();
  const memoria: Storage = {
    get length() { return datos.size; },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => { datos.delete(k); },
    setItem: (k, v) => { datos.set(k, String(v)); },
  };
  Object.defineProperty(globalThis, "localStorage", { value: memoria, configurable: true });
}
