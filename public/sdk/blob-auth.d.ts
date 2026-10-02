/** Types for https://blob.bojes.org/sdk/blob-auth.js ("Sign in with Blob"). */

export type BlobUser = {
  /** Stable id of the person for your app. */
  sub: string;
  name?: string;
  given_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  locale?: "de" | "en";
};

export type BlobAuthOptions = {
  clientId: string;
  /** Must exactly match a redirect URI registered in Blob and serve blob-callback.html. */
  redirectUri: string;
  /** Blob's address. Defaults to where the SDK was loaded from. */
  issuer?: string;
  /** Default "openid profile email offline_access". Add "data" to use `blob.data` (the app must be allowed it in Blob). */
  scope?: string;
  locale?: "de" | "en";
  storage?: Storage;
};

export declare class BlobAuthError extends Error {
  /**
   * e.g. "access_denied", "popup_closed", "invalid_grant", "network_error" (Blob can't be
   * reached: offline, DNS, Blob down), "discovery_failed" (Blob answered, but not as expected).
   * From `blob.data` also: "signed_out", "conflict", "too_large", "too_many_keys",
   * "invalid_request", "invalid_token", "insufficient_scope".
   */
  code: string;
  /** HTTP status, when Blob's data API answered with an error. */
  status?: number;
  /** With code "conflict": what Blob has now (version 0 and value null when the key doesn't exist). */
  current?: BlobDataConflict;
}

/** A key: 1-64 characters, a-z 0-9 and _ . - (starting with a letter or digit). */
export type BlobDataKey = string;

export type BlobDataItem<T = unknown> = {
  key: BlobDataKey;
  value: T;
  /**
   * Changes on every write and never goes back, also not after a delete. One counter for all of
   * the app's keys, so not +1 per key: compare it only for equality and pass back the one you got.
   */
  version: number;
  updated_at: string;
};

export type BlobDataInfo = { key: BlobDataKey; version: number; /** bytes as JSON */ size: number; updated_at: string };

export type BlobDataConflict<T = unknown> = { key: BlobDataKey; value: T | null; version: number; updated_at: string | null };

/**
 * The app's own data in the person's Blob account (needs the "data" scope). Every app sees only
 * its own keys. Limits: 256 KiB per value (as JSON), 50 keys per person. Throws BlobAuthError.
 */
export interface BlobData {
  list(): Promise<BlobDataInfo[]>;
  /** null when the key doesn't exist. */
  get<T = unknown>(key: BlobDataKey): Promise<BlobDataItem<T> | null>;
  /**
   * Stores any JSON value except a top-level null (use delete). `version`: omitted = overwrite,
   * 0 = only if the key doesn't exist yet, n = only if it is still at version n; otherwise throws
   * code "conflict" with `current`.
   */
  put<T = unknown>(key: BlobDataKey, value: T, options?: { version?: number }): Promise<{ key: BlobDataKey; version: number; updated_at: string }>;
  delete(key: BlobDataKey): Promise<void>;
}

export declare class BlobAuth {
  constructor(options: BlobAuthOptions);
  static version: string;
  readonly clientId: string;
  readonly issuer: string;
  readonly user: BlobUser | null;
  readonly signedIn: boolean;
  /** The app's own data in the person's Blob account (scope "data"). */
  readonly data: BlobData;
  onChange(listener: (user: BlobUser | null) => void): () => void;
  signIn(options?: { prompt?: "login" | "consent" | "select_account"; loginHint?: string; popup?: boolean }): Promise<BlobUser>;
  handleRedirect(): Promise<BlobUser | null>;
  getAccessToken(): Promise<string | null>;
  refreshUser(): Promise<BlobUser | null>;
  signOut(): Promise<void>;
  button(options?: { locale?: "de" | "en"; label?: string }): HTMLButtonElement;
}
