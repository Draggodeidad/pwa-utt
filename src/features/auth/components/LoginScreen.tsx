"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  CircleAlert,
  CloudOff,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type LoginStatus = "idle" | "loading" | "error";
type LoginFormValues = { identifier: string; password: string };

const initialValues: LoginFormValues = { identifier: "", password: "" };

/** Temporary client-side login boundary; no session or API is connected yet. */
export function LoginScreen() {
  const [values, setValues] = useState<LoginFormValues>(initialValues);
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [passwordVisible, setPasswordVisible] = useState(false);

  function updateValue(field: keyof LoginFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (status === "error") setStatus("idle");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    window.setTimeout(() => setStatus("error"), 450);
  }

  const isLoading = status === "loading";
  const PasswordIcon = passwordVisible ? EyeOff : Eye;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_hsl(var(--secondary))_0,_hsl(var(--background))_48%)] p-6 max-sm:items-start max-sm:p-4">
      <Card className="w-full max-w-md overflow-hidden border-border/80 shadow-xl shadow-primary/5">
        <CardHeader className="items-center space-y-3 border-b bg-muted/35 px-6 py-8 text-center max-sm:px-5">
          <div
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
          >
            <ShieldCheck className="size-6" strokeWidth={1.8} />
          </div>
          <Badge
            variant="secondary"
            className="gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[.08em] text-secondary-foreground"
          >
            <span
              className="size-1.5 rounded-full bg-emerald-600"
              aria-hidden="true"
            />
            Registro oficial · SGI-LAB
          </Badge>
          <div className="space-y-1">
            <CardTitle id="login-title" className="text-[28px] tracking-tight">
              Inspecciones
            </CardTitle>
            <CardDescription>
              Mantenimiento de Laboratorios Universitarios
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-6 max-sm:p-5">
          <form
            className="space-y-5"
            onSubmit={handleSubmit}
            noValidate
            aria-labelledby="login-title"
          >
            <LoginField
              helper="Correo Institucional"
              htmlFor="identifier"
              label="Correo"
            >
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoComplete="username"
                className="h-11 pl-10"
                id="identifier"
                name="identifier"
                onChange={(event) =>
                  updateValue("identifier", event.target.value)
                }
                placeholder="j.mendoza@universidad.edu"
                type="email"
                value={values.identifier}
              />
            </LoginField>

            <LoginField helper="" htmlFor="password" label="Contraseña">
              <LockKeyhole
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoComplete="current-password"
                className="h-11 pl-10 pr-11"
                id="password"
                name="password"
                onChange={(event) =>
                  updateValue("password", event.target.value)
                }
                placeholder="Ingresa tu contraseña"
                type={passwordVisible ? "text" : "password"}
                value={values.password}
              />
              <Button
                aria-label={
                  passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setPasswordVisible((visible) => !visible)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <PasswordIcon aria-hidden="true" className="size-4" />
              </Button>
            </LoginField>

            <div aria-live="polite">
              {status === "error" ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Acceso no concedido</AlertTitle>
                  <AlertDescription>
                    Identificador o contraseña no válidos. Verifica tus
                    credenciales institucionales.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <Button
              className="h-11 w-full gap-2"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                  Validando acceso…
                </>
              ) : (
                <>
                  Iniciar sesión
                  <ShieldCheck aria-hidden="true" className="size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function LoginField({
  children,
  helper,
  htmlFor,
  label,
}: Readonly<{
  children: ReactNode;
  helper: string;
  htmlFor: string;
  label: string;
}>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium" htmlFor={htmlFor}>
          {label}
        </label>
        <span className="text-xs text-muted-foreground">{helper}</span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
