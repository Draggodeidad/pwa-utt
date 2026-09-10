"use client";

import { useRouter } from "next/navigation";
import {
  CircleAlert,
  Cloud,
  CloudOff,
  LogOut,
  Monitor,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProfileWorkspace } from "../hooks/use-profile-workspace";
import type { ProfileView } from "../types";

function ProfileSkeleton() {
  return (
    <div className={s.cards} aria-label="Cargando perfil">
      <Card className={s.profileSkeleton}><div className={s.avatarSkeleton} /><div className={s.skeletonStack}><div className={s.skeletonLineMedium} /><div className={s.skeletonLine} /><div className={s.skeletonLineShort} /></div></Card>
      <Card className={s.sessionSkeleton}><div className={s.skeletonLineShort} /><div className={s.skeletonLineMedium} /><div className={s.skeletonLine} /></Card>
    </div>
  );
}

export function ProfileWorkspace({ profile }: { profile: ProfileView | undefined }) {
  const router = useRouter();
  const { screenState, signOutState, retryLoading, signOut } = useProfileWorkspace(profile, () => router.push("/login"));
  const isOffline = screenState === "offline";
  const initials = profile?.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() ?? "";

  return (
    <section className={s.page} aria-labelledby="profile-title">
      <header className={s.header}>
        <p className={s.eyebrow}>Sistema de inspecciones TI <span aria-hidden="true">/</span> <strong>Cuenta</strong></p>
        <h1 id="profile-title" className={s.title}>Mi perfil</h1>
        <p className={s.subtitle}>Información de cuenta institucional y sesión activa.</p>
      </header>

      {screenState === "loading" ? <ProfileSkeleton /> : null}
      {screenState === "error" ? (
        <Card className={s.errorCard} role="alert">
          <CircleAlert className={s.errorIcon} aria-hidden="true" />
          <div><h2 className={s.errorTitle}>No fue posible cargar el perfil</h2><p className={s.errorDescription}>Intenta de nuevo para consultar la información de tu cuenta.</p></div>
          <Button className={s.retryLoadingButton} type="button" variant="outline" onClick={retryLoading}>Reintentar</Button>
        </Card>
      ) : null}
      {profile && (screenState === "ready" || screenState === "offline") ? (
        <div className={s.cards} aria-live="polite">
          <Card className={s.profileCard}>
            <div className={s.profileHeader}>
              <div className={s.avatar} aria-label={`Avatar de ${profile.displayName}`} role="img"><UserRound className={s.avatarIcon} aria-hidden="true" /><span className={s.avatarInitials}>{initials}</span><span className={s.activeIndicator} aria-label="Cuenta activa"><ShieldCheck className={s.activeIcon} aria-hidden="true" /></span></div>
              <div className={s.identity}>
                <p className={s.role}>Técnico de mantenimiento TI</p>
                <h2 className={s.name}>{profile.displayName}</h2>
                <p className={s.area}>{profile.campusArea}</p>
              </div>
            </div>
            <dl className={s.profileDetails}>
              <div className={s.detailRow}><dt className={s.detailLabel}>Correo electrónico institucional</dt><dd className={s.detailValue}>{profile.email}</dd></div>
              <div className={s.detailRow}><dt className={s.detailLabel}>Identificador institucional</dt><dd className={s.detailValueStrong}>#{profile.institutionalId}</dd></div>
              <div className={s.detailRow}><dt className={s.detailLabel}>Campus / área asignada</dt><dd className={s.detailValue}>{profile.campusArea}</dd></div>
            </dl>
          </Card>

          <Card className={s.sessionCard}>
            <div className={s.sessionHeader}>
              <h2 className={s.sessionTitle}><Monitor className={s.sessionTitleIcon} aria-hidden="true" />Sesión</h2>
              <Badge className={isOffline ? s.connectionOffline : s.connectionOnline}>{isOffline ? <CloudOff className={s.connectionIcon} aria-hidden="true" /> : <Cloud className={s.connectionIcon} aria-hidden="true" />}{isOffline ? "Sin conexión" : "En línea"}</Badge>
            </div>
            {profile.deviceName ? <div className={s.device}><p className={s.deviceLabel}>Dispositivo</p><p className={s.deviceName}>{profile.deviceName}</p></div> : null}
            {isOffline ? <p className={s.offlineNotice}><CloudOff className={s.noticeIcon} aria-hidden="true" />La información del perfil sigue disponible sin conexión.</p> : null}
            {signOutState === "error" ? <p className={s.signOutError} role="alert"><CircleAlert className={s.noticeIcon} aria-hidden="true" />No fue posible cerrar la sesión. Intenta de nuevo.</p> : null}
            <Button className={s.signOutButton} type="button" disabled={signOutState === "signing-out"} onClick={() => void signOut()}>
              <LogOut className={s.signOutIcon} aria-hidden="true" />
              {signOutState === "signing-out" ? "Cerrando sesión..." : "Cerrar sesión"}
            </Button>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

const s = {
  page: "mx-auto max-w-[1050px]",
  header: "space-y-1",
  eyebrow: "font-mono text-[11px] font-medium uppercase tracking-[.05em] text-secondary-foreground",
  title: "text-[32px] font-semibold tracking-tight",
  subtitle: "text-sm text-secondary-foreground",
  cards: "mt-8 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(20rem,5fr)]",
  profileSkeleton: "flex items-center gap-6 p-8",
  sessionSkeleton: "space-y-4 p-6",
  avatarSkeleton: "size-28 shrink-0 animate-pulse rounded-lg bg-secondary",
  skeletonStack: "flex-1 space-y-3",
  skeletonLineMedium: "h-7 w-2/3 animate-pulse rounded-sm bg-secondary",
  skeletonLine: "h-4 w-full animate-pulse rounded-sm bg-secondary",
  skeletonLineShort: "h-4 w-1/3 animate-pulse rounded-sm bg-secondary",
  errorCard: "mt-8 flex flex-col gap-3 p-6 sm:flex-row sm:items-center",
  errorIcon: "size-5 shrink-0 text-destructive",
  errorTitle: "font-semibold",
  errorDescription: "mt-1 text-sm text-secondary-foreground",
  retryLoadingButton: "sm:ml-auto",
  profileCard: "space-y-6 p-8",
  profileHeader: "flex flex-col gap-5 sm:flex-row sm:items-start",
  avatar: "relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary text-primary",
  avatarIcon: "size-12 opacity-20",
  avatarInitials: "absolute font-mono text-2xl font-semibold tracking-tight",
  activeIndicator: "absolute bottom-0 right-0 grid size-6 translate-x-1/4 translate-y-1/4 place-items-center rounded-full bg-[#4f625b] text-primary-foreground",
  activeIcon: "size-3.5",
  identity: "min-w-0",
  role: "font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-[#4f625b]",
  name: "mt-1 text-[26px] font-semibold tracking-tight",
  area: "mt-1 text-[13px] text-secondary-foreground",
  profileDetails: "space-y-2 border-t pt-4",
  detailRow: "flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4",
  detailLabel: "font-mono text-[11px] font-medium uppercase tracking-[.05em] text-secondary-foreground",
  detailValue: "text-sm font-medium text-foreground sm:text-right",
  detailValueStrong: "font-mono text-xs font-semibold text-foreground sm:text-right",
  sessionCard: "flex flex-col gap-4 p-6",
  sessionHeader: "flex items-center justify-between border-b pb-2",
  sessionTitle: "flex items-center gap-1 text-base font-semibold",
  sessionTitleIcon: "size-4",
  connectionOnline: "gap-1 rounded-sm border-0 bg-border px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-foreground",
  connectionOffline: "gap-1 rounded-sm border-0 bg-destructive/15 px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-destructive",
  connectionIcon: "size-3",
  device: "space-y-1",
  deviceLabel: "font-mono text-[11px] font-medium uppercase tracking-[.05em] text-secondary-foreground",
  deviceName: "text-sm font-medium",
  offlineNotice: "flex gap-2 rounded-sm bg-secondary p-3 text-sm text-secondary-foreground",
  noticeIcon: "mt-0.5 size-4 shrink-0",
  signOutError: "flex gap-2 rounded-sm bg-destructive/10 p-3 text-sm text-destructive",
  signOutButton: "mt-auto w-full rounded-sm",
  signOutIcon: "mr-2 size-4",
};
