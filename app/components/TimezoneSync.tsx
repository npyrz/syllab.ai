"use client";

import { useEffect } from "react";

import { updateUserTimezoneAction } from "@/app/actions/user";

const STORAGE_KEY = "syllab:timezone";

export default function TimezoneSync() {
  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!resolved) return;

    const last = localStorage.getItem(STORAGE_KEY);
    if (last === resolved) return;

    localStorage.setItem(STORAGE_KEY, resolved);
    void updateUserTimezoneAction(resolved);
  }, []);

  return null;
}
