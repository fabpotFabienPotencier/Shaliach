import Groq from 'groq-sdk';
import type {
  OutreachGenerationInput,
  OutreachGenerationResult,
  ReplyClassificationInput,
  ReplyClassificationResult,
  ReplyDraftInput,
  ReplyDraftResult,
  FollowUpGenerationInput,
  FollowUpGenerationResult,
} from '@shaliach/shared';
import { AiProviderError, ErrorCode } from '@shaliach/shared';
import type { AiProvider } from '../interfaces/ai-provider.interface';
import { OutreachOutputSchema } from '../schemas/outreach-output.schema';
import { ClassificationOutputSchema } from '../schemas/classification-output.schema';
import { ReplyDraftOutputSchema } from '../schemas/reply-draft-output.schema';
import { FollowUpOutputSchema } from '../schemas/followup-output.schema';
import { OUTREACH_SYSTEM_PROMPT, buildOutreachUserPrompt } from '../prompts/outreach.prompt';
import { CLASSIFICATION_SYSTEM_PROMPT, buildClassificationUserPrompt } from '../prompts/classification.prompt';
import { REPLY_DRAFT_SYSTEM_PROMPT, buildReplyDraftUserPrompt } from '../prompts/reply-draft.prompt';
import { FOLLOWUP_SYSTEM_PROMPT, buildFollowUpUserPrompt } from '../prompts/followup.prompt';

export interface GroqAiProviderOptions {
  apiKey: string;
  model: string;
  fallbackModel?: string;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

export class GroqAiProvider implements AiProvider {
  private client: Groq;
  private primaryModel: string;
  private fallbackModel: string;
  private maxTokens: number;
  private temperature: number;
  private maxRetries: number;

  constructor(options: GroqAiProviderOptions) {
    if (!options.apiKey) {
      throw new AiProviderError('Groq API Key is required for GroqAiProvider', {
        code: ErrorCode.AI_PROVIDER_ERROR,
      });
    }

    this.client = new Groq({
      apiKey: options.apiKey,
      timeout: options.timeoutMs ?? 30000,
    });
    this.primaryModel = options.model || 'llama-3.3-70b-versatile';
    this.fallbackModel = options.fallbackModel || 'llama-3.1-8b-instant';
    this.maxTokens = options.maxTokens ?? 1000;
    this.temperature = options.temperature ?? 0.4;
    this.maxRetries = options.maxRetries ?? 3;
  }

  private async callWithRetryAndFallback(
    systemPrompt: string,
    userPrompt: string,
    temperature?: number,
  ): Promise<{ content: string; modelUsed: string; promptTokens: number; completionTokens: number }> {
    let lastError: Error | null = null;
    const modelsToTry = [this.primaryModel, this.fallbackModel].filter(Boolean);

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await this.client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: temperature ?? this.temperature,
            max_tokens: this.maxTokens,
          });

          const choice = response.choices[0];
          if (!choice || !choice.message.content) {
            throw new AiProviderError(`Empty response received from Groq model ${model}`);
          }

          return {
            content: choice.message.content,
            modelUsed: model,
            promptTokens: response.usage?.prompt_tokens ?? 0,
            completionTokens: response.usage?.completion_tokens ?? 0,
          };
        } catch (err: any) {
          lastError = err;
          const isRateLimit = err?.status === 429 || err?.message?.includes('rate_limit');
          const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout');
          const isServiceUnavailable = err?.status === 503 || err?.status === 500;

          if (isRateLimit || isTimeout || isServiceUnavailable) {
            const retryAfterHeader = err?.headers?.['retry-after'];
            const delayMs = retryAfterHeader
              ? parseInt(retryAfterHeader, 10) * 1000
              : Math.min(1000 * Math.pow(2, attempt), 8000);

            if (attempt < this.maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              continue;
            }
          }
          break; // break inner loop to try fallback model if available
        }
      }
    }

    throw new AiProviderError(
      `All Groq attempts failed. Last error: ${lastError?.message || 'Unknown error'}`,
      { cause: lastError },
    );
  }

  public async generateOutreachEmail(
    input: OutreachGenerationInput,
  ): Promise<OutreachGenerationResult> {
    const userPrompt = buildOutreachUserPrompt(input);
    const { content, modelUsed, promptTokens, completionTokens } =
      await this.callWithRetryAndFallback(OUTREACH_SYSTEM_PROMPT, userPrompt);

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new AiProviderError('Groq response was not valid JSON for outreach generation', {
        code: ErrorCode.AI_INVALID_OUTPUT,
      });
    }

    const validationResult = OutreachOutputSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new AiProviderError(
        `Outreach output schema validation failed: ${validationResult.error.message}`,
        { code: ErrorCode.AI_INVALID_OUTPUT },
      );
    }

    const data = validationResult.data;
    return {
      subject: data.subject,
      textBody: data.textBody,
      htmlBody: data.htmlBody,
      confidence: data.confidence,
      warnings: data.warnings,
      promptTokens,
      completionTokens,
      model: modelUsed,
    };
  }

  public async classifyReply(
    input: ReplyClassificationInput,
  ): Promise<ReplyClassificationResult> {
    const userPrompt = buildClassificationUserPrompt(input);
    const { content, modelUsed, promptTokens, completionTokens } =
      await this.callWithRetryAndFallback(CLASSIFICATION_SYSTEM_PROMPT, userPrompt, 0.1);

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new AiProviderError('Groq response was not valid JSON for reply classification', {
        code: ErrorCode.AI_INVALID_OUTPUT,
      });
    }

    const validationResult = ClassificationOutputSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new AiProviderError(
        `Classification schema validation failed: ${validationResult.error.message}`,
        { code: ErrorCode.AI_INVALID_OUTPUT },
      );
    }

    const data = validationResult.data;
    return {
      classification: data.classification,
      confidence: data.confidence,
      reasoning: data.reasoning,
      suggestedAction: data.suggestedAction,
      keyPoints: data.keyPoints,
      promptTokens,
      completionTokens,
      model: modelUsed,
    };
  }

  public async draftReply(
    input: ReplyDraftInput,
  ): Promise<ReplyDraftResult> {
    const userPrompt = buildReplyDraftUserPrompt(input);
    const { content, modelUsed, promptTokens, completionTokens } =
      await this.callWithRetryAndFallback(REPLY_DRAFT_SYSTEM_PROMPT, userPrompt, 0.3);

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new AiProviderError('Groq response was not valid JSON for reply draft', {
        code: ErrorCode.AI_INVALID_OUTPUT,
      });
    }

    const validationResult = ReplyDraftOutputSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new AiProviderError(
        `Reply draft schema validation failed: ${validationResult.error.message}`,
        { code: ErrorCode.AI_INVALID_OUTPUT },
      );
    }

    const data = validationResult.data;
    return {
      subject: data.subject,
      textBody: data.textBody,
      htmlBody: data.htmlBody,
      confidence: data.confidence,
      notes: data.notes,
      requiresManualReview: data.requiresManualReview,
      detectedRequests: data.detectedRequests,
      promptTokens,
      completionTokens,
      model: modelUsed,
    };
  }

  public async generateFollowUp(
    input: FollowUpGenerationInput,
  ): Promise<FollowUpGenerationResult> {
    const userPrompt = buildFollowUpUserPrompt(input);
    const { content, modelUsed, promptTokens, completionTokens } =
      await this.callWithRetryAndFallback(FOLLOWUP_SYSTEM_PROMPT, userPrompt, 0.4);

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new AiProviderError('Groq response was not valid JSON for follow-up', {
        code: ErrorCode.AI_INVALID_OUTPUT,
      });
    }

    const validationResult = FollowUpOutputSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new AiProviderError(
        `Follow-up schema validation failed: ${validationResult.error.message}`,
        { code: ErrorCode.AI_INVALID_OUTPUT },
      );
    }

    const data = validationResult.data;
    return {
      subject: data.subject,
      textBody: data.textBody,
      htmlBody: data.htmlBody,
      confidence: data.confidence,
      warnings: data.warnings,
      promptTokens,
      completionTokens,
      model: modelUsed,
    };
  }
}
