export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className={s.page}>
      <section className={s.message}>
        <h1 className={s.title}>Sin conexión</h1>
        <p className={s.description}>No podemos abrir esta página ahora. Vuelve a intentarlo cuando recuperes la conexión.</p>
      </section>
    </main>
  );
}

const s = {
  page: "flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground",
  message: "max-w-md text-center",
  title: "text-2xl font-semibold",
  description: "mt-3 text-sm text-muted-foreground"
};
