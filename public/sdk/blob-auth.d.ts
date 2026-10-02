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
  /** Default "openid profile email offline_access". */
  scope?: string;
  locale?: "de" | "en";
  storage?: Storage;
};

export declare class BlobAuthError extends Error {
  /** e.g. "access_denied", "popup_closed", "invalid_grant" */
  code: string;
}

export declare class BlobAuth {
  constructor(options: BlobAuthOptions);
  static version: string;
  readonly clientId: string;
  readonly issuer: string;
  readonly user: BlobUser | null;
  readonly signedIn: boolean;
  onChange(listener: (user: BlobUser | null) => void): () => void;
  signIn(options?: { prompt?: "login" | "consent" | "select_account"; loginHint?: string; popup?: boolean }): Promise<BlobUser>;
  handleRedirect(): Promise<BlobUser | null>;
  getAccessToken(): Promise<string | null>;
  refreshUser(): Promise<BlobUser | null>;
  signOut(): Promise<void>;
  button(options?: { locale?: "de" | "en"; label?: string }): HTMLButtonElement;
}
