import type { JsonValue } from "@/tokenu/contracts/json";

/**
 * JSON Schema captured from the normalized request for one named tool.
 */
export interface RequestToolSchema {
  readonly toolName: string;
  readonly schema: Readonly<Record<string, JsonValue>>;
}

/**
 * Original namespace identity for a tool whose name was flattened or rewritten
 * for an upstream wire protocol.
 */
export interface RequestToolNamespaceIdentity {
  readonly wireName: string;
  readonly namespace: string;
  readonly name: string;
}

/**
 * Explicit reversible tool-name alias produced during request translation.
 *
 * This is intentionally separate from namespace identity.
 */
export interface RequestToolNameAlias {
  readonly wireName: string;
  readonly originalName: string;
}

/**
 * Immutable request-derived metadata required by response translation.
 *
 * These values must not be hidden inside provider payloads or mutable parser
 * state. Runtime adapters may build Maps/Sets internally from these arrays.
 */
export interface RequestToolMetadata {
  readonly schemas: readonly RequestToolSchema[];
  readonly customToolNames: readonly string[];
  readonly namespaceIdentities: readonly RequestToolNamespaceIdentity[];
  readonly nameAliases: readonly RequestToolNameAlias[];
}
