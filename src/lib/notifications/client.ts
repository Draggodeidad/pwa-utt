import type { CapabilityResult } from "../device/contracts.ts";
import type { ConfirmedNotificationEvent, NotificationDependencies, NotificationPermissionState, NotificationsClient } from "./contracts.ts";

type Delivery = CapabilityResult<{ eventId: string; delivery: "shown" | "already-shown" }, "in-app">;
type Failure = Exclude<CapabilityResult<NotificationPermissionState, "in-app">, { status: "success" }>;

export function createNotificationsClient(dependencies: NotificationDependencies): NotificationsClient {
  const handled = new Map<string, number>();
  const pending = new Map<string, Promise<Delivery>>();
  const failure = (status: Failure["status"], code: Failure["code"]): Failure => ({ status, code, fallback: "in-app" });
  function availability(): Failure | null {
    if (!dependencies.isSecureContext()) return failure("unsupported", "insecure-context");
    if (!dependencies.api) return failure("unsupported", "api-unavailable");
    return null;
  }
  function permissionFailure(permission: NotificationPermissionState): Failure | null {
    return permission === "denied" ? failure("denied", "permission-denied")
      : permission === "default" ? failure("error", "permission-default") : null;
  }
  const repeated = (eventId: string): Delivery => ({ status: "success", value: { eventId, delivery: "already-shown" } });
  async function present(event: ConfirmedNotificationEvent): Promise<Delivery> {
    let result: Delivery;
    try {
      const blocked = availability() ?? permissionFailure(dependencies.api!.permission());
      if (blocked) result = blocked;
      else {
        await dependencies.api!.show(event);
        result = { status: "success", value: { eventId: event.id, delivery: "shown" } };
      }
    } catch { result = failure("error", "notification-failed"); }
    if (result.status !== "success") {
      try { dependencies.presentFallback(event); } catch { /* Feedback cannot interrupt synchronization. */ }
    }
    return result;
  }
  return {
    async requestPermission() {
      try {
        const blocked = availability();
        if (blocked) return blocked;
        const current = dependencies.api!.permission();
        const permission = current === "default" ? await dependencies.api!.requestPermission() : current;
        return permissionFailure(permission) ?? { status: "success", value: permission };
      } catch { return failure("error", "notification-failed"); }
    },
    async showConfirmed(event) {
      if (handled.has(event.id)) return repeated(event.id);
      const concurrent = pending.get(event.id);
      if (concurrent) { await concurrent; return repeated(event.id); }
      // Defer delivery until the identity has been reserved, including reentrant calls.
      const delivery = Promise.resolve().then(() => present(event));
      pending.set(event.id, delivery);
      try { return await delivery; }
      finally {
        let at = 0;
        try { at = dependencies.now(); } catch { /* Identity still remains consumed. */ }
        handled.set(event.id, at);
        pending.delete(event.id);
      }
    },
  };
}
