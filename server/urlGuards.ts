import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { TRPCError } from "@trpc/server";

/**
 * Check if an IP address is private/internal. Handles both IPv4 and IPv6,
 * including IPv6-mapped IPv4 addresses.
 */
export function isPrivateIP(address: string): boolean {
  const normalizedAddress = address.toLowerCase();

  const ipv4Match = normalizedAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  let checkAddress = normalizedAddress;

  if (ipv4Match) {
    checkAddress = ipv4Match[1];
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(checkAddress)) {
    const parts = checkAddress.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    if (parts[0] >= 224 && parts[0] <= 239) return true;
    if (parts[0] >= 240) return true;

    return false;
  }

  if (normalizedAddress === "::1") return true;
  if (normalizedAddress === "::") return true;
  if (normalizedAddress.startsWith("fc")) return true;
  if (normalizedAddress.startsWith("fd")) return true;
  if (normalizedAddress.startsWith("fe80")) return true;
  if (normalizedAddress.startsWith("::ffff:")) return true;
  if (normalizedAddress === "64:ff9b::" || normalizedAddress.startsWith("64:ff9b:1::")) return true;
  if (normalizedAddress.startsWith("2001:db8:")) return true;
  if (normalizedAddress.startsWith("2001:")) return true;

  return normalizedAddress.includes(":");
}

const ALLOWED_URL_SCHEMES = new Set(["http:", "https:"]);
const ALLOWED_URL_PORTS = new Set(["", "80", "443", "8080", "8443"]);

/**
 * SSRF prevention: block requests to private/internal IP ranges, restrict
 * scheme to http(s), and restrict port to conventional HTTP ports.
 */
export async function assertSafeUrl(urlString: string) {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid provider endpoint URL: ${urlString}` });
  }

  if (!ALLOWED_URL_SCHEMES.has(url.protocol)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Provider endpoint scheme ${url.protocol} is not allowed — use http(s) only.`,
    });
  }

  if (!ALLOWED_URL_PORTS.has(url.port)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Provider endpoint port ${url.port} is not allowed — use a conventional HTTP port.`,
    });
  }

  if (url.username || url.password) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Provider endpoint URL must not contain embedded credentials.",
    });
  }

  const hostname = url.hostname.toLowerCase();

  const blockedHosts = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.azure.com",
    "metadata.google.com",
    "instance-data",
    "instance-data.latest",
  ];

  for (const blocked of blockedHosts) {
    if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Provider endpoint is not allowed: ${hostname}` });
    }
  }

  if (
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".lan") ||
    hostname.includes("metadata") ||
    hostname.includes("instance-data")
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Provider endpoint uses blocked hostname pattern: ${hostname}`,
    });
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) {
    if (isPrivateIP(hostname)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Private/internal IP address not allowed: ${hostname}`,
      });
    }
  }

  let addresses: LookupAddress[];
  try {
    addresses = await lookup(hostname, { all: true, family: 0 });
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Could not resolve provider hostname: ${hostname}`,
      cause: error,
    });
  }

  for (const { address } of addresses) {
    if (isPrivateIP(address)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Private/internal IP address not allowed: ${address}`,
      });
    }
  }
}
