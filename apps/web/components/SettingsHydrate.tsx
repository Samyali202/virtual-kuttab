"use client";

import { useEffect } from "react";
import { applySettingsToDom, loadSettings } from "../lib/settings";

/** Applies saved theme / ayah size on every page. */
export function SettingsHydrate() {
  useEffect(() => {
    applySettingsToDom(loadSettings());
  }, []);
  return null;
}
