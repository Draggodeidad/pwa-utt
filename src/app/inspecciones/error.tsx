"use client";

import Link from "next/link";
import { LoadingState } from "@/components/loading-state";

export default function ErrorPage() {
  return <LoadingState state="error" action={<Link className={s.retryLink} href="/inspecciones">Volver a intentar</Link>} />;
}

const s = {
  retryLink: "inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
};
