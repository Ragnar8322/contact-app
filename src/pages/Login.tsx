import { useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { APP_MONOGRAM, APP_NAME } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginShowcase } from "@/components/auth/LoginShowcase";
import { loginErrorMessage } from "@/lib/authErrors";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(loginErrorMessage(error.message));
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <LoginShowcase />

      <main className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          {/* En pantallas pequeñas el panel de marca no se muestra: la marca va aquí */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground" aria-hidden="true">
              {APP_MONOGRAM}
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground">Cámara de Comercio de Barranquilla</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">Inicia sesión</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ingresa con el correo y la contraseña que te asignó el administrador.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email" type="email" autoComplete="username" className="h-11"
                value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="nombre@camarabaq.org.co" required aria-invalid={!!error}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password" type={verPassword ? "text" : "password"} autoComplete="current-password" className="h-11 pr-11"
                  value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  required aria-invalid={!!error}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-controls="password"
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {verPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
            ¿Olvidaste tu contraseña? Pide a un administrador que la restablezca.
            <br />
            El acceso es exclusivo del equipo de la Cámara de Comercio de Barranquilla.
          </p>
        </div>
      </main>
    </div>
  );
}
