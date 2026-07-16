"use client";

import { useState } from "react";

type TimezoneInputProps = {
  name?: string;
};

export default function TimezoneInput({ name = "timezone" }: TimezoneInputProps) {
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "");

  return <input type="hidden" name={name} value={timezone} />;
}
