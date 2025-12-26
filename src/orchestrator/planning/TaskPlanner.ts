import { AIProvider, Message } from '../../services/aiProvider.js';
import { IntentionAnalysis } from './IntentionDetector.js';
import { buildTaskPlannerSystemPrompt } from '../../config/systemPrompt.js';

export interface TaskStep {
  stepNumber: number;
  description: string;
  toolName?: string;
  parameters?: Record<string, any>;
  expectedOutput?: string;
  dependsOn?: number[];
}

export interface ExecutionPlan {
  goal: string;
  steps: TaskStep[];
  totalSteps: number;
  estimatedDuration?: string;
}

export class TaskPlanner {
  private aiProvider: AIProvider;

  private reportTokenUsage?: (tokens: number, source: string) => void;

  constructor(aiProvider: AIProvider, reportTokenUsage?: (tokens: number, source: string) => void) {
    this.aiProvider = aiProvider;
    this.reportTokenUsage = reportTokenUsage;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async createPlan(
    userRequest: string,
    intention: IntentionAnalysis,
    toolSchemas: object[]
  ): Promise<ExecutionPlan> {
    const systemPrompt = buildTaskPlannerSystemPrompt(intention, toolSchemas);

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create an execution plan for: "${userRequest}"` }
    ];

    const response = await this.aiProvider.sendMessage(messages);

    const promptText = messages.map(m => m.content).join('\n');
    const promptTokens = this.estimateTokens(promptText);
    const responseTokens = this.estimateTokens(response.content || '');
    this.reportTokenUsage?.(promptTokens + responseTokens, 'task_planning');

    if (response.error) {
      return this.getDefaultPlan(userRequest, intention);
    }

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        return {
          goal: plan.goal || userRequest,
          steps: plan.steps || [],
          totalSteps: plan.totalSteps || plan.steps?.length || 0,
          estimatedDuration: plan.estimatedDuration
        };
      }
    } catch {
    }

    return this.getDefaultPlan(userRequest, intention);
  }

  private getDefaultPlan(request: string, intention: IntentionAnalysis): ExecutionPlan {
    const steps: TaskStep[] = [];
    let stepNumber = 1;

    const hasExplore = intention.requiredTools.includes('explore_workspace');
    const hasSearchCode = intention.requiredTools.includes('search_code');
    const needsCodeContext = intention.primaryIntent.toLowerCase().includes('search') ||
                              intention.primaryIntent.toLowerCase().includes('context');

    if (hasExplore) {
      steps.push({
        stepNumber: stepNumber++,
        description: 'Explore workspace to understand project structure and key files',
        toolName: 'explore_workspace',
        parameters: {},
        expectedOutput: 'Workspace summary with structure and file previews'
      });
    }

    if (hasSearchCode && needsCodeContext) {
      steps.push({
        stepNumber: stepNumber++,
        description: 'Search codebase to understand context and locate relevant files',
        toolName: 'search_code',
        parameters: {},
        expectedOutput: 'List of relevant files and code locations'
      });
    }

    if (intention.requiredTools.length > 0) {
      intention.requiredTools.forEach((tool) => {
        if (tool === 'search_code' && steps.some(s => s.toolName === 'search_code')) {
          return;
        }
        if (tool === 'explore_workspace' && steps.some(s => s.toolName === 'explore_workspace')) {
          return;
        }

        const descriptions: Record<string, string> = {
          'read_file': 'Read and analyze relevant file contents',
          'write_file': 'Create a file with content specified in the request',
          'update_file': 'Update an existing file with new content',
          'list_directory': 'List directory contents to understand structure',
          'delete_file': 'Remove specified file',
          'file_exists': 'Verify file existence before proceeding',
          'execute_shell': 'Execute shell command to accomplish task',
          'search_code': 'Search codebase for relevant code',
          'explore_workspace': 'Explore workspace to build context',
          'fetch': 'Fetch a web page for retrieve information'
        };

        steps.push({
          stepNumber: stepNumber++,
          description: descriptions[tool] || `Use ${tool} to process the request`,
          toolName: tool,
          parameters: {},
          expectedOutput: 'Tool execution result',
          dependsOn: stepNumber > 2 ? [stepNumber - 2] : undefined
        });
      });
    } else {
      steps.push({
        stepNumber: 1,
        description: 'Analyze and respond to the request',
        expectedOutput: 'Response to user'
      });
    }

    return {
      goal: intention.primaryIntent || request,
      steps,
      totalSteps: steps.length,
      estimatedDuration: intention.complexity === 'simple' ? '10 seconds' :
                        intention.complexity === 'moderate' ? '30 seconds' : '1 minute'
    };
  }

  async refinePlan(
    originalPlan: ExecutionPlan,
    feedback: string
  ): Promise<ExecutionPlan> {
    const systemPrompt = `You are refining an execution plan based on feedback.

Original Plan:
${JSON.stringify(originalPlan, null, 2)}

Feedback: ${feedback}

Provide an improved plan as JSON with the same structure. Address the feedback while keeping the original goal.
Respond ONLY with valid JSON.`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Refine the plan based on the feedback provided.' }
    ];

    const response = await this.aiProvider.sendMessage(messages);

    const promptText = messages.map(m => m.content).join('\n');
    const promptTokens = this.estimateTokens(promptText);
    const responseTokens = this.estimateTokens(response.content || '');
    this.reportTokenUsage?.(promptTokens + responseTokens, 'task_planning_refine');

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
    }

    return originalPlan;
  }
}
