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
    const systemPrompt = `Analyze user requests to determine intent and required tools.

## Response Format

Respond with JSON only:

{
  "primaryIntent": "Clear description of the user's goal",
  "confidence": 0.8,
  "requiredTools": ["tool1", "tool2"],
  "suggestedApproach": "Brief step-by-step plan",
  "complexity": "simple|moderate|complex",
  "estimatedSteps": 3
}

## Guidelines

1. For workspace/code/file operations: include explore_workspace first, then search_code
2. Select only tools that add value to completing the task
3. Provide realistic confidence based on request clarity
4. Keep suggestedApproach concise and actionable
5. Respond in the same language as the user's request

## Available Tools

${availableTools.join(', ')}

## Examples

Request: "find authentication code"
Response: {"primaryIntent": "Locate authentication implementation", "confidence": 0.9, "requiredTools": ["search_code"], "suggestedApproach": "Search for auth patterns and analyze found files", "complexity": "simple", "estimatedSteps": 2}

Request: "fix login bug"
Response: {"primaryIntent": "Debug and fix login functionality", "confidence": 0.8, "requiredTools": ["search_code", "read_file", "update_file"], "suggestedApproach": "Search login code, analyze implementation, identify and fix issues", "complexity": "moderate", "estimatedSteps": 4}`;

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

    const needsWorkspaceUnderstanding =
      lowerRequest.includes('workspace') ||
      lowerRequest.includes('project') ||
      lowerRequest.includes('codebase') ||
      lowerRequest.includes('repository') ||
      lowerRequest.includes('repo') ||
      lowerRequest.includes('analyse') ||
      lowerRequest.includes('analyze') ||
      lowerRequest.includes('understand') ||
      lowerRequest.includes('explore') ||
      lowerRequest.includes('structure') ||
      lowerRequest.includes('overview');

    if ((needsWorkspaceUnderstanding || needsCodeContext) && availableTools.includes('explore_workspace')) {
      requiredTools.push('explore_workspace');
    }

    if (needsCodeContext && availableTools.includes('search_code')) {
      requiredTools.push('search_code');
    }

    if (lowerRequest.includes('file') || lowerRequest.includes('read') || lowerRequest.includes('write')) {
      if (!requiredTools.includes('search_code') && availableTools.includes('search_code')) {
        requiredTools.push('search_code');
      }
      requiredTools.push('read_file', 'write_file', 'file_exists');
    }
    if (lowerRequest.includes('directory') || lowerRequest.includes('folder') || needsWorkspaceUnderstanding) {
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
      suggestedApproach: needsWorkspaceUnderstanding || needsCodeContext
        ? 'Explore workspace to understand structure, then search relevant code and act'
        : 'Analyze request and use appropriate tools',
      complexity: 'moderate',
      estimatedSteps: needsWorkspaceUnderstanding || needsCodeContext ? 3 : 2
    };
  }
}
