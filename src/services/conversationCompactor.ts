import { Message } from './aiProvider.js';
import { verboseLogger } from '../utils/VerboseLogger.js';

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
 * 1. Monitor token usage (triggers at 40% of effective limit)
 * 2. Keep recent messages intact (20% of conversation, minimum 4 messages)
 * 3. Summarize older messages into a compact context block
 * 4. Apply aggressive compaction if needed (multiple reduction attempts)
 * 5. Emergency fallback: keep only system message + last user message
 *
 * This ensures the model always has context while avoiding empty responses
 * due to token limit exhaustion.
 */
export class ConversationCompactor {
  private readonly TOKEN_RATIO = 4;
  private readonly PROGRESSIVE_COMPACTION_BLOCK_SIZE = 10;
  private summaryLevels: Map<number, Message> = new Map();

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

  private createSummaryMessage(messagesToSummary: Message[], level: number = 0): Message {
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
    const levelIndicator = level > 0 ? ` [Level ${level} Summary]` : '';

    const summary = `[CONVERSATION CONTEXT - Auto-compacted to save tokens]${levelIndicator}

${messagesToSummary.length} messages compacted (${userQuestions} questions, ${assistantResponses} responses)

Recent exchanges before current context:
${topExchanges}

[Conversation continues with recent messages below]`;

    return {
      role: 'system',
      content: summary
    };
  }

  private progressiveCompact(messages: Message[], effectiveLimit: number): Message[] {
    const systemMessage = messages.find(msg => msg.role === 'system');
    const otherMessages = messages.filter(msg => msg.role !== 'system' && !msg.content.includes('[CONVERSATION CONTEXT'));

    if (otherMessages.length <= this.PROGRESSIVE_COMPACTION_BLOCK_SIZE) {
      return messages;
    }

    const compactedBlocks: Message[] = [];
    const blockCount = Math.floor(otherMessages.length / this.PROGRESSIVE_COMPACTION_BLOCK_SIZE);

    for (let i = 0; i < blockCount; i++) {
      const blockStart = i * this.PROGRESSIVE_COMPACTION_BLOCK_SIZE;
      const blockEnd = blockStart + this.PROGRESSIVE_COMPACTION_BLOCK_SIZE;
      const block = otherMessages.slice(blockStart, blockEnd);

      const blockSummary = this.createSummaryMessage(block, 1);
      compactedBlocks.push(blockSummary);
    }

    const remainingMessages = otherMessages.slice(blockCount * this.PROGRESSIVE_COMPACTION_BLOCK_SIZE);

    const result: Message[] = [];
    if (systemMessage) result.push(systemMessage);
    result.push(...compactedBlocks);
    result.push(...remainingMessages);

    return result;
  }

  private createHierarchicalSummary(summaries: Message[], level: number): Message {
    const totalMessages = summaries.reduce((sum, s) => {
      const match = s.content.match(/(\d+) messages compacted/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);

    const allExchanges: string[] = [];
    for (const summary of summaries) {
      const exchangeMatch = summary.content.match(/Recent exchanges before current context:\n([\s\S]*?)\n\[Conversation continues/);
      if (exchangeMatch) {
        allExchanges.push(exchangeMatch[1]);
      }
    }

    const consolidatedExchanges = allExchanges.join('\n\n').split('\n\n').slice(0, 5).join('\n\n');

    const hierarchicalSummary = `[HIERARCHICAL SUMMARY - Level ${level}]

${summaries.length} previous summaries consolidated (${totalMessages} total messages)

Key conversation themes:
${consolidatedExchanges}

[Conversation continues with recent context below]`;

    return {
      role: 'system',
      content: hierarchicalSummary
    };
  }

  private applyHierarchicalCompaction(messages: Message[], effectiveLimit: number): Message[] {
    const systemMessage = messages.find(msg => msg.role === 'system' && !msg.content.includes('[CONVERSATION CONTEXT') && !msg.content.includes('[HIERARCHICAL SUMMARY'));
    const summaryMessages = messages.filter(msg =>
      msg.role === 'system' && (msg.content.includes('[CONVERSATION CONTEXT') || msg.content.includes('[HIERARCHICAL SUMMARY'))
    );
    const otherMessages = messages.filter(msg =>
      msg.role !== 'system' || (!msg.content.includes('[CONVERSATION CONTEXT') && !msg.content.includes('[HIERARCHICAL SUMMARY'))
    );

    if (summaryMessages.length <= 3) {
      return messages;
    }

    const summariesToCompact = summaryMessages.slice(0, -2);
    const recentSummaries = summaryMessages.slice(-2);

    const currentLevel = Math.max(
      ...summaryMessages.map(s => {
        const match = s.content.match(/Level (\d+)/);
        return match ? parseInt(match[1]) : 0;
      }),
      0
    );

    const hierarchicalSummary = this.createHierarchicalSummary(summariesToCompact, currentLevel + 1);

    const result: Message[] = [];
    if (systemMessage) result.push(systemMessage);
    result.push(hierarchicalSummary);
    result.push(...recentSummaries);
    result.push(...otherMessages);

    verboseLogger.logMessage(`[ConversationCompactor] Applied hierarchical compaction at level ${currentLevel + 1}`, 'info');

    return result;
  }

  compactIfNeeded(
    messages: Message[],
    maxTokens: number,
    reservedForResponse: number
  ): CompactionResult {
    const effectiveLimit = maxTokens - reservedForResponse;

    let workingMessages = messages;
    const summaryMessages = messages.filter(msg =>
      msg.role === 'system' && (msg.content.includes('[CONVERSATION CONTEXT') || msg.content.includes('[HIERARCHICAL SUMMARY'))
    );

    if (summaryMessages.length > 3) {
      verboseLogger.logMessage('[ConversationCompactor] Applying hierarchical compaction', 'info');
      workingMessages = this.applyHierarchicalCompaction(workingMessages, effectiveLimit);
    }

    const systemMessage = workingMessages.find(msg => msg.role === 'system' && !msg.content.includes('[CONVERSATION CONTEXT') && !msg.content.includes('[HIERARCHICAL SUMMARY'));
    const otherMessages = workingMessages.filter(msg => msg.role !== 'system' || msg.content.includes('[CONVERSATION CONTEXT') || msg.content.includes('[HIERARCHICAL SUMMARY'));

    let totalTokens = 0;
    for (const msg of workingMessages) {
      totalTokens += this.estimateTokens(msg.content);
    }

    const tokensBeforeCompaction = totalTokens;

    if (totalTokens <= effectiveLimit * 0.4) {
      return {
        compactedMessages: workingMessages,
        tokensBeforeCompaction,
        tokensAfterCompaction: totalTokens,
        messagesCompacted: 0
      };
    }

    const nonSystemMessages = otherMessages.filter(msg => !msg.content.includes('[CONVERSATION CONTEXT') && !msg.content.includes('[HIERARCHICAL SUMMARY'));
    const summaryMsgs = otherMessages.filter(msg => msg.content.includes('[CONVERSATION CONTEXT') || msg.content.includes('[HIERARCHICAL SUMMARY'));

    const recentMessagesToKeep = Math.max(4, Math.floor(nonSystemMessages.length * 0.2));
    const recentMessages = nonSystemMessages.slice(-recentMessagesToKeep);
    const oldMessages = nonSystemMessages.slice(0, -recentMessagesToKeep);

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
    compactedMessages.push(...summaryMsgs);
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
          verboseLogger.logMessage(`[ConversationCompactor] Applied aggressive compaction (attempt ${attempts + 1})`, 'warning');
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
        verboseLogger.logMessage('[ConversationCompactor] CRITICAL: Unable to fit conversation within token limit even after aggressive compaction', 'error');

        const emergencyMessages: Message[] = [];
        if (systemMessage) emergencyMessages.push(systemMessage);

        const allOtherMessages = [...nonSystemMessages, ...summaryMsgs];
        const lastUserMessage = allOtherMessages.filter(m => m.role === 'user').slice(-1)[0];
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
      verboseLogger.logMessage(`[ConversationCompactor] Compacted ${result.messagesCompacted} messages`, 'info');
      verboseLogger.logMessage(`[ConversationCompactor] Tokens: ${result.tokensBeforeCompaction} → ${result.tokensAfterCompaction}`, 'info');
    }

    return result.compactedMessages;
  }
}