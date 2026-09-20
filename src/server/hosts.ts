/**
 * Which `Host` header values the server answers to (TECH-SPEC 9, T15).
 *
 * The server listens on the local network without a password, so a web page on the internet
 * must not be able to talk to it through the visitor's browser (DNS rebinding: the page's own
 * name is pointed at the visitor's PC). Such a page always reaches the server under a name with
 * dots that we do not know, so only the following names are accepted:
 *   - a single-label name: `localhost`, or the PC's name (no dots)
 *   - an IPv4 address in a loopback or private range
 *   - `[::1]`
 *   - names added by the user (for example `nas.local` for a server in the home network)
 */

const SINGLE_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEADER_CHARS = /^[A-Za-z0-9.\-:[\]]+$/;

function isLocalIpv4(host: string): boolean {
  const match = IPV4.exec(host);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a, b] = octets as [number, number, number, number];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Splits `name:port` / `[::1]:port` into the lower-case name and rejects a bad port. */
function hostnameOf(header: string): string | null {
  if (!HEADER_CHARS.test(header)) return null;
  let name = header;
  let port: string | undefined;
  if (header.startsWith('[')) {
    const end = header.indexOf(']');
    if (end < 0) return null;
    name = header.slice(0, end + 1);
    const rest = header.slice(end + 1);
    if (rest !== '') {
      if (!rest.startsWith(':')) return null;
      port = rest.slice(1);
    }
  } else {
    const colon = header.lastIndexOf(':');
    if (colon >= 0) {
      name = header.slice(0, colon);
      port = header.slice(colon + 1);
    }
  }
  if (port !== undefined && !(/^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) return null;
  return name.toLowerCase();
}

/** True if a request with this `Host` header may be answered. */
export function isAllowedHost(header: string | undefined, extraHosts: readonly string[] = []): boolean {
  if (header === undefined || header === '') return false;
  const name = hostnameOf(header);
  if (name === null || name === '') return false;
  if (extraHosts.includes(name)) return true;
  if (name === '[::1]') return true;
  if (isLocalIpv4(name)) return true;
  // A name made only of digits could be read as an IP address by some programs.
  return SINGLE_LABEL.test(name) && !/^\d+$/.test(name);
}

/**
 * Cleans a host name that the user wants to allow (`--allow-host`): lower case, without a port.
 * Throws an Error with a readable message if it does not look like a host name.
 */
export function normalizeAllowedHost(raw: string): string {
  const name = raw.trim().toLowerCase().replace(/:\d{1,5}$/, '');
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(name) || name.includes('..')) {
    throw new Error(`"${raw}" is not a valid host name.`);
  }
  return name;
}
