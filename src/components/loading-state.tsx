import type { ReactNode } from "react";
import { AlertTriangle, ClipboardList, LoaderCircle } from "lucide-react";

type LoadingStateProps = {
  state?: "loading" | "error" | "empty";
  title?: string;
  description?: string;
  action?: ReactNode;
  headingLevel?: 1 | 2;
};

/** Reusable feedback surface for asynchronous routes and empty collections. */
export function LoadingState({
  state = "loading",
  title,
  description,
  action,
  headingLevel = 1,
}: LoadingStateProps) {
  const copy = stateCopy[state];
  const Icon = state === "loading" ? LoaderCircle : state === "error" ? AlertTriangle : ClipboardList;
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section
      aria-busy={state === "loading" || undefined}
      aria-live="polite"
      className={s.container}
      role={state === "error" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        className={`${s.icon} ${state === "loading" ? s.loadingIcon : s.feedbackIcon}`}
      />
      <Heading className={s.title}>{title ?? copy.title}</Heading>
      <p className={s.description}>{description ?? copy.description}</p>
      {action ? <div className={s.action}>{action}</div> : null}
    </section>
  );
}

const stateCopy = {
  loading: {
    title: "Cargando inspecciones",
    description: "Estamos preparando la información registrada.",
  },
  error: {
    title: "No fue posible cargar la información",
    description: "Intenta de nuevo en unos momentos.",
  },
  empty: {
    title: "No hay inspecciones para mostrar",
    description: "Cuando se registren inspecciones aparecerán en este espacio.",
  },
} as const;

const s = {
  container: "mx-auto max-w-xl rounded-lg border border-dashed bg-card px-6 py-10 text-center shadow-sm",
  icon: "mx-auto size-8",
  loadingIcon: "animate-spin text-primary motion-reduce:animate-none",
  feedbackIcon: "text-muted-foreground",
  title: "mt-4 text-xl font-semibold tracking-tight text-foreground",
  description: "mt-2 text-sm leading-6 text-muted-foreground",
  action: "mt-5",
};
