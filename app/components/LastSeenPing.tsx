"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { touchLastSeenAction } from "@/app/actions/user";

const STORAGE_KEY = "syllab:lastSeenPingAt";
const MIN_INTERVAL_MS = 5 * 60 * 1000;

export default function LastSeenPing() {
  const pathname = usePathname();

  useEffect(() => {
    const now = Date.now();
    const last = Number(localStorage.getItem(STORAGE_KEY) ?? "0");
    if (Number.isFinite(last) && now - last < MIN_INTERVAL_MS) return;

    localStorage.setItem(STORAGE_KEY, String(now));
    void touchLastSeenAction();
  }, [pathname]);

  return null;
}
