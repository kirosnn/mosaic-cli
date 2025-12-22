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

  private reportTokenUsage?: (tokens: number, source: string) => void;

  constructor(aiProvider: AIProvider, reportTokenUsage?: (tokens: number, source: string) => void) {
    this.aiProvider = aiProvider;
    this.reportTokenUsage = reportTokenUsage;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
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

1. For targeted operations: prefer search_code + read_file over explore_workspace
2. Only suggest explore_workspace when user explicitly asks for workspace overview/structure
3. Select only tools that add value to completing the task
4. Provide realistic confidence based on request clarity
5. Keep suggestedApproach concise and actionable
6. Respond in the same language as the user's request

## Available Tools

${availableTools.join(', ')}

## Examples

Request: "find authentication code"
Response: {"primaryIntent": "Locate authentication implementation", "confidence": 0.9, "requiredTools": ["search_code", "read_file"], "suggestedApproach": "Search for auth patterns and analyze found files", "complexity": "simple", "estimatedSteps": 2}

Request: "fix login bug"
Response: {"primaryIntent": "Debug and fix login functionality", "confidence": 0.8, "requiredTools": ["search_code", "read_file", "update_file"], "suggestedApproach": "Search login code, read file, identify issues, apply fix with update_file", "complexity": "moderate", "estimatedSteps": 4}

Request: "modify config.json to add new setting"
Response: {"primaryIntent": "Update configuration file", "confidence": 0.9, "requiredTools": ["read_file", "update_file"], "suggestedApproach": "Read current config, apply modifications with update_file", "complexity": "simple", "estimatedSteps": 2}

Request: "analyze project structure"
Response: {"primaryIntent": "Understand workspace organization", "confidence": 0.9, "requiredTools": ["explore_workspace"], "suggestedApproach": "Use explore_workspace with default parameters for overview", "complexity": "simple", "estimatedSteps": 1}`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this request: "${userRequest}"` }
    ];

    const response = await this.aiProvider.sendMessage(messages);

    const promptText = messages.map(m => m.content).join('\n');
    const promptTokens = this.estimateTokens(promptText);
    const responseTokens = this.estimateTokens(response.content || '');
    this.reportTokenUsage?.(promptTokens + responseTokens, 'intention_analysis');

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
      (lowerRequest.includes('workspace') && (lowerRequest.includes('analyze') || lowerRequest.includes('analyse') || lowerRequest.includes('overview') || lowerRequest.includes('structure'))) ||
      (lowerRequest.includes('project') && (lowerRequest.includes('analyze') || lowerRequest.includes('analyse') || lowerRequest.includes('overview') || lowerRequest.includes('structure'))) ||
      lowerRequest.includes('project structure') ||
      lowerRequest.includes('workspace structure') ||
      lowerRequest.includes('codebase overview') ||
      lowerRequest.includes('repository overview');

    if (needsWorkspaceUnderstanding && availableTools.includes('explore_workspace')) {
      requiredTools.push('explore_workspace');
    }

    if (needsCodeContext && availableTools.includes('search_code')) {
      requiredTools.push('search_code');
    }

    const needsFileModification =
      lowerRequest.includes('modify') ||
      lowerRequest.includes('update') ||
      lowerRequest.includes('change') ||
      lowerRequest.includes('fix') ||
      lowerRequest.includes('translate') ||
      lowerRequest.includes('refactor') ||
      lowerRequest.includes('edit');

    if (lowerRequest.includes('file') || lowerRequest.includes('read') || lowerRequest.includes('write') || needsFileModification) {
      if (!requiredTools.includes('search_code') && availableTools.includes('search_code')) {
        requiredTools.push('search_code');
      }
      requiredTools.push('read_file');

      if (needsFileModification) {
        requiredTools.push('update_file');
      } else {
        requiredTools.push('write_file');
      }

      requiredTools.push('file_exists');
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
      suggestedApproach: needsWorkspaceUnderstanding
        ? 'Use explore_workspace for overview, then proceed with task'
        : needsCodeContext
        ? 'Search relevant code, read files, and act'
        : 'Analyze request and use appropriate tools',
      complexity: 'moderate',
      estimatedSteps: needsWorkspaceUnderstanding ? 2 : needsCodeContext ? 3 : 2
    };
  }
}