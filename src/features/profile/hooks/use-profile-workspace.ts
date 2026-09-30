"use client";

import { useCallback, useEffect, useState } from "react";
import { getConnectivityState } from "@/lib/pwa/connectivity";
import { blockLocalSession, completeRemoteLogout, sessionEpoch } from "@/lib/pwa/offline-session";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { pauseBrowserQueue } from "@/lib/pwa/sync/browser-runner";
import type { ProfileScreenState, ProfileSignOutState, ProfileView } from "../types";

/** Profile view and online sign-out state. The server owns the auth session. */
export function useProfileWorkspace(
  profile: ProfileView | undefined,
  onSignedOut: () => void,
) {
  const [screenState, setScreenState] = useState<ProfileScreenState>(() => {
    if (!profile) return "error";
    return getConnectivityState() === "offline" ? "offline" : "ready";
  });
  const [signOutState, setSignOutState] = useState<ProfileSignOutState>("idle");

  const updateConnectivity = useCallback(() => {
    if (!profile) {
      setScreenState("error");
      return;
    }
    setScreenState(getConnectivityState() === "offline" ? "offline" : "ready");
  }, [profile]);

  useEffect(() => {
    updateConnectivity();
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, [updateConnectivity]);

  const retryLoading = () => {
    updateConnectivity();
  };

  const signOut = async () => {
    if (signOutState === "signing-out") return;

    setSignOutState("signing-out");
    const owner = blockLocalSession();
    pauseBrowserQueue();
    const epoch = sessionEpoch();
    if (owner) void LocalStorage.revokeLease(owner, epoch).catch(() => { /* old epoch still prevents ACK */ });
    onSignedOut();
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status !== 204) throw new Error("No fue posible cerrar sesión");
      completeRemoteLogout(epoch);
    } catch {
      // The durable local gate stays closed; the next online event retries.
    }
  };

  return {
    screenState,
    signOutState,
    retryLoading,
    signOut,
  };
}
