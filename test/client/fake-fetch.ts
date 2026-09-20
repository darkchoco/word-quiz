import { vi } from 'vitest';

export interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

type Reply = { status?: number; body?: unknown; raw?: string } | Error;
type Handler = Reply | ((call: Call) => Reply);

/**
 * Replaces `fetch` with a fake that answers from a table of "METHOD /path" entries and records
 * every call. Anything that is not in the table fails loudly instead of returning something odd.
 */
export function fakeFetch(routes: Record<string, Handler | Handler[]>) {
  const calls: Call[] = [];
  const queues = new Map<string, Handler[]>();
  for (const [key, value] of Object.entries(routes)) queues.set(key, Array.isArray(value) ? [...value] : [value]);

  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const call: Call = {
      method,
      path: url.pathname,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
    };
    calls.push(call);
    const queue = queues.get(`${method} ${url.pathname}`);
    if (!queue) throw new Error(`fakeFetch: no route for ${method} ${url.pathname}`);
    const handler = queue.length > 1 ? queue.shift()! : queue[0]!;
    const reply = typeof handler === 'function' ? handler(call) : handler;
    if (reply instanceof Error) throw reply;
    const status = reply.status ?? 200;
    if (status === 204) return new Response(null, { status });
    const text = reply.raw ?? JSON.stringify(reply.body ?? {});
    return new Response(text, { status, headers: { 'Content-Type': reply.raw !== undefined ? 'text/html' : 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

export const errorReply = (status: number, code: string, message = 'x'): Reply => ({ status, body: { error: { code, message } } });
