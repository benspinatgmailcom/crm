export abstract class AiAdapter {
  abstract chat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ): Promise<string>;
}
