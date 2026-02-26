import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteFound {
  id: number;
  identificacion: string;
  nombre_contacto: string;
  tipo_cliente: string;
  razon_social: string | null;
  telefono: string | null;
  celular: string | null;
  correo: string | null;
}

export function useClientByIdentificacion(identificacion: string) {
  const [data, setData] = useState<ClienteFound | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (identificacion.length < 3) {
      setData(null);
      setSearched(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data: rows, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("identificacion", identificacion)
          .limit(1);
        if (error) throw error;
        setData(rows && rows.length > 0 ? rows[0] : null);
      } catch {
        setData(null);
      } finally {
        setIsLoading(false);
        setSearched(true);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [identificacion]);

  return { data, isLoading, searched };
}
