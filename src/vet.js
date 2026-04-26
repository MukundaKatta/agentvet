import { ToolArgError } from './errors.js';

/**
 * Wrap a tool function with arg validation. The returned function checks
 * args against the schema before calling the underlying fn — if the args
 * don't match, throws ToolArgError BEFORE the tool runs.
 *
 * Composes with agentsnap's traceTool() — wrap in either order:
 *
 *   const search = traceTool('search', vet({ ... }));
 *   // or
 *   const search = vet({ name, schema, fn: traceTool('search', doSearch) });
 *
 * @param {VetSpec} spec
 * @returns {(args: any) => Promise<any>}
 */
export function vet(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new TypeError('vet: spec must be an object');
  }
  const { name, schema, fn, onError } = spec;
  if (typeof name !== 'string' || !name) {
    throw new TypeError('vet: spec.name must be a non-empty string');
  }
  if (typeof schema !== 'function') {
    throw new TypeError(
      'vet: spec.schema must be a validator function. ' +
        "Use one of adapters.zod(...), adapters.shape(...), or adapters.fn(...)."
    );
  }
  if (typeof fn !== 'function') {
    throw new TypeError('vet: spec.fn must be a function');
  }
  if (onError != null && typeof onError !== 'function') {
    throw new TypeError('vet: spec.onError must be a function (or omitted)');
  }

  return async function vettedTool(args) {
    const result = schema(args);
    if (!result || typeof result !== 'object') {
      throw new TypeError(
        `vet: validator for tool '${name}' returned a non-object. ` +
          'Validators must return { valid: true, value? } or { valid: false, error: string }.'
      );
    }
    if (result.valid === true) {
      return fn(result.value !== undefined ? result.value : args);
    }
    const error = new ToolArgError(
      name,
      typeof result.error === 'string' ? result.error : 'validation failed (no error message)',
      args
    );
    if (onError) {
      const handled = onError(error, args);
      if (handled !== undefined) return handled;
    }
    throw error;
  };
}

/**
 * One-shot validation without wrapping a tool. Returns a structured result.
 * Useful for inline checks or when you want to inspect the error before
 * deciding what to do.
 *
 * @param {string} name
 * @param {(args: any) => { valid: boolean, value?: any, error?: string }} schema
 * @param {any} args
 * @returns {{ valid: true, value: any } | { valid: false, error: ToolArgError }}
 */
export function validate(name, schema, args) {
  if (typeof name !== 'string' || !name) {
    throw new TypeError('validate: name must be a non-empty string');
  }
  if (typeof schema !== 'function') {
    throw new TypeError('validate: schema must be a validator function');
  }
  const result = schema(args);
  if (!result || typeof result !== 'object') {
    throw new TypeError(
      `validate: validator for '${name}' returned a non-object — must return { valid, value? | error }`
    );
  }
  if (result.valid === true) {
    return { valid: true, value: result.value !== undefined ? result.value : args };
  }
  return {
    valid: false,
    error: new ToolArgError(
      name,
      typeof result.error === 'string' ? result.error : 'validation failed (no error message)',
      args
    ),
  };
}

/**
 * @typedef {Object} VetSpec
 * @property {string} name              tool name (surfaces in errors)
 * @property {(args: any) => { valid: boolean, value?: any, error?: string }} schema
 *           validator function (use one of the adapters or roll your own)
 * @property {(args: any) => any | Promise<any>} fn  the underlying tool
 * @property {(error: ToolArgError, args: any) => any | undefined} [onError]
 *           if provided, called when validation fails. Return a value to
 *           use as the tool's return value (suppresses the throw); return
 *           undefined to let the throw proceed.
 */
