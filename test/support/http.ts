import http from 'node:http';

export interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
  json: unknown;
}

/**
 * A plain HTTP request. Unlike `fetch` it lets a test choose the Host header and any other
 * header, which the guards need to be tested with.
 */
export function rawRequest(
  port: number,
  options: { method?: string; path: string; headers?: Record<string, string>; body?: string | Buffer },
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port, method: options.method ?? 'GET', path: options.path, headers: options.headers },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: unknown = undefined;
          try {
            json = JSON.parse(text);
          } catch {
            // not JSON
          }
          resolve({ status: response.statusCode ?? 0, headers: response.headers, text, json });
        });
      },
    );
    request.on('error', reject);
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });
}
