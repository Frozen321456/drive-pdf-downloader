import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function naturalSortKey(s: string): (string | number)[] {
  return s.split(/(\d+)/).map((t) => (t.match(/^\d+$/) ? parseInt(t, 10) : t.toLowerCase()));
}

export function extractDriveIds(html: string): string[] {
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{25,})/g,
    /id=([a-zA-Z0-9_-]{25,})/g,
  ];
  const found = new Set<string>();
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      found.add(m[1]);
    }
  }
  return Array.from(found);
}

export function isValidUrl(str: string): boolean {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function deriveNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    const last = path.split("/").pop() || "document";
    return decodeURIComponent(last).replace(/[-_]/g, " ").slice(0, 60);
  } catch {
    return "document";
  }
}
