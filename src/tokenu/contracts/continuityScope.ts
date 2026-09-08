/**
 * Tenant-scoped identity for approved protocol state that may need continuity
 * beyond one translation stage or upstream attempt.
 *
 * State stores must scope persisted continuity data by organization as well as
 * by the opaque TokenU-owned scope identifier.
 */
export interface TranslationContinuityScope {
  readonly organizationId: string;
  readonly scopeId: string;
}
