export interface EstadoStyle {
  bg: string;
  text: string;
  tailwind: string;
  hex: string;
}

export const ESTADO_STYLES: Record<string, EstadoStyle> = {
  "Registrado": {
    bg: "#3b82f6",
    text: "#ffffff",
    tailwind: "bg-blue-500 text-white",
    hex: "#3b82f6",
  },
  "Asignado": {
    bg: "#6366f1",
    text: "#ffffff",
    tailwind: "bg-indigo-500 text-white",
    hex: "#6366f1",
  },
  "En gestión": {
    bg: "#f59e0b",
    text: "#ffffff",
    tailwind: "bg-amber-500 text-white",
    hex: "#f59e0b",
  },
  "En espera cliente": {
    bg: "#06b6d4",
    text: "#ffffff",
    tailwind: "bg-cyan-500 text-white",
    hex: "#06b6d4",
  },
  "En espera área interna": {
    bg: "#8b5cf6",
    text: "#ffffff",
    tailwind: "bg-violet-500 text-white",
    hex: "#8b5cf6",
  },
  "Resuelto": {
    bg: "#10b981",
    text: "#ffffff",
    tailwind: "bg-emerald-500 text-white",
    hex: "#10b981",
  },
  "No renovado": {
    bg: "#ef4444",
    text: "#ffffff",
    tailwind: "bg-red-500 text-white",
    hex: "#ef4444",
  },
  "No Renovado": {
    bg: "#ef4444",
    text: "#ffffff",
    tailwind: "bg-red-500 text-white",
    hex: "#ef4444",
  },
  "Cerrado por inactividad": {
    bg: "#6b7280",
    text: "#ffffff",
    tailwind: "bg-gray-500 text-white",
    hex: "#6b7280",
  },
  "Cerrado por error": {
    bg: "#9ca3af",
    text: "#ffffff",
    tailwind: "bg-gray-400 text-white",
    hex: "#9ca3af",
  },
  "Renovado": {
    bg: "#22c55e",
    text: "#ffffff",
    tailwind: "bg-green-500 text-white",
    hex: "#22c55e",
  },
  "Pendiente de Pago": {
    bg: "#f97316",
    text: "#ffffff",
    tailwind: "bg-orange-500 text-white",
    hex: "#f97316",
  },
  "Transferido": {
    bg: "hsl(280, 60%, 55%)",
    text: "#ffffff",
    tailwind: "text-white",
    hex: "#9333ea",
  },
  "Numero Errado": {
    bg: "#6b7280",
    text: "#ffffff",
    tailwind: "bg-gray-500 text-white",
    hex: "#6b7280",
  },
  "No Interesado": {
    bg: "#f97316",
    text: "#ffffff",
    tailwind: "bg-orange-500 text-white",
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
