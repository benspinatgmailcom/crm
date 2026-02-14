/**
 * Adapter for LLM calls. Isolates the implementation so it can be swapped
 * (e.g. OpenAI, Anthropic, local model) without changing AiService.
 */
export abstract class AiAdapter {
  abstract chat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ): Promise<string>;
}
