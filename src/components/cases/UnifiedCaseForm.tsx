import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { useEstados, useTiposServicio } from "@/hooks/useCases";
import { useClientByIdentificacion } from "@/hooks/useClientByIdentificacion";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Info, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const clienteSchema = z.object({
  identificacion: z.string().min(1, "La identificación es obligatoria"),
  tipo_cliente: z.string().min(1, "Selecciona el tipo"),
  nombre_contacto: z.string().min(1, "El nombre es obligatorio"),
  razon_social: z.string().optional(),
  telefono: z.string().optional(),
  celular: z.string().optional(),
  correo: z.string().email("Correo inválido").optional().or(z.literal("")),
});

const casoSchema = z.object({
  tipo_servicio_id: z.number().min(1, "Selecciona un tipo de servicio"),
  descripcion_inicial: z.string().min(1, "La descripción es obligatoria"),
});

type ClienteForm = z.infer<typeof clienteSchema>;
type CasoForm = z.infer<typeof casoSchema>;

interface Props {
  onSuccess: () => void;
}

export default function UnifiedCaseForm({ onSuccess }: Props) {
  const { user } = useAuth();
  const { campanaActiva } = useCampana();
  const { data: estados } = useEstados();
  const { data: tipos } = useTiposServicio();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Client search
  const [identificacion, setIdentificacion] = useState("");
  const { data: foundClient, isLoading: searching, searched, refetch: refetchClient } = useClientByIdentificacion(identificacion);

  const clientExists = !!foundClient;
  const clientNotFound = searched && !foundClient && identificacion.length >= 3;

  // Client form (only used when new client)
  const clientForm = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      identificacion: "",
      tipo_cliente: "Persona",
      nombre_contacto: "",
      razon_social: "",
      telefono: "",
      celular: "",
      correo: "",
    },
  });

  const tipoCliente = clientForm.watch("tipo_cliente");

  // Case form
  const casoForm = useForm<CasoForm>({
    resolver: zodResolver(casoSchema),
    defaultValues: {
      tipo_servicio_id: 0,
      descripcion_inicial: "",
    },
  });

  const registradoId = estados?.find(e => e.nombre === "Registrado")?.id || 1;

  // Section 2 enabled when client is resolved
  const section2Enabled = clientExists || (clientNotFound && !searching);

  const handleIdentificacionChange = (val: string) => {
    setIdentificacion(val);
    clientForm.setValue("identificacion", val);
    if (val.length < 3) {
      clientForm.reset({
        identificacion: val,
        tipo_cliente: "Persona",
        nombre_contacto: "",
        razon_social: "",
        telefono: "",
        celular: "",
        correo: "",
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      let clienteId: number;

      if (clientExists) {
        // Existing client - only validate case form
        const casoValid = await casoForm.trigger();
        if (!casoValid) {
          setSaving(false);
          return;
        }
        clienteId = foundClient!.id;
      } else {
        // New client - validate both forms
        const [clientValid, casoValid] = await Promise.all([
          clientForm.trigger(),
          casoForm.trigger(),
        ]);

        // Validate razon_social for Empresa
        if (clientForm.getValues("tipo_cliente") === "Empresa" && !clientForm.getValues("razon_social")?.trim()) {
          clientForm.setError("razon_social", { message: "La razón social es obligatoria para Empresa" });
          setSaving(false);
          return;
        }

        if (!clientValid || !casoValid) {
          setSaving(false);
          return;
        }

        const clientData = clientForm.getValues();
        const { data: newClient, error: clientError } = await supabase
          .from("clientes")
          .insert({
            identificacion: clientData.identificacion,
            tipo_cliente: clientData.tipo_cliente,
            nombre_contacto: clientData.nombre_contacto.toUpperCase(),
            razon_social: clientData.tipo_cliente === "Empresa" ? (clientData.razon_social?.toUpperCase() || null) : null,
            telefono: clientData.telefono || null,
            celular: clientData.celular || null,
            correo: clientData.correo?.toLowerCase() || null,
          })
          .select()
          .single();

        if (clientError) {
          toast.error("Error al crear cliente: " + clientError.message);
          setSaving(false);
          return;
        }

        clienteId = newClient.id;
      }

      // Create case
      const casoData = casoForm.getValues();

      const { error: casoError } = await supabase
        .from("casos")
        .insert({
          cliente_id: clienteId,
          tipo_servicio_id: casoData.tipo_servicio_id,
          descripcion_inicial: casoData.descripcion_inicial,
          valor_pagar: null,
          estado_id: registradoId,
          agente_id: user.id,
          created_by: user.id,
          campana_id: campanaActiva?.id || null,
        });

      if (casoError) {
        const msg = clientExists
          ? "Error al crear el caso: " + casoError.message
          : "El cliente fue registrado pero hubo un error al crear el caso. Por favor crea el caso manualmente desde la lista de clientes.";
        toast.error(msg);
        setSaving(false);
        return;
      }

      toast.success(clientExists ? "Caso creado exitosamente" : "Cliente y caso creados exitosamente");
      queryClient.invalidateQueries({ queryKey: ["casos"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      onSuccess();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nuevo Caso</DialogTitle>
      </DialogHeader>

      <div className="space-y-6 mt-2">
        {/* SECTION 1: Client */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Información del Cliente</h3>

          {/* Identificación */}
          <div className="space-y-2 mb-4">
            <Label>Identificación *</Label>
            <div className="relative">
              <Input
                placeholder="Cédula o NIT..."
                value={identificacion}
                onChange={e => handleIdentificacionChange(e.target.value)}
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Client found */}
          {clientExists && (
            <>
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 mb-4 text-sm text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Cliente encontrado. Verifica la información antes de continuar.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <ReadOnlyField label="Tipo de Cliente" value={foundClient!.tipo_cliente} />
                <ReadOnlyField label="Nombre del Contacto" value={foundClient!.nombre_contacto} />
                {foundClient!.tipo_cliente === "Empresa" && (
                  <ReadOnlyField label="Razón Social" value={foundClient!.razon_social || "-"} />
                )}
                <ReadOnlyField label="Teléfono" value={foundClient!.telefono || "-"} />
                <ReadOnlyField label="Celular" value={foundClient!.celular || "-"} />
                <ReadOnlyField label="Correo" value={foundClient!.correo || "-"} />
              </div>

              <div className="flex items-center gap-3 mt-2">
                <a
                  href={`/clientes?buscar=${encodeURIComponent(foundClient!.identificacion)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ¿Datos incorrectos? Editar cliente <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={refetchClient}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Recargar datos del cliente
                </button>
              </div>
            </>
          )}

          {/* Client not found */}
          {clientNotFound && (
            <>
              <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 mb-4 text-sm text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
                <Info className="h-4 w-4 shrink-0" />
                <span>Cliente no encontrado. Completa los datos para registrarlo.</span>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Controller
                      control={clientForm.control}
                      name="tipo_cliente"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Persona">Persona</SelectItem>
                            <SelectItem value="Empresa">Empresa</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre del Contacto *</Label>
                    <Controller
                      control={clientForm.control}
                      name="nombre_contacto"
                      render={({ field, fieldState }) => (
                        <>
                          <Input
                            {...field}
                            onChange={e => field.onChange(e.target.value.toUpperCase())}
                            className="uppercase"
                            placeholder="Nombre completo"
                          />
                          {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                        </>
                      )}
                    />
                  </div>
                </div>

                {tipoCliente === "Empresa" && (
                  <div className="space-y-2">
                    <Label>Razón Social *</Label>
                    <Controller
                      control={clientForm.control}
                      name="razon_social"
                      render={({ field, fieldState }) => (
                        <>
                          <Input
                            {...field}
                            onChange={e => field.onChange(e.target.value.toUpperCase())}
                            className="uppercase"
                            placeholder="Razón social de la empresa"
                          />
                          {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                        </>
                      )}
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Controller
                      control={clientForm.control}
                      name="telefono"
                      render={({ field }) => (
                        <Input
                          {...field}
                          onChange={e => field.onChange(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="Teléfono fijo"
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Celular</Label>
                    <Controller
                      control={clientForm.control}
                      name="celular"
                      render={({ field }) => (
                        <Input
                          {...field}
                          onChange={e => field.onChange(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="Celular"
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Correo electrónico</Label>
                  <Controller
                    control={clientForm.control}
                    name="correo"
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          {...field}
                          type="email"
                          onChange={e => field.onChange(e.target.value.toLowerCase())}
                          className="lowercase"
                          placeholder="correo@ejemplo.com"
                        />
                        {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                      </>
                    )}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* SECTION 2: Case */}
        <div className={!section2Enabled ? "opacity-50 pointer-events-none" : ""}>
          <h3 className="text-sm font-semibold text-foreground mb-3">Información del Caso</h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Servicio *</Label>
              <Controller
                control={casoForm.control}
                name="tipo_servicio_id"
                render={({ field, fieldState }) => (
                  <>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={v => {
                        field.onChange(Number(v));
                      }}
                      disabled={!section2Enabled}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {tipos?.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                  </>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción Inicial *</Label>
              <Controller
                control={casoForm.control}
                name="descripcion_inicial"
                render={({ field, fieldState }) => (
                  <>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Describe el motivo o requerimiento del caso..."
                      disabled={!section2Enabled}
                    />
                    {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                  </>
                )}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSave}
          disabled={saving || !section2Enabled}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : clientExists ? "Crear Caso" : "Crear Cliente y Caso"}
        </Button>
      </div>
    </DialogContent>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">{value}</p>
    </div>
  );
}
