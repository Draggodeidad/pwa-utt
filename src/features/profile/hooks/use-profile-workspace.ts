"use client";

import { useEffect, useState } from "react";
import { getConnectivityState } from "@/lib/pwa/connectivity";
import type { ProfileScreenState, ProfileSignOutState, ProfileView } from "../types";

/** Client-side profile state while the persistent session store is not implemented. */
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
      await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
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
