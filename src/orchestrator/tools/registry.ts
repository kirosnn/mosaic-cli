import { Tool, ToolResult, AgentContext } from '../types.js';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  get(toolName: string): Tool | undefined {
    return this.tools.get(toolName);
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  async execute(
    toolName: string,
    parameters: Record<string, any>,
    context: AgentContext,
    timeout?: number
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolName} not found`
      };
    }

    const validationError = this.validateParameters(tool, parameters);
    if (validationError) {
      return {
        success: false,
        error: validationError
      };
    }

    try {
      if (timeout) {
        return await this.executeWithTimeout(tool, parameters, context, timeout);
      }
      return await tool.execute(parameters, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during tool execution'
      };
    }
  }

  private validateParameters(tool: Tool, parameters: Record<string, any>): string | null {
    for (const param of tool.parameters) {
      if (param.required && !(param.name in parameters)) {
        return `Missing required parameter: ${param.name}`;
      }

      if (param.name in parameters) {
        const value = parameters[param.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (actualType !== param.type) {
          return `Invalid type for parameter ${param.name}: expected ${param.type}, got ${actualType}`;
        }
      }
    }

    return null;
  }

  private async executeWithTimeout(
    tool: Tool,
    parameters: Record<string, any>,
    context: AgentContext,
    timeout: number
  ): Promise<ToolResult> {
    return Promise.race([
      tool.execute(parameters, context),
      new Promise<ToolResult>((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      )
    ]).catch((error) => ({
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed'
    }));
  }

  getToolSchema(toolName: string): object | null {
    const tool = this.tools.get(toolName);
    if (!tool) return null;

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          tool.parameters.map(param => [
            param.name,
            {
              type: param.type,
              description: param.description,
              default: param.default
            }
          ])
        ),
        required: tool.parameters.filter(p => p.required).map(p => p.name)
      }
    };
  }

  getAllToolSchemas(): object[] {
    return this.listNames().map(name => this.getToolSchema(name)).filter(s => s !== null) as object[];
  }
}
