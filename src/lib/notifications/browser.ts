import type { NotificationApi } from "./contracts.ts";

/** Resolve globals only inside an explicit client action/effect. */
export function createBrowserNotificationApi(isCurrent: () => boolean): NotificationApi | null {
  if (typeof Notification === "undefined") return null;
  const NativeNotification = Notification;
  return {
    permission: () => NativeNotification.permission,
    requestPermission: () => NativeNotification.requestPermission(),
    async show(event) {
      if (!isCurrent()) throw new Error("Notification session expired");
      const registration = "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration("/") : undefined;
      if (!isCurrent()) throw new Error("Notification session expired");
      if (registration?.active && typeof registration.showNotification === "function") {
        await registration.showNotification(event.title, {
          body: event.body, tag: event.id, icon: "/icons/icon.svg",
        });
        return;
      }
      // Mobile browsers can reject the constructor; the caller supplies in-app feedback.
      await new Promise<void>((resolve, reject) => {
        const notification = new NativeNotification(event.title, { body: event.body, tag: event.id, icon: "/icons/icon.svg" });
        const finish = (error?: Error) => {
          clearTimeout(timer);
          notification.onshow = null;
          notification.onerror = null;
          if (error) reject(error); else resolve();
        };
        const timer = setTimeout(() => finish(new Error("Notification presentation unconfirmed")), 5000);
        notification.onshow = () => finish();
        notification.onerror = () => finish(new Error("Notification presentation failed"));
      });
    },
  };
}
