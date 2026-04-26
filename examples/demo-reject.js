/**
 * Runnable demo: simulates an agent loop where the model hallucinates
 * the wrong type for a tool arg, agentvet rejects it before the tool runs,
 * the error is fed back to the model, and the model "corrects" on retry.
 *
 *   node examples/demo-reject.js
 */
import { vet, adapters, ToolArgError } from '../src/index.js';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};
const c = (col, s) => (process.stdout.isTTY ? col + s + COLORS.reset : s);
function banner(text) {
  console.log('\n' + '═'.repeat(64));
  console.log('  ' + text);
  console.log('═'.repeat(64));
}

// Tool: book_flight(flight_id: string, seat: 'window' | 'aisle')
let bookCalls = 0;
const book_flight = vet({
  name: 'book_flight',
  schema: adapters.shape({ flight_id: 'string', seat: 'string' }),
  fn: async (args) => {
    bookCalls++;
    return { confirmation: `CONF-${args.flight_id}-${args.seat}` };
  },
});

// Stand-in for an LLM that hallucinates wrong types on first call,
// then "reads the feedback" and corrects itself on retry.
const llmAttempts = [
  { flight_id: 12345, seat: 'window' }, // wrong: flight_id is a number
  { flight_id: 'UA123', seat: 'window' }, // corrected
];

async function runAgentLoop() {
  let attempt = 0;
  while (attempt < llmAttempts.length) {
    const args = llmAttempts[attempt];
    attempt++;
    banner(`LLM attempt ${attempt}: book_flight(${JSON.stringify(args)})`);
    try {
      const result = await book_flight(args);
      console.log(c(COLORS.green, `  ✓ tool ran: ${JSON.stringify(result)}`));
      return result;
    } catch (err) {
      if (err instanceof ToolArgError) {
        console.log(c(COLORS.red, '  ✗ rejected before tool ran'));
        console.log(c(COLORS.dim, `    reason:  ${err.validationError}`));
        console.log();
        console.log(c(COLORS.yellow, '  feedback sent to model:'));
        console.log(c(COLORS.dim, '    ' + err.toLLMFeedback().split('\n').join('\n    ')));
      } else {
        throw err;
      }
    }
  }
  throw new Error('agent gave up after ' + attempt + ' attempts');
}

const result = await runAgentLoop();
banner('done');
console.log(c(COLORS.dim, `  total tool runs: ${bookCalls}  (the rejected attempt didn't count)`));
console.log(c(COLORS.dim, '  the dangerous side-effect (booking) only happened once, with valid args'));
