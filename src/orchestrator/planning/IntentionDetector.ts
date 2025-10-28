import { AIProvider, Message } from '../../services/aiProvider.js';

export interface IntentionAnalysis {
  primaryIntent: string;
  confidence: number;
  requiredTools: string[];
  suggestedApproach: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedSteps: number;
}

export class IntentionDetector {
  private aiProvider: AIProvider;

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;
  }

  async analyzeIntent(userRequest: string, availableTools: string[]): Promise<IntentionAnalysis> {
    const systemPrompt = `You are an AI assistant that analyzes user requests and determines the best approach to fulfill them.

Available tools: ${availableTools.join(', ')}

IMPORTANT: For requests involving code, files, or system functionality, you should ALWAYS include 'search_code' as the FIRST required tool to understand context before taking action.

Analyze the user's request and provide a JSON response with:
- primaryIntent: A brief description of what the user wants
- confidence: A number from 0 to 1 indicating your confidence
- requiredTools: Array of tool names needed (only from available tools). If the request involves code/files, START with 'search_code'
- suggestedApproach: A brief explanation of how to approach this task, emphasizing context-gathering first
- complexity: Either "simple", "moderate", or "complex"
- estimatedSteps: Number of steps you think this will take (include search steps)

Example for "fix the login bug":
{
  "primaryIntent": "Fix authentication bug in login functionality",
  "confidence": 0.8,
  "requiredTools": ["search_code", "read_file", "write_file"],
  "suggestedApproach": "First search for login/auth files, read relevant code, identify bug, then fix",
  "complexity": "moderate",
  "estimatedSteps": 4
}

Respond ONLY with valid JSON, no additional text.`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this request: "${userRequest}"` }
    ];

    const response = await this.aiProvider.sendMessage(messages);

    if (response.error) {
      return this.getDefaultAnalysis(userRequest, availableTools);
    }

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          primaryIntent: analysis.primaryIntent || 'Unknown intent',
          confidence: analysis.confidence || 0.5,
          requiredTools: analysis.requiredTools || [],
          suggestedApproach: analysis.suggestedApproach || 'Direct approach',
          complexity: analysis.complexity || 'moderate',
          estimatedSteps: analysis.estimatedSteps || 1
        };
      }
    } catch {
    }

    return this.getDefaultAnalysis(userRequest, availableTools);
  }

  private getDefaultAnalysis(request: string, availableTools: string[]): IntentionAnalysis {
    const lowerRequest = request.toLowerCase();
    const requiredTools: string[] = [];

    const needsCodeContext =
      lowerRequest.includes('code') ||
      lowerRequest.includes('file') ||
      lowerRequest.includes('function') ||
      lowerRequest.includes('class') ||
      lowerRequest.includes('bug') ||
      lowerRequest.includes('fix') ||
      lowerRequest.includes('add') ||
      lowerRequest.includes('implement') ||
      lowerRequest.includes('change') ||
      lowerRequest.includes('update');

    if (needsCodeContext && availableTools.includes('search_code')) {
      requiredTools.push('search_code');
    }

    if (lowerRequest.includes('file') || lowerRequest.includes('read') || lowerRequest.includes('write')) {
      if (!requiredTools.includes('search_code') && availableTools.includes('search_code')) {
        requiredTools.push('search_code');
      }
      requiredTools.push('read_file', 'write_file', 'file_exists');
    }
    if (lowerRequest.includes('directory') || lowerRequest.includes('folder')) {
      requiredTools.push('list_directory', 'create_directory');
    }
    if (lowerRequest.includes('execute') || lowerRequest.includes('run') || lowerRequest.includes('command')) {
      requiredTools.push('execute_shell');
    }
    if (lowerRequest.includes('search') || lowerRequest.includes('find')) {
      if (!requiredTools.includes('search_code')) {
        requiredTools.push('search_code');
      }
    }

    return {
      primaryIntent: 'Process user request',
      confidence: 0.6,
      requiredTools: requiredTools.length > 0 ? requiredTools : availableTools.slice(0, 3),
      suggestedApproach: needsCodeContext
        ? 'First search for relevant code/files to understand context, then take action'
        : 'Analyze request and use appropriate tools',
      complexity: 'moderate',
      estimatedSteps: needsCodeContext ? 3 : 2
    };
  }
}
