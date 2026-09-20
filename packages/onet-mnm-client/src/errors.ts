/**
 * Error thrown by the O*NET `/mnm` client, for both a non-2xx response from
 * the proxy and a response that fails runtime (zod) validation. Mirrors the
 * shape of `OnetApiError` from the sibling `@richardmcquiston01/onet-library`
 * package (a `status` number plus a `message`) so consumers already
 * familiar with that library see a consistent error contract.
 */
export class OnetClientError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'OnetClientError';
    this.status = status;
  }
}
