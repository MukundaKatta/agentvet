#!/usr/bin/env node
/**
 * agentvet CLI — validate LLM-style tool args against a shape spec.
 *
 * Subcommands:
 *   agentvet validate <args.json|-> --shape <shape.json>  [--name TOOL] [--pretty]
 *   agentvet lint <tool.json|->                            [--pretty]
 *
 * `--shape` accepts a JSON file or a raw object literal whose values map fields
 * to the same compact type strings adapters.shape() understands:
 *
 *   { "query": "string", "limit": "number", "verbose": "boolean?" }
 *
 * Conventions shared across the @mukundakatta agent CLIs:
 *   - `-` reads stdin
 *   - JSON to stdout for machine consumers; --pretty for humans
 *   - exit 0 = valid, 1 = invalid / parse error, 2 = usage error
 */

import { readFileSync, existsSync } from 'node:fs';

import { adapters } from './adapters.js';
import { validate as validateApi } from './vet.js';
import { ToolArgError } from './errors.js';
import { VERSION } from './version.js';

const USAGE = `agentvet v${VERSION} — tool-arg validator for LLM agents.

Usage:
  agentvet validate <args.json|->  --shape FILE_OR_JSON  [--name TOOL] [--pretty]
  agentvet lint     <tool.json|->                         [--pretty]
  agentvet --help | --version

Notes:
  Pass '-' as the input to read from stdin.
  validate emits {"valid": true|false, "value"|"error", "retry_hint"}.
  lint     checks the structure of a tool definition (name + description +
           input_schema) and prints any warnings/errors.
  Exit codes: 0 valid, 1 invalid / parse error, 2 usage error.
`;

// --- main ---

export async function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    process.stdout.write(VERSION + '\n');
    return 0;
  }

  const sub = argv[0];
  const rest = argv.slice(1);
  try {
    if (sub === 'validate') return await runValidate(rest);
    if (sub === 'lint') return await runLint(rest);
    process.stderr.write(`agentvet: unknown subcommand '${sub}'\n\n${USAGE}`);
    return 2;
  } catch (err) {
    return reportError(err);
  }
}

// --- validate ---

async function runValidate(args) {
  const flags = parseFlags(args, {
    string: ['shape', 'name'],
    boolean: ['pretty'],
  });
  if (flags._.length === 0) {
    process.stderr.write('agentvet validate: missing <args.json|-> argument\n');
    return 2;
  }
  if (!flags.shape) {
    process.stderr.write('agentvet validate: --shape is required\n');
    return 2;
  }
  const toolName = flags.name ?? 'tool';
  const shape = await loadShape(flags.shape);
  const argsValue = await readJson(flags._[0]);
  const result = validateApi(toolName, adapters.shape(shape), argsValue);
  if (result.valid) {
    emit({ valid: true, value: result.value, retry_hint: null }, flags.pretty);
    return 0;
  }
  // result.error is a ToolArgError instance — we want its LLM-friendly hint
  // exposed in the JSON so consumers can pipe it straight back to the model.
  const err = result.error instanceof ToolArgError ? result.error : null;
  emit(
    {
      valid: false,
      tool: toolName,
      error: err?.validationError ?? String(result.error),
      retry_hint: err ? err.toLLMFeedback() : null,
    },
    flags.pretty
  );
  return 1;
}

// --- lint ---

async function runLint(args) {
  const flags = parseFlags(args, { boolean: ['pretty'] });
  if (flags._.length === 0) {
    process.stderr.write('agentvet lint: missing <tool.json|-> argument\n');
    return 2;
  }
  const tool = await readJson(flags._[0]);
  const issues = lintTool(tool);
  const hardErrors = issues.filter((i) => i.severity === 'error');
  emit({ valid: hardErrors.length === 0, issues }, flags.pretty);
  return hardErrors.length === 0 ? 0 : 1;
}

/**
 * Lint a tool definition. Checks the common shape used across LLM SDKs:
 *   { name, description, input_schema | parameters }
 *
 * Returns severity-tagged issues so callers can decide what to fail on.
 */
function lintTool(tool) {
  const issues = [];
  if (tool === null || typeof tool !== 'object' || Array.isArray(tool)) {
    issues.push({ severity: 'error', path: '<root>', message: 'tool must be an object' });
    return issues;
  }
  if (typeof tool.name !== 'string' || !tool.name) {
    issues.push({ severity: 'error', path: 'name', message: 'name is required and must be a non-empty string' });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(tool.name)) {
    issues.push({
      severity: 'warning',
      path: 'name',
      message: 'name should be alphanumeric/underscore/dash to match LLM SDK conventions',
    });
  }
  if (typeof tool.description !== 'string' || !tool.description) {
    issues.push({
      severity: 'warning',
      path: 'description',
      message: 'description is missing — LLMs rely on this to choose tools correctly',
    });
  }
  const schema = tool.input_schema ?? tool.parameters;
  if (schema == null) {
    issues.push({
      severity: 'error',
      path: 'input_schema',
      message: 'input_schema (or parameters) is required',
    });
  } else if (typeof schema !== 'object') {
    issues.push({
      severity: 'error',
      path: 'input_schema',
      message: 'input_schema must be an object',
    });
  } else if (schema.type !== undefined && schema.type !== 'object') {
    issues.push({
      severity: 'warning',
      path: 'input_schema.type',
      message: `input_schema.type should be "object", got ${JSON.stringify(schema.type)}`,
    });
  }
  return issues;
}

// --- helpers ---

/**
 * Load a shape spec from either a JSON file path or a literal JSON string.
 * The shape is the same compact format adapters.shape() understands.
 */
async function loadShape(arg) {
  if (existsSync(arg)) {
    const raw = readFileSync(arg, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new ParseError(`shape file '${arg}' is not valid JSON: ${err.message}`);
    }
  }
  // Treat as inline JSON literal
  try {
    return JSON.parse(arg);
  } catch {
    throw new UsageError(`--shape must be a JSON file path or inline JSON object, got '${arg}'`);
  }
}

async function readJson(arg) {
  const raw = await resolveInput(arg);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ParseError(`'${arg}' is not valid JSON: ${err.message}`);
  }
}

async function resolveInput(arg) {
  if (arg === '-') return await readStdin();
  if (existsSync(arg)) return readFileSync(arg, 'utf8');
  return arg;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

/**
 * Tiny argv parser. Same shape as the other @mukundakatta CLIs.
 */
function parseFlags(argv, schema) {
  const flags = { _: [] };
  for (const name of schema.boolean ?? []) flags[name] = false;
  for (const name of schema.string ?? []) flags[name] = undefined;

  const wantsValue = new Set(schema.string ?? []);

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--') {
      flags._.push(...argv.slice(i + 1));
      break;
    }
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      const name = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
      const inlineValue = eq === -1 ? null : tok.slice(eq + 1);
      if (wantsValue.has(name)) {
        const raw = inlineValue ?? argv[++i];
        if (raw === undefined) throw new UsageError(`flag --${name} requires a value`);
        flags[name] = raw;
      } else if ((schema.boolean ?? []).includes(name)) {
        flags[name] = true;
      } else {
        throw new UsageError(`unknown flag --${name}`);
      }
    } else {
      flags._.push(tok);
    }
  }
  return flags;
}

function emit(value, pretty) {
  const json = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  process.stdout.write(json + '\n');
}

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
    this.exitCode = 2;
  }
}

class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParseError';
    this.exitCode = 1;
  }
}

function reportError(err) {
  if (err && (err.name === 'UsageError' || err.name === 'ParseError')) {
    process.stderr.write(`agentvet: ${err.message}\n`);
    return err.exitCode ?? 2;
  }
  process.stderr.write(`agentvet: ${err?.message ?? err}\n`);
  return 1;
}

const isMain =
  process.argv[1] && (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('agentvet'));
if (isMain) {
  main().then(
    (code) => process.exit(code ?? 0),
    (err) => {
      process.stderr.write(`agentvet: ${err?.stack ?? err}\n`);
      process.exit(1);
    }
  );
}
