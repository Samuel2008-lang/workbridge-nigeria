/**
 * Module-level profile cache so Profile / Home / Settings share the same data
 * across navigations without re-showing a full-page loading state.
 */
import { supabase } from "@/integrations/supabase/client";

export type PreferredMode = "worker" | "client";

export type UserProfile = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  location: string | null;
  language: string | null;
  role: string | null;
  job_interests: string[] | null;
  preferred_mode: PreferredMode | null;
  profile_photo: string | null;
};

export type UserSettings = {
  user_id: string;
  push_notifications: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  show_distance: boolean;
  dark_mode: boolean;
};

type Listener = () => void;

let profile: UserProfile | null = null;
let settings: UserSettings | null = null;
let email: string | null = null;
let authUserId: string | null = null;
let metaFullName: string | null = null;
let loadingProfile = false;
let profileLoadedOnce = false;
let listeners = new Set<Listener>();

const DEFAULT_SETTINGS = (userId: string): UserSettings => ({
  user_id: userId,
  push_notifications: true,
  email_notifications: true,
  sms_notifications: false,
  show_distance: true,
  dark_mode: false,
});

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeProfileStore(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getProfileSnapshot() {
  return {
    profile,
    settings,
    email,
    authUserId,
    metaFullName,
    loadingProfile,
    profileLoadedOnce,
  };
}

/** Resolve display name: profiles.full_name → auth metadata → null */
export function resolveDisplayName(
  p: UserProfile | null,
  metadataName: string | null | undefined,
): string | null {
  const fromProfile = p?.full_name?.trim();
  if (fromProfile) return fromProfile;
  const fromMeta = metadataName?.trim();
  if (fromMeta) return fromMeta;
  return null;
}

export function firstNameOf(full: string | null | undefined): string | null {
  if (!full?.trim()) return null;
  return full.trim().split(/\s+/)[0] ?? null;
}

export async function loadProfile(opts?: { force?: boolean }) {
  if (loadingProfile) return getProfileSnapshot();
  if (profileLoadedOnce && profile && !opts?.force) {
    // Silent background refresh
    void refreshProfileInBackground();
    return getProfileSnapshot();
  }

  loadingProfile = true;
  emit();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      profile = null;
      settings = null;
      email = null;
      authUserId = null;
      metaFullName = null;
      profileLoadedOnce = true;
      return getProfileSnapshot();
    }

    authUserId = user.id;
    email = user.email ?? null;
    metaFullName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.first_name as string | undefined) ??
      null;

    // Prefer extended columns; fall back if migration not applied yet
    let p: UserProfile | null = null;
    {
      const extended = await supabase
        .from("profiles")
        .select(
          "id, full_name, phone_number, location, language, role, job_interests, preferred_mode, profile_photo",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (extended.error) {
        console.warn("[profile-store] extended profile select failed, falling back", extended.error);
        const basic = await supabase
          .from("profiles")
          .select("id, full_name, phone_number, location, language, role, profile_photo")
          .eq("id", user.id)
          .maybeSingle();
        if (basic.error) console.error("[profile-store] load profile", basic.error);
        p = basic.data
          ? ({
              ...basic.data,
              job_interests: null,
              preferred_mode: "worker",
            } as UserProfile)
          : null;
      } else {
        p = extended.data as UserProfile | null;
      }
    }

    profile = p ?? {
      id: user.id,
      full_name: null,
      phone_number: null,
      location: null,
      language: null,
      role: null,
      job_interests: null,
      preferred_mode: "worker",
      profile_photo: null,
    };

    const { data: s, error: sErr } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (sErr) {
      // Table may not exist until migration is applied
      console.warn("[profile-store] load settings", sErr);
    }

    settings = (s as UserSettings | null) ?? DEFAULT_SETTINGS(user.id);
    profileLoadedOnce = true;
  } finally {
    loadingProfile = false;
    emit();
  }

  return getProfileSnapshot();
}

async function refreshProfileInBackground() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    authUserId = user.id;
    email = user.email ?? null;
    metaFullName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.first_name as string | undefined) ??
      null;

    const extended = await supabase
      .from("profiles")
      .select(
        "id, full_name, phone_number, location, language, role, job_interests, preferred_mode, profile_photo",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (!extended.error && extended.data) {
      profile = extended.data as UserProfile;
    } else {
      const basic = await supabase
        .from("profiles")
        .select("id, full_name, phone_number, location, language, role, profile_photo")
        .eq("id", user.id)
        .maybeSingle();
      if (basic.data) {
        profile = {
          ...(basic.data as UserProfile),
          job_interests: profile?.job_interests ?? null,
          preferred_mode: profile?.preferred_mode ?? "worker",
        };
      }
    }

    const { data: s } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (s) settings = s as UserSettings;
    emit();
  } catch (e) {
    console.error("[profile-store] background refresh", e);
  }
}

export async function saveProfile(
  updates: Partial<
    Pick<
      UserProfile,
      | "full_name"
      | "phone_number"
      | "location"
      | "language"
      | "job_interests"
      | "preferred_mode"
    >
  >,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const payload = {
    id: user.id,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select(
      "id, full_name, phone_number, location, language, role, job_interests, preferred_mode, profile_photo",
    )
    .single();

  if (error) {
    console.error("[profile-store] saveProfile", error);
    return { ok: false, error: error.message };
  }

  // Keep Auth metadata in sync when full name changes
  if (updates.full_name !== undefined) {
    const { error: metaErr } = await supabase.auth.updateUser({
      data: {
        full_name: updates.full_name,
        first_name: firstNameOf(updates.full_name) ?? undefined,
      },
    });
    if (metaErr) {
      console.error("[profile-store] updateUser metadata", metaErr);
    } else {
      metaFullName = updates.full_name;
    }
  }

  profile = data as UserProfile;
  profileLoadedOnce = true;
  emit();
  return { ok: true };
}

export async function saveSettings(
  updates: Partial<Omit<UserSettings, "user_id">>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const next = {
    ...(settings ?? DEFAULT_SETTINGS(user.id)),
    ...updates,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(next, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    console.error("[profile-store] saveSettings", error);
    return { ok: false, error: error.message };
  }

  settings = data as UserSettings;
  emit();
  return { ok: true };
}

export async function setPreferredMode(mode: PreferredMode) {
  return saveProfile({ preferred_mode: mode });
}

export function clearProfileStore() {
  profile = null;
  settings = null;
  email = null;
  authUserId = null;
  metaFullName = null;
  loadingProfile = false;
  profileLoadedOnce = false;
  emit();
}
