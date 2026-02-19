"use client";

import { useEffect, useState } from "react";

type TimezoneInputProps = {
  name?: string;
};

export default function TimezoneInput({ name = "timezone" }: TimezoneInputProps) {
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) setTimezone(resolved);
  }, []);

  return <input type="hidden" name={name} value={timezone} />;
}
