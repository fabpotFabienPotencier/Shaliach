export type { AiProvider } from './interfaces/ai-provider.interface';
export { GroqAiProvider } from './providers/groq-ai.provider';
export type { GroqAiProviderOptions } from './providers/groq-ai.provider';

export {
  OUTREACH_SYSTEM_PROMPT,
  buildOutreachUserPrompt,
} from './prompts/outreach.prompt';

export {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
} from './prompts/classification.prompt';

export {
  REPLY_DRAFT_SYSTEM_PROMPT,
  buildReplyDraftUserPrompt,
} from './prompts/reply-draft.prompt';

export {
  FOLLOWUP_SYSTEM_PROMPT,
  buildFollowUpUserPrompt,
} from './prompts/followup.prompt';

export {
  OutreachOutputSchema,
  type OutreachOutputDto,
} from './schemas/outreach-output.schema';

export {
  ClassificationOutputSchema,
  type ClassificationOutputDto,
} from './schemas/classification-output.schema';

export {
  ReplyDraftOutputSchema,
  type ReplyDraftOutputDto,
} from './schemas/reply-draft-output.schema';

export {
  FollowUpOutputSchema,
  type FollowUpOutputDto,
} from './schemas/followup-output.schema';
