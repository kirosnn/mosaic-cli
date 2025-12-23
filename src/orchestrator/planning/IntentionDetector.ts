import { AIProvider, Message } from '../../services/aiProvider.js';

export interface IntentionAnalysis {
  primaryIntent: string;
  confidence: number;
  requiredTools: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedSteps: number;
}

export class IntentionDetector {
  private aiProvider: AIProvider;
  private reportTokenUsage?: (tokens: number, source: string) => void;

  constructor(aiProvider: AIProvider, reportTokenUsage?: (tokens: number, source: string) => void) {
    this.aiProvider = aiProvider;
    this.reportTokenUsage = reportTokenUsage;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async analyzeIntent(userRequest: string, availableTools: string[]): Promise<IntentionAnalysis> {
    const systemPrompt = `
Classify the user's request.

Return JSON only.

{
  "primaryIntent": string,
  "confidence": number,
  "requiredTools": string[],
  "complexity": "simple" | "moderate" | "complex",
  "estimatedSteps": number
}

Rules:
- If the request can be answered without tools, requiredTools must be []
- Select only strictly necessary tools
- "simple" = no file changes, no multi-step reasoning
- "moderate" = reading/searching files
- "complex" = planning, refactors, multiple dependent actions
- Respond in the user's language
`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userRequest }
    ];

    const response = await this.aiProvider.sendMessage(messages);

    const promptText = messages.map(m => m.content).join('\n');
    const promptTokens = this.estimateTokens(promptText);
    const responseTokens = this.estimateTokens(response.content || '');
    this.reportTokenUsage?.(promptTokens + responseTokens, 'intention_analysis');

    if (response.error || !response.content) {
      return this.getFallbackAnalysis();
    }

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.getFallbackAnalysis();

      const analysis = JSON.parse(jsonMatch[0]);

      return {
        primaryIntent: analysis.primaryIntent ?? 'Unknown',
        confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.5,
        requiredTools: Array.isArray(analysis.requiredTools) ? analysis.requiredTools : [],
        complexity: analysis.complexity ?? 'simple',
        estimatedSteps: typeof analysis.estimatedSteps === 'number' ? analysis.estimatedSteps : 1
      };
    } catch {
      return this.getFallbackAnalysis();
    }
  }

  private getFallbackAnalysis(): IntentionAnalysis {
    return {
      primaryIntent: 'Respond to user',
      confidence: 0.4,
      requiredTools: [],
      complexity: 'simple',
      estimatedSteps: 1
    };
  }
}