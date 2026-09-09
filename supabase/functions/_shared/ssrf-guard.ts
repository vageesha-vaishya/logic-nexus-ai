// _shared/ssrf-guard.ts
//
// Blocks connecting to loopback, link-local (including the cloud metadata
// address 169.254.169.254), RFC1918 private, and unique-local IPv6
// addresses. For admin tools that accept an operator-supplied host and open
// an outbound connection to it (execute-sql-external, push-migrations-to-
// target) -- these are meant to reach a tenant's own external database,
// never this platform's own internal network. A compromised or malicious
// platform_admin session holding one of these tools is otherwise a
// ready-made SSRF / lateral-movement primitive into the VPS's internal
// Docker network and any other co-located service.
//
// This is deliberately narrow: it blocks known-internal address ranges, not
// an allowlist of "approved" external hosts -- the whole point of these
// tools is reaching arbitrary genuine external databases.

declare const Deno: any;

function isBlockedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = parseInt(v4[1], 10);
    const b = parseInt(v4[2], 10);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 0) return true; // "this network"
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 -- recurse on the embedded v4 address
    return isBlockedIp(lower.replace("::ffff:", ""));
  }
  return false;
}

/**
 * Throws if `hostname` is, or resolves to, a loopback/link-local/private
 * address. Resolution failures are NOT treated as blocked -- they're left
 * for the actual connection attempt to surface as a real, specific error.
 */
export async function assertExternalHostAllowed(hostname: string): Promise<void> {
  const host = hostname.trim().toLowerCase();
  if (!host) {
    throw new Error("Target host is required");
  }
  if (host === "localhost" || host === "0.0.0.0") {
    throw new Error(
      `Refusing to connect to "${hostname}": this tool is for external databases only, not the platform's own infrastructure.`,
    );
  }

  const isLiteralIp = /^[\d.]+$/.test(host) || host.includes(":");
  const ips: string[] = [];

  if (isLiteralIp) {
    ips.push(host);
  } else {
    try {
      const [a, aaaa] = await Promise.all([
        Deno.resolveDns(host, "A").catch(() => [] as string[]),
        Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
      ]);
      ips.push(...a, ...aaaa);
    } catch {
      // DNS lookup itself failed outright -- don't block here, the connect
      // attempt will report the real (e.g. "hostname not found") error.
      return;
    }
  }

  for (const ip of ips) {
    if (isBlockedIp(ip)) {
      throw new Error(
        `Refusing to connect to "${hostname}" (resolves to ${ip}, an internal/private address). This tool is for external databases only.`,
      );
    }
  }
}
