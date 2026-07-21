export function formatShortFio(value: string | null | undefined) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length < 2) return value?.trim() ?? "";
  return `${parts[0]} ${parts.slice(1, 3).map((part) => `${part[0]}.`).join("")}`;
}
