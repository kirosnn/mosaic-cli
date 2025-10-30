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

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;
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

    const hasSearchCode = intention.requiredTools.includes('search_code');
    const needsCodeContext = intention.suggestedApproach.toLowerCase().includes('search') ||
                              intention.suggestedApproach.toLowerCase().includes('context');

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

        const descriptions: Record<string, string> = {
          'read_file': 'Read and analyze relevant file contents',
          'write_file': 'Create a file with content specified in the request',
          'update_file': 'Update an existing file with new content',
          'list_directory': 'List directory contents to understand structure',
          'create_directory': 'Create necessary directory structure',
          'delete_file': 'Remove specified file',
          'file_exists': 'Verify file existence before proceeding',
          'execute_shell': 'Execute shell command to accomplish task',
          'execute_node': 'Execute Node.js code for processing',
          'search_code': 'Search codebase for relevant code',
          'install_package': 'Install required npm package'
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
