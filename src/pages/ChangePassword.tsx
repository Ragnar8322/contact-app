import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Check, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
  .regex(/[a-z]/, "Debe incluir al menos una minúscula")
  .regex(/[0-9]/, "Debe incluir al menos un número")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Debe incluir al menos un carácter especial");

const rules = [
  { label: "Mínimo 8 caracteres", test: (v: string) => v.length >= 8 },
  { label: "Al menos una mayúscula (A–Z)", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Al menos una minúscula (a–z)", test: (v: string) => /[a-z]/.test(v) },
  { label: "Al menos un número (0–9)", test: (v: string) => /[0-9]/.test(v) },
  { label: "Al menos un carácter especial (!, @, #, $, etc.)", test: (v: string) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

export default function ChangePassword() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const zodResult = passwordSchema.safeParse(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  const canSubmit = zodResult.success && password === confirm && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false } as any)
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      await refreshProfile();
      toast.success("Contraseña actualizada exitosamente");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-card">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Shield className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Por seguridad, debes cambiar tu contraseña antes de continuar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Security recommendations */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm space-y-2">
            <p className="font-semibold flex items-center gap-2 text-foreground">
              <Shield className="h-4 w-4" /> Recomendaciones para tu contraseña:
            </p>
            <ul className="space-y-1 ml-1">
              {rules.map((r) => {
                const pass = r.test(password);
                return (
                  <li key={r.label} className="flex items-center gap-2">
                    {touched ? (
                      pass ? <Check className="h-3.5 w-3.5 text-primary" /> : <X className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 inline-block" />
                    )}
                    <span className={touched ? (pass ? "text-primary" : "text-destructive") : "text-muted-foreground"}>
                      {r.label}
                    </span>
                  </li>
                );
              })}
              <li className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 inline-block" />
                <span className="text-muted-foreground">No uses tu nombre, correo ni contraseñas anteriores.</span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setTouched(true); }}
                placeholder="••••••••"
                required
              />
              {touched && !zodResult.success && (
                <div className="space-y-1">
                  {zodResult.error.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">{err.message}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nueva contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
              />
              {mismatch && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading ? "Guardando..." : "Guardar y continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
