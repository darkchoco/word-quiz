import { spawn } from 'node:child_process';

/** The command that opens a URL in the default browser. */
export function browserCommand(url: string, platform: NodeJS.Platform): { command: string; args: string[] } {
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '', url] };
  if (platform === 'darwin') return { command: 'open', args: [url] };
  return { command: 'xdg-open', args: [url] };
}

/** Opens the URL in the default browser. Never throws: the server works without it. */
export function openBrowser(
  url: string,
  platform: NodeJS.Platform = process.platform,
  spawnFn: typeof spawn = spawn,
): void {
  const { command, args } = browserCommand(url, platform);
  try {
    const child = spawnFn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {
      // no browser available; the address is printed on the console anyway
    });
    child.unref();
  } catch {
    // ignore
  }
}
