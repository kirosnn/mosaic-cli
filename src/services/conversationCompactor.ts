import { Message } from './aiProvider.js';

export interface CompactionResult {
  compactedMessages: Message[];
  tokensBeforeCompaction: number;
  tokensAfterCompaction: number;
  messagesCompacted: number;
}

/**
 * ConversationCompactor - Intelligent conversation history management
 *
 * This service prevents token limit issues by automatically compacting conversation history
 * when approaching the model's context limit.
 *
 * Strategy:
 * 1. Monitor token usage (triggers at 65% of effective limit)
 * 2. Keep recent messages intact (30% of conversation, minimum 4 messages)
 * 3. Summarize older messages into a compact context block
 * 4. Apply aggressive compaction if needed (multiple reduction attempts)
 * 5. Emergency fallback: keep only system message + last user message
 *
 * This ensures the model always has context while avoiding empty responses
 * due to token limit exhaustion.
 */
export class ConversationCompactor {
  private readonly TOKEN_RATIO = 4;

  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;

    let ratio = this.TOKEN_RATIO;

    const codePatterns = /```[\s\S]*?```|`[^`]+`|[{}\[\]();]|function|const|let|var|if|else|return/;
    const hasCode = codePatterns.test(text);

    const jsonPattern = /^\s*[\[{][\s\S]*[\]}]\s*$/;
    const isJson = jsonPattern.test(text);

    if (isJson) {
      ratio = 3;
    } else if (hasCode) {
      ratio = 3.2;
    } else {
      ratio = 3.5;
    }

    return Math.ceil(text.length / ratio);
  }

  private createSummaryMessage(messagesToSummary: Message[]): Message {
    const conversationParts: string[] = [];
    let userQuestions = 0;
    let assistantResponses = 0;

    for (const msg of messagesToSummary) {
      if (msg.role === 'user') {
        userQuestions++;
        const preview = msg.content.substring(0, 150).trim();
        conversationParts.push(`Q: ${preview}${msg.content.length > 150 ? '...' : ''}`);
      } else if (msg.role === 'assistant') {
        assistantResponses++;
        const preview = msg.content.substring(0, 150).trim();
        conversationParts.push(`A: ${preview}${msg.content.length > 150 ? '...' : ''}`);
      }
    }

    const topExchanges = conversationParts.slice(0, 8).join('\n\n');

    const summary = `[CONVERSATION CONTEXT - Auto-compacted to save tokens]

${messagesToSummary.length} messages compacted (${userQuestions} questions, ${assistantResponses} responses)

Recent exchanges before current context:
${topExchanges}

[Conversation continues with recent messages below]`;

    return {
      role: 'system',
      content: summary
    };
  }

  compactIfNeeded(
    messages: Message[],
    maxTokens: number,
    reservedForResponse: number
  ): CompactionResult {
    const systemMessage = messages.find(msg => msg.role === 'system');
    const otherMessages = messages.filter(msg => msg.role !== 'system');

    const effectiveLimit = maxTokens - reservedForResponse;
    let totalTokens = systemMessage ? this.estimateTokens(systemMessage.content) : 0;

    for (const msg of otherMessages) {
      totalTokens += this.estimateTokens(msg.content);
    }

    const tokensBeforeCompaction = totalTokens;

    if (totalTokens <= effectiveLimit * 0.65) {
      return {
        compactedMessages: messages,
        tokensBeforeCompaction,
        tokensAfterCompaction: totalTokens,
        messagesCompacted: 0
      };
    }

    const recentMessagesToKeep = Math.max(4, Math.floor(otherMessages.length * 0.3));
    const recentMessages = otherMessages.slice(-recentMessagesToKeep);
    const oldMessages = otherMessages.slice(0, -recentMessagesToKeep);

    if (oldMessages.length === 0) {
      const messagesToTruncate = Math.floor(recentMessages.length * 0.4);
      const truncatedMessages = recentMessages.slice(-messagesToTruncate);

      const result: Message[] = [];
      if (systemMessage) result.push(systemMessage);
      result.push(...truncatedMessages);

      return {
        compactedMessages: result,
        tokensBeforeCompaction,
        tokensAfterCompaction: this.estimateTokens(result.map(m => m.content).join('')),
        messagesCompacted: recentMessages.length - truncatedMessages.length
      };
    }

    const summaryMessage = this.createSummaryMessage(oldMessages);

    const compactedMessages: Message[] = [];
    if (systemMessage) {
      compactedMessages.push(systemMessage);
    }
    compactedMessages.push(summaryMessage);
    compactedMessages.push(...recentMessages);

    let tokensAfterCompaction = 0;
    for (const msg of compactedMessages) {
      tokensAfterCompaction += this.estimateTokens(msg.content);
    }

    if (tokensAfterCompaction > effectiveLimit * 0.95) {
      let reductionPercentage = 0.5;
      let attempts = 0;
      const maxAttempts = 3;

      while (tokensAfterCompaction > effectiveLimit * 0.85 && attempts < maxAttempts) {
        const furtherReduction = Math.max(2, Math.floor(recentMessages.length * reductionPercentage));
        const finalMessages = recentMessages.slice(-furtherReduction);

        const result: Message[] = [];
        if (systemMessage) result.push(systemMessage);
        result.push(summaryMessage);
        result.push(...finalMessages);

        tokensAfterCompaction = 0;
        for (const msg of result) {
          tokensAfterCompaction += this.estimateTokens(msg.content);
        }

        if (tokensAfterCompaction <= effectiveLimit * 0.85) {
          console.warn(`[ConversationCompactor] Applied aggressive compaction (attempt ${attempts + 1})`);
          return {
            compactedMessages: result,
            tokensBeforeCompaction,
            tokensAfterCompaction,
            messagesCompacted: oldMessages.length + (recentMessages.length - furtherReduction)
          };
        }

        reductionPercentage -= 0.15;
        attempts++;
      }

      if (tokensAfterCompaction > effectiveLimit) {
        console.error('[ConversationCompactor] CRITICAL: Unable to fit conversation within token limit even after aggressive compaction');

        const emergencyMessages: Message[] = [];
        if (systemMessage) emergencyMessages.push(systemMessage);

        const lastUserMessage = otherMessages.filter(m => m.role === 'user').slice(-1)[0];
        if (lastUserMessage) {
          emergencyMessages.push(lastUserMessage);
        }

        return {
          compactedMessages: emergencyMessages,
          tokensBeforeCompaction,
          tokensAfterCompaction: this.estimateTokens(emergencyMessages.map(m => m.content).join('')),
          messagesCompacted: messages.length - emergencyMessages.length
        };
      }
    }

    return {
      compactedMessages,
      tokensBeforeCompaction,
      tokensAfterCompaction,
      messagesCompacted: oldMessages.length
    };
  }

  smartTruncate(
    messages: Message[],
    maxTokens: number,
    reservedForResponse: number
  ): Message[] {
    const result = this.compactIfNeeded(messages, maxTokens, reservedForResponse);

    if (result.messagesCompacted > 0) {
      console.log(`[ConversationCompactor] Compacted ${result.messagesCompacted} messages`);
      console.log(`[ConversationCompactor] Tokens: ${result.tokensBeforeCompaction} → ${result.tokensAfterCompaction}`);
    }

    return result.compactedMessages;
  }
}