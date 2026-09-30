"use client";

import { useEffect, useState } from "react";
import { getConnectivityState } from "@/lib/pwa/connectivity";
import type { ProfileScreenState, ProfileSignOutState, ProfileView } from "../types";

/** Profile view and online sign-out state. The server owns the auth session. */
export function useProfileWorkspace(
  profile: ProfileView | undefined,
  onSignedOut: () => void,
) {
  const [screenState, setScreenState] = useState<ProfileScreenState>("loading");
  const [signOutState, setSignOutState] = useState<ProfileSignOutState>("idle");

  useEffect(() => {
    const updateConnectivity = () => {
      if (!profile) {
        setScreenState("error");
        return;
      }
      setScreenState(getConnectivityState() === "offline" ? "offline" : "ready");
    };
    const initialize = window.setTimeout(updateConnectivity, 300);

    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, [profile]);

  const retryLoading = () => {
    setScreenState("loading");
    window.setTimeout(() => {
      if (!profile) {
        setScreenState("error");
        return;
      }
      setScreenState(getConnectivityState() === "offline" ? "offline" : "ready");
    }, 250);
  };

  const signOut = async () => {
    if (signOutState === "signing-out") return;

    setSignOutState("signing-out");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status !== 204) throw new Error("No fue posible cerrar sesión");
      onSignedOut();
    } catch {
      setSignOutState("error");
    }
  };

  return {
    screenState,
    signOutState,
    retryLoading,
    signOut,
  };
}
