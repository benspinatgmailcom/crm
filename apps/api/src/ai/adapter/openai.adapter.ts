import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AiAdapter } from './ai-adapter.interface';

@Injectable()
export class OpenAiAdapter extends AiAdapter {
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor() {
    super();
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async chat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        'OPENAI_API_KEY is not set. Add it to your .env file to use AI features.',
      );
    }

    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const userMsg = messages.find((m) => m.role === 'user')?.content ?? '';

    const response = await this.client.responses.create({
      model: this.model,
      ...(systemMsg && { instructions: systemMsg }),
      input: userMsg,
    });

    const content = (response as { output_text?: string }).output_text;
    if (content == null || content === '') {
      throw new Error('Empty response from OpenAI');
    }
    return content;
  }
}
