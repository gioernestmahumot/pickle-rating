import "server-only";
import { headers } from "next/headers";

/** Absolute site origin, for QR codes and auth email links. */
export async function getSiteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only same-site paths are allowed as a post-login destination. */
export function safeNextPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}

/** Optional public contact link (for example a Facebook page), set with NEXT_PUBLIC_CONTACT_URL. */
export function getContactUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_CONTACT_URL?.trim();
  return value && /^https:\/\/[^\s"<>]+$/.test(value) ? value : null;
}
