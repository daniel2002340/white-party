// Dutch date/time formatting, centralized so every surface reads the same.

const longDate = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeOfDay = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
});

/** e.g. "zaterdag 14 maart 2026" */
export function formatLongDate(date: Date): string {
  return longDate.format(date);
}

/** e.g. "14 mrt. 2026" — for compact admin lists */
export function formatShortDate(date: Date): string {
  return shortDate.format(date);
}

/** e.g. "20:00" */
export function formatTime(date: Date): string {
  return timeOfDay.format(date);
}

/**
 * Long date, with the time appended when it isn't midnight.
 * e.g. "zaterdag 14 maart 2026 om 20:00"
 */
export function formatLongDateTime(date: Date): string {
  const base = longDate.format(date);
  if (date.getHours() === 0 && date.getMinutes() === 0) return base;
  return `${base} om ${timeOfDay.format(date)}`;
}

/** e.g. "14 mrt. 2026 om 20:00" — compact date + time, for comment timestamps. */
export function formatShortDateTime(date: Date): string {
  return `${shortDate.format(date)} om ${timeOfDay.format(date)}`;
}

/** Format a Date as a value for <input type="datetime-local"> in local time. */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
