const PALETTE = [
  { bg: "#eef2ff", text: "#4f46e5" },
  { bg: "#ecfdf5", text: "#059669" },
  { bg: "#fffbeb", text: "#d97706" },
  { bg: "#fef2f2", text: "#dc2626" },
  { bg: "#f0f9ff", text: "#0284c7" },
  { bg: "#fdf4ff", text: "#c026d3" },
] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function avatarColor(seed: string) {
  return PALETTE[hashString(seed) % PALETTE.length];
}
