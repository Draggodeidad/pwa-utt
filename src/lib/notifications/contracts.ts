import type { CapabilityResult } from "../device/contracts.ts";

export type NotificationPermissionState = "default" | "granted" | "denied";
export type ConfirmedNotificationEvent = {
  /** Stable identity of the confirmed event, reused after retries. */
  id: string;
  kind: "sync-completed";
  title: string;
  body: string;
};

/** Internal envelope; consumers must recheck both account and session epoch. */
export type SyncCompletedNotificationDetail = {
  owner: string;
  epoch: string;
  event: ConfirmedNotificationEvent;
};
export const SYNC_COMPLETED_EVENT = "pwa-utt:sync-completed";

export interface NotificationApi {
  permission(): NotificationPermissionState;
  requestPermission(): Promise<NotificationPermissionState>;
  /** May wrap serviceWorkerRegistration.showNotification or local Notification. */
  show(event: ConfirmedNotificationEvent): Promise<void>;
}

export interface NotificationDependencies {
  isSecureContext: () => boolean;
  api: NotificationApi | null;
  now: () => number;
  /** Accessible feedback; no capability failure may block save/sync. */
  presentFallback: (event: ConfirmedNotificationEvent) => void;
}

export interface NotificationsClient {
  /** Call only from an explicit user action, never while importing/mounting. */
  requestPermission(): Promise<CapabilityResult<NotificationPermissionState, "in-app">>;
  /** Default/denied/unsupported/error use in-app feedback without prompting. */
  showConfirmed(event: ConfirmedNotificationEvent): Promise<CapabilityResult<{
    eventId: string;
    delivery: "shown" | "already-shown";
  }, "in-app">>;
}
