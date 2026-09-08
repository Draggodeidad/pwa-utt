export type ConnectivityState = "online" | "offline" | "unstable";

/** Browser-facing boundary used by client hooks, never imported directly by feature UI. */
export function getConnectivityState(): ConnectivityState {
  if (typeof navigator === "undefined") return "online";
  return navigator.onLine ? "online" : "offline";
}
