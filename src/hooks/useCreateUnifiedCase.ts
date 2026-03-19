import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UnifiedCasePayload {
  p_cliente: {
    identificacion: string;
    nombre: string;
    email?: string;
    telefono?: string;
  };
  p_caso: {
    titulo: string;
    descripcion: string;
    estado?: string;
  };
}

export const useCreateUnifiedCase = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: UnifiedCasePayload) => {
      const { data, error } = await supabase.rpc('create_client_and_case', payload);

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh lists across the application
      queryClient.invalidateQueries({ queryKey: ['casos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      
      toast({
        title: "Caso creado exitosamente",
        description: "El cliente y el caso se han registrado correctamente.",
      });
    },
    onError: (error: Error) => {
      console.error('Error creating unified case:', error);
      toast({
        title: "Error al crear el caso",
        description: error.message || "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    },
  });
};
