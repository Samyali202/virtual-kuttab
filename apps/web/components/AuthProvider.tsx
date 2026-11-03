"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { fetchMyProfile, type ProfileRow } from "../lib/auth-api";
import { supabase } from "../lib/supabase";

type AuthCtx = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  refreshProfile: () => Promise<void>;
  signOutLocal: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const refreshProfile = useCallback(async () => {
    const p = await fetchMyProfile();
    setProfile(p);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      if (data.session) {
        const p = await fetchMyProfile();
        if (p?.disabled) {
          await supabase.auth.signOut();
          if (!cancelled) {
            setSession(null);
            setProfile(null);
          }
        } else if (!cancelled) {
          setProfile(p);
        }
      }
      if (!cancelled) setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (next) {
        void (async () => {
          // Fresh sign-in: merge guest localStorage into cloud (Home also merges on load).
          if (event === "SIGNED_IN") {
            try {
              const { mergeGuestProgressOnAuth } = await import(
                "../lib/sync-progress"
              );
              await mergeGuestProgressOnAuth();
            } catch {
              /* guest merge best-effort */
            }
          }
          const p = await fetchMyProfile();
          if (p?.disabled) {
            await supabase.auth.signOut();
            if (!cancelled) {
              setSession(null);
              setProfile(null);
            }
            return;
          }
          if (!cancelled) setProfile(p);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOutLocal = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile,
      signOutLocal,
    }),
    [ready, session, profile, refreshProfile, signOutLocal],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
