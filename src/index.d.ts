/**
 * agentvet — validate LLM-generated tool args before execution.
 *
 * Hand-maintained declarations. Source is JS (with JSDoc) so this file is
 * the single source of truth for TypeScript consumers. Keep in sync with
 * src/*.js.
 */

export const VERSION: string;

export type ValidateResult<T = any> =
  | { valid: true; value?: T }
  | { valid: false; error: string };

export type Validator<T = any> = (args: any) => ValidateResult<T>;

export interface VetSpec<TArgs = any, TReturn = any> {
  /** Tool name. Surfaces in ToolArgError. */
  name: string;
  /** Validator function. Use one of the adapters or roll your own. */
  schema: Validator<TArgs>;
  /** The underlying tool. Receives validated args (with any coercion the validator did). */
  fn: (args: TArgs) => TReturn | Promise<TReturn>;
  /**
   * If provided, called when validation fails. Return a value to substitute
   * as the tool's return (suppresses the throw); return undefined to throw.
   */
  onError?: (error: ToolArgError, args: any) => any | undefined;
}

/**
 * Wrap a tool function with arg validation. Throws ToolArgError BEFORE the
 * tool runs if args don't match the schema.
 */
export function vet<TArgs = any, TReturn = any>(
  spec: VetSpec<TArgs, TReturn>
): (args: any) => Promise<TReturn>;

/**
 * One-shot validation without wrapping. Returns a structured result so you
 * can inspect the error inline.
 */
export function validate<T = any>(
  name: string,
  schema: Validator<T>,
  args: any
): { valid: true; value: T } | { valid: false; error: ToolArgError };

export interface ZodLikeSchema {
  safeParse(value: any): { success: true; data: any } | { success: false; error: { issues?: any[]; errors?: any[] } };
}

export const adapters: {
  /** Adapter for zod and zod-compatible (anything with safeParse()). */
  zod<T = any>(schema: ZodLikeSchema): Validator<T>;
  /** Adapter for ad-hoc predicate validators. */
  fn<T = any>(
    predicate: (args: any) => boolean,
    errorBuilder?: string | ((args: any) => string)
  ): Validator<T>;
  /**
   * Tiny built-in shape checker. spec format:
   *   { field: 'string' | 'number' | 'boolean' | 'array' | 'object', ... }
   * Suffix with '?' for optional.
   */
  shape<T = any>(spec: Record<string, string>): Validator<T>;
};

/**
 * Thrown by vetted tools when args fail validation. Carries everything you
 * need to send a structured tool_result back to the LLM for next-turn
 * correction.
 */
export class ToolArgError extends Error {
  name: 'ToolArgError';
  /** The tool name that rejected. */
  tool: string;
  /** The validator's error string. */
  validationError: string;
  /** The args that were rejected. */
  args: any;
  constructor(toolName: string, validationError: string, args: any);
  /** Format a message specifically for the LLM to read and retry with. */
  toLLMFeedback(): string;
}
