export type ExecutionDispatchErrorCode =
  | "adapter-not-found"
  | "endpoint-not-found"
  | "credential-not-found"
  | "technical-profile-not-found"
  | "adapter-binding-failed";

export interface ExecutionDispatchError {
  readonly code: ExecutionDispatchErrorCode;
  readonly message: string;
}
