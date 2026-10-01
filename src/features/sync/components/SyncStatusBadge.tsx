"use client";

import { CheckCircle2, CircleAlert, Clock, HardDrive, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SyncStatus } from "@/types/entity";

export type SyncStatusBadgeProps = {
  status: SyncStatus;
  pendingCount?: number;
  errorCount?: number;
};

export function SyncStatusBadge({ status, pendingCount, errorCount }: SyncStatusBadgeProps) {
  let label = "Sincronizado";
  let badgeStyle = s.synced;
  let Icon = CheckCircle2;

  switch (status) {
    case "syncing":
      label = "Sincronizando";
      badgeStyle = s.syncing;
      Icon = RefreshCw;
      break;
    case "error":
      label = errorCount ? `Error (${errorCount})` : "Error";
      badgeStyle = s.error;
      Icon = CircleAlert;
      break;
    case "pending":
      label = pendingCount ? `Pendiente (${pendingCount})` : "Pendiente";
      badgeStyle = s.pending;
      Icon = Clock;
      break;
    case "local":
      label = "Guardado local";
      badgeStyle = s.local;
      Icon = HardDrive;
      break;
    case "synced":
    default:
      label = "Sincronizado";
      badgeStyle = s.synced;
      Icon = CheckCircle2;
      break;
  }

  return (
    <Badge className={badgeStyle}>
      <Icon className={status === "syncing" ? s.spinningIcon : s.icon} aria-hidden="true" />
      <span>{label}</span>
    </Badge>
  );
}

const s = {
  synced: "gap-1 rounded-sm border-0 bg-[#cfe4db] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-[#53675f]",
  pending: "gap-1 rounded-sm border-0 bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-secondary-foreground",
  syncing: "gap-1 rounded-sm border-0 bg-[#cfe4db] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-[#53675f]",
  local: "gap-1 rounded-sm border-0 bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-muted-foreground",
  error: "gap-1 rounded-sm border-0 bg-destructive px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-destructive-foreground",
  icon: "size-3 shrink-0",
  spinningIcon: "size-3 shrink-0 animate-spin",
};
