import { useState, useEffect, useCallback } from "react";
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

  const fetchClient = useCallback(async (id: string) => {
    if (id.length < 3) {
      setData(null);
      setSearched(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("identificacion", id)
        .limit(1);
      if (error) throw error;
      setData(rows && rows.length > 0 ? rows[0] : null);
    } catch (err) {
      console.error("Error fetching client:", err);
      setData(null);
    } finally {
      setIsLoading(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => {
    if (identificacion.length < 3) {
      setData(null);
      setSearched(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => fetchClient(identificacion), 400);
    return () => clearTimeout(timer);
  }, [identificacion, fetchClient]);

  const refetch = useCallback(() => {
    if (identificacion.length >= 3) {
      fetchClient(identificacion);
    }
  }, [identificacion, fetchClient]);

  return { data, isLoading, searched, refetch };
}
