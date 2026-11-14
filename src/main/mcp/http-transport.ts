import type { JSONRPCRequest, JSONRPCResponse } from './stdio-transport';
import { SecretRedactor } from './security/secret-redactor';

export interface HttpTransportOptions {
  url: string;
  authToken?: string;
  headerKey?: string;
  customHeaders?: Record<string, string>;
  onLog?: (line: string, isError: boolean) => void;
}

export class HttpTransport {
  private nextRequestId = 1;

  constructor(private options: HttpTransportOptions) {}

  public async sendRequest<T = any>(method: string, params?: any, timeoutMs = 30000): Promise<T> {
    const id = this.nextRequestId++;
    const payload: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(this.options.customHeaders || {})
    };

    if (this.options.authToken) {
      const headerName = this.options.headerKey || 'Authorization';
      headers[headerName] = headerName.toLowerCase() === 'authorization'
        ? (this.options.authToken.startsWith('Bearer ') ? this.options.authToken : `Bearer ${this.options.authToken}`)
        : this.options.authToken;
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.options.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutTimer);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${SecretRedactor.redactText(errText)}`);
      }

      const json = (await response.json()) as JSONRPCResponse;

      if (json.error) {
        throw new Error(json.error.message || `JSON-RPC error code ${json.error.code}`);
      }

      return json.result as T;
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? `MCP HTTP request timed out after ${timeoutMs}ms` : err.message;
      this.options.onLog?.(SecretRedactor.redactText(msg), true);
      throw new Error(SecretRedactor.redactText(msg));
    }
  }

  public sendNotification(method: string, params?: any): void {
    // Fire-and-forget JSON-RPC notification
    const payload = {
      jsonrpc: '2.0',
      method,
      params
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.options.customHeaders || {})
    };

    if (this.options.authToken) {
      const headerName = this.options.headerKey || 'Authorization';
      headers[headerName] = headerName.toLowerCase() === 'authorization'
        ? `Bearer ${this.options.authToken}`
        : this.options.authToken;
    }

    fetch(this.options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }).catch(() => {});
  }
}
