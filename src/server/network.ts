import os from 'node:os';

const PRIVATE = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/**
 * The addresses under which other devices on the same network (a phone) can reach the server:
 * this PC's private IPv4 addresses.
 */
export function lanUrls(
  port: number,
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(),
): string[] {
  const urls: string[] = [];
  for (const addresses of Object.values(interfaces)) {
    for (const info of addresses ?? []) {
      if (info.family === 'IPv4' && !info.internal && PRIVATE.test(info.address)) {
        urls.push(`http://${info.address}:${port}`);
      }
    }
  }
  return [...new Set(urls)];
}
