/**
 * Validator adapters. Each turns a third-party validator into the shape that
 * vet() expects: (args) => { valid: true, value? } | { valid: false, error: string }
 *
 * Zero deps — these are pure functions that call into the user-supplied
 * validator. Same shape as agentcast's adapters so you can swap them.
 */

/** @typedef {{ valid: true, value?: any } | { valid: false, error: string }} ValidateResult */

export const adapters = {
  /**
   * Zod adapter. Works with any validator that has a `safeParse(value)` method
   * returning `{ success: true, data }` or `{ success: false, error: { issues: [...] } }`.
   * Covers zod, valibot's safeParse, and similar libraries.
   *
   * @param {{ safeParse: (val: any) => any }} schema
   * @returns {(args: any) => ValidateResult}
   */
  zod(schema) {
    if (!schema || typeof schema.safeParse !== 'function') {
      throw new TypeError('adapters.zod: schema must have a safeParse() method');
    }
    return (args) => {
      const r = schema.safeParse(args);
      if (r.success) return { valid: true, value: r.data };
      const issues = r.error?.issues ?? r.error?.errors ?? [{ message: String(r.error) }];
      const formatted = issues
        .map((i) => {
          const path = i.path?.length ? i.path.join('.') : '<args>';
          return `${path}: ${i.message}`;
        })
        .join('; ');
      return { valid: false, error: formatted };
    };
  },

  /**
   * Predicate adapter. For ad-hoc validation: pass a function that returns
   * true if args are acceptable, plus an optional error builder.
   *
   * @param {(args: any) => boolean} predicate
   * @param {string | ((args: any) => string)} [errorBuilder]
   * @returns {(args: any) => ValidateResult}
   */
  fn(predicate, errorBuilder = 'arguments did not pass predicate') {
    if (typeof predicate !== 'function') {
      throw new TypeError('adapters.fn: predicate must be a function');
    }
    return (args) => {
      if (predicate(args)) return { valid: true, value: args };
      const err = typeof errorBuilder === 'function' ? errorBuilder(args) : errorBuilder;
      return { valid: false, error: err };
    };
  },

  /**
   * Tiny built-in shape checker for when you don't want a validator dep.
   * Spec format: { field: 'string' | 'number' | 'boolean' | 'array' | 'object', ... }
   * Required by default. Suffix with '?' for optional.
   *
   * Not a full JSON Schema validator — just enough to gate basic LLM tool args.
   *
   * @param {Record<string, string>} spec
   * @returns {(args: any) => ValidateResult}
   */
  shape(spec) {
    if (!spec || typeof spec !== 'object') {
      throw new TypeError('adapters.shape: spec must be an object');
    }
    return (args) => {
      if (args === null || typeof args !== 'object' || Array.isArray(args)) {
        return { valid: false, error: 'expected an object as tool arguments' };
      }
      const errors = [];
      for (const [key, type] of Object.entries(spec)) {
        const optional = type.endsWith('?');
        const baseType = optional ? type.slice(0, -1) : type;
        const present = key in args;
        if (!present) {
          if (!optional) errors.push(`missing required field '${key}'`);
          continue;
        }
        if (!matchesType(args[key], baseType)) {
          errors.push(`field '${key}' should be ${baseType}, got ${describe(args[key])}`);
        }
      }
      if (errors.length > 0) return { valid: false, error: errors.join('; ') };
      return { valid: true, value: args };
    };
  },
};

function matchesType(value, type) {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && !Number.isNaN(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return false;
}

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
