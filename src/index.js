/**
 * agentvet — validate LLM-generated tool args before execution.
 *
 * Public surface:
 *   - vet({name, schema, fn, onError?})  wrap a tool function with arg validation
 *   - validate(name, schema, args)       one-off check; returns { valid, value | error }
 *   - adapters.zod(schema)               bridge for safeParse-style validators
 *   - adapters.fn(predicate, errBuilder) bridge for ad-hoc predicates
 *   - adapters.shape(spec)               tiny built-in shape checker (no deps)
 *   - ToolArgError                       thrown by vetted tools on bad args
 */

export { vet, validate } from './vet.js';
export { adapters } from './adapters.js';
export { ToolArgError } from './errors.js';
export { VERSION } from './version.js';
