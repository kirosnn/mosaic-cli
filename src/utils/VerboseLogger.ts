import chalk from 'chalk';
import { OrchestratorEvent } from '../orchestrator/types.js';

export class VerboseLogger {
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  log(event: OrchestratorEvent): void {
    if (!this.enabled) return;

    const timestamp = new Date().toLocaleTimeString();

    switch (event.type) {
      case 'iteration_start':
        console.log(chalk.blue(`\n[${timestamp}] ${chalk.bold(`Iteration ${event.data.iteration}/${event.data.maxIterations}`)}`));
        break;

      case 'ai_thinking':
        console.log(chalk.cyan(`[${timestamp}] ${event.data.message}`));
        break;

      case 'ai_response':
        const content = event.data.content;
        const preview = content.length > 150 ? content.substring(0, 150) + '...' : content;
        console.log(chalk.gray(`[${timestamp}] AI Response: ${preview}`));
        break;

      case 'tool_call_detected':
        console.log(chalk.yellow(`[${timestamp}] ${chalk.bold(`Detected ${event.data.count} tool call(s):`)} ${event.data.tools.join(', ')}`));
        break;

      case 'tool_executing':
        console.log(chalk.magenta(`[${timestamp}] ${chalk.bold(`Executing:`)} ${event.data.toolName}`));
        if (Object.keys(event.data.parameters).length > 0) {
          console.log(chalk.gray(`  Parameters: ${JSON.stringify(event.data.parameters, null, 2)}`));
        }
        break;

      case 'tool_success':
        console.log(chalk.green(`[${timestamp}] ${chalk.bold('Success:')} ${event.data.toolName}`));
        if (event.data.result) {
          const resultStr = typeof event.data.result === 'string'
            ? event.data.result
            : JSON.stringify(event.data.result, null, 2);
          const resultPreview = resultStr.length > 200 ? resultStr.substring(0, 200) + '...' : resultStr;
          console.log(chalk.gray(`  Result: ${resultPreview}`));
        }
        break;

      case 'tool_error':
        console.log(chalk.red(`[${timestamp}] ${chalk.bold('Error:')} ${event.data.toolName}`));
        console.log(chalk.red(`  ${event.data.error}`));
        break;

      case 'final_response':
        console.log(chalk.green(`\n[${timestamp}] ${chalk.bold('Final Response Ready')}`));
        break;

      case 'error':
        console.log(chalk.red(`[${timestamp}] ${chalk.bold('Error:')} ${event.data.error}`));
        break;

      default:
        console.log(chalk.white(`[${timestamp}] ${event.type}: ${JSON.stringify(event.data)}`));
    }
  }

  logMessage(message: string, color: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (!this.enabled) return;

    const timestamp = new Date().toLocaleTimeString();
    const colorFn = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    }[color];

    console.log(colorFn(`[${timestamp}] ${message}`));
  }
}