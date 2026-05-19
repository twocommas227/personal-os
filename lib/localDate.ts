// Always use the user's local clock — never the server's UTC date.
// This prevents habits from resetting at the wrong time for Bangkok (UTC+7).
export function localDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
