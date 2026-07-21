import { useEffect, useSyncExternalStore } from "react";
import {
  getProfileSnapshot,
  loadProfile,
  subscribeProfileStore,
  resolveDisplayName,
  firstNameOf,
  type PreferredMode,
} from "@/lib/profile-store";

export function useProfile(options?: { force?: boolean }) {
  const snap = useSyncExternalStore(subscribeProfileStore, getProfileSnapshot, getProfileSnapshot);

  useEffect(() => {
    void loadProfile({ force: options?.force });
  }, [options?.force]);

  const displayName = resolveDisplayName(snap.profile, snap.metaFullName);
  const firstName = firstNameOf(displayName);
  const preferredMode: PreferredMode =
    snap.profile?.preferred_mode === "client" ? "client" : "worker";

  return {
    ...snap,
    displayName,
    firstName,
    preferredMode,
    /** True only while loading and we have never shown profile data yet */
    isInitialLoading: snap.loadingProfile && !snap.profileLoadedOnce,
  };
}
