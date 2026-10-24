export interface EstadoStyle {
  bg: string;
  text: string;
  tailwind: string;
  hex: string;
}

// bg: fondo de la etiqueta con texto blanco (≥ 4.5:1). hex: color para gráficas, sin texto encima.
export const ESTADO_STYLES: Record<string, EstadoStyle> = {
  "Registrado": {
    bg: "#1d4ed8",
    text: "#ffffff",
    tailwind: "bg-blue-700 text-white",
    hex: "#3b82f6",
  },
  "Asignado": {
    bg: "#4338ca",
    text: "#ffffff",
    tailwind: "bg-indigo-700 text-white",
    hex: "#6366f1",
  },
  "En gestión": {
    bg: "#b45309",
    text: "#ffffff",
    tailwind: "bg-amber-700 text-white",
    hex: "#f59e0b",
  },
  "En espera cliente": {
    bg: "#0e7490",
    text: "#ffffff",
    tailwind: "bg-cyan-700 text-white",
    hex: "#06b6d4",
  },
  "En espera área interna": {
    bg: "#6d28d9",
    text: "#ffffff",
    tailwind: "bg-violet-700 text-white",
    hex: "#8b5cf6",
  },
  "Resuelto": {
    bg: "#047857",
    text: "#ffffff",
    tailwind: "bg-emerald-700 text-white",
    hex: "#10b981",
  },
  "No renovado": {
    bg: "#b91c1c",
    text: "#ffffff",
    tailwind: "bg-red-700 text-white",
    hex: "#ef4444",
  },
  "No Renovado": {
    bg: "#b91c1c",
    text: "#ffffff",
    tailwind: "bg-red-700 text-white",
    hex: "#ef4444",
  },
  "Cerrado por inactividad": {
    bg: "#4b5563",
    text: "#ffffff",
    tailwind: "bg-gray-600 text-white",
    hex: "#6b7280",
  },
  "Cerrado por error": {
    bg: "#57534e",
    text: "#ffffff",
    tailwind: "bg-stone-600 text-white",
    hex: "#9ca3af",
  },
  "Renovado": {
    bg: "#15803d",
    text: "#ffffff",
    tailwind: "bg-green-700 text-white",
    hex: "#22c55e",
  },
  "Pendiente de Pago": {
    bg: "#c2410c",
    text: "#ffffff",
    tailwind: "bg-orange-700 text-white",
    hex: "#f97316",
  },
  "Transferido": {
    bg: "#7e22ce",
    text: "#ffffff",
    tailwind: "bg-purple-700 text-white",
    hex: "#9333ea",
  },
  "Numero Errado": {
    bg: "#4b5563",
    text: "#ffffff",
    tailwind: "bg-gray-600 text-white",
    hex: "#6b7280",
  },
  "No Interesado": {
    bg: "#c2410c",
    text: "#ffffff",
    tailwind: "bg-orange-700 text-white",
    hex: "#f97316",
  },
};

const DEFAULT_STYLE: EstadoStyle = {
  bg: "#e5e7eb",
  text: "#374151",
  tailwind: "bg-gray-200 text-gray-700",
  hex: "#e5e7eb",
};

export function getEstadoStyle(nombre: string | null | undefined): EstadoStyle {
  if (!nombre) return DEFAULT_STYLE;
  return ESTADO_STYLES[nombre] ?? DEFAULT_STYLE;
}

export function getEstadoInlineStyle(nombre: string | null | undefined) {
  const style = getEstadoStyle(nombre);
  return {
    backgroundColor: style.bg,
    color: style.text,
  };
}
