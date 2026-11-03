"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useI18n } from "./I18nProvider";
import { IconUser } from "./NavIcons";

export function AccountChip() {
  const { t } = useI18n();
  const { ready, profile, signOutLocal } = useAuth();
  const [open, setOpen] = useState(false);

  if (!ready) return null;

  if (!profile) {
    return (
      <Link
        href="/login"
        className="nav-chip account-chip account-chip-icon"
        aria-label={t("auth.loginTitle")}
        title={t("auth.loginTitle")}
      >
        <IconUser />
      </Link>
    );
  }

  const name = profile.display_name?.trim() || profile.username || t("auth.account");

  return (
    <div className="locale-picker">
      <button
        type="button"
        className="nav-chip account-chip account-chip-icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={name}
        aria-label={name}
        onClick={() => setOpen(true)}
      >
        <IconUser />
      </button>
      {open ? (
        <div className="sheet-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={name}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="sheet-title">{name}</h2>
            <p className="sheet-note">
              {profile.role === "parent" ? t("auth.roleParent") : t("auth.roleStudent")}
              {profile.username ? ` · @${profile.username}` : ""}
            </p>
            {profile.role === "parent" ? (
              <Link
                href="/family"
                className="sheet-cta"
                style={{
                  textAlign: "center",
                  textDecoration: "none",
                  display: "grid",
                  placeItems: "center",
                }}
                onClick={() => setOpen(false)}
              >
                {t("family.openFamily")}
              </Link>
            ) : null}
            <Link
              href="/settings"
              className={profile.role === "parent" ? "auth-guest-btn" : "sheet-cta"}
              style={{
                textAlign: "center",
                textDecoration: "none",
                display: "grid",
                placeItems: "center",
              }}
              onClick={() => setOpen(false)}
            >
              {t("common.settings")}
            </Link>
            <button
              type="button"
              className="sheet-dismiss"
              onClick={() => {
                setOpen(false);
                void signOutLocal();
              }}
            >
              {t("auth.logout")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
