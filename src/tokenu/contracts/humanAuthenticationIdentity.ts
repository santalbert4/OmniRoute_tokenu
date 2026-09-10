/**
 * Stable opaque identity asserted by an external human authentication layer.
 *
 * This contract deliberately contains no TokenU workspace, authorization,
 * session, credential, token, email, or display-name state.
 */
export interface ExternalHumanIdentity {
  readonly authority: string;
  readonly subject: string;
}

/**
 * Internal TokenU principal produced after resolving an authenticated external
 * human identity.
 *
 * Workspace authorization remains a separate P8B concern.
 */
export interface AuthenticatedTokenUUser {
  readonly userId: string;
}

/**
 * Immutable persistent association between one external authenticated human
 * identity and one TokenU-owned user identity.
 */
export interface HumanIdentityBinding {
  readonly authority: string;
  readonly subject: string;
  readonly userId: string;
  readonly createdAt: string;
}
