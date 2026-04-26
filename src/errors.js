/**
 * ToolArgError — thrown by a vet()-wrapped tool when the LLM passes args that
 * don't match the tool's schema.
 *
 * Carries enough structured info to send back to the model as a tool_result
 * with is_error: true, so the next-turn correction has the validation error
 * as context:
 *
 *   - tool:             the tool name
 *   - validationError:  the validator's error string
 *   - args:             the rejected args
 *
 * Use err.toLLMFeedback() to format a message specifically intended for the
 * model to read and retry with corrected args.
 */
export class ToolArgError extends Error {
  /**
   * @param {string} toolName
   * @param {string} validationError
   * @param {any} args
   */
  constructor(toolName, validationError, args) {
    super(`agentvet: invalid args for tool '${toolName}' — ${validationError}`);
    this.name = 'ToolArgError';
    this.tool = toolName;
    this.validationError = validationError;
    this.args = args;
  }

  /**
   * Format as a string suitable for sending back to the LLM as tool_result
   * content (with is_error: true). Includes the tool name, the validation
   * error, and an explicit "call again with corrected args" instruction so
   * the next-turn behaviour is unambiguous.
   *
   * @returns {string}
   */
  toLLMFeedback() {
    return (
      `Tool '${this.tool}' rejected the arguments. ` +
      `Validation error: ${this.validationError}.\n\n` +
      `Call '${this.tool}' again with corrected arguments that match the tool's input schema.`
    );
  }
}
