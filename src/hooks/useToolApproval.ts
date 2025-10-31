import { useState, useCallback } from 'react';
import { useInput } from 'ink';
import { ToolApprovalRequest, needsApproval } from '../types/toolApproval.js';
import { generateToolPreview } from '../utils/diffFormatter.js';
import { formatToolName, formatToolResult } from '../utils/toolFormatters.js';
import { ToolExecution } from '../types/toolExecution.js';

interface UseToolApprovalOptions {
  onToolStart?: (tool: ToolExecution) => void;
  onToolComplete?: (tool: ToolExecution) => void;
}

export function useToolApproval(options: UseToolApprovalOptions = {}) {
  const [pendingApproval, setPendingApproval] = useState<ToolApprovalRequest | null>(null);

  useInput((inputChar, key) => {
    if (pendingApproval) {
      if (inputChar === 'y' || inputChar === 'Y') {
        pendingApproval.onApprove();
        setPendingApproval(null);
      } else if (inputChar === 'n' || inputChar === 'N' || key.escape) {
        pendingApproval.onReject();
        setPendingApproval(null);
      }
    }
  });

  const wrapToolExecution = useCallback((
    originalExecute: (toolName: string, parameters: Record<string, any>, context: any, timeout?: number) => Promise<any>,
    executedTools: ToolExecution[]
  ) => {
    return async (toolName: string, parameters: Record<string, any>, context: any, timeout?: number) => {
      const displayName = formatToolName(toolName);

      const newTool: ToolExecution = {
        name: toolName,
        displayName: displayName,
        status: 'running',
        parameters: parameters
      };

      executedTools.push(newTool);
      options.onToolStart?.(newTool);

      if (needsApproval(toolName)) {
        const preview = await generateToolPreview(toolName, parameters);

        const approved = await new Promise<boolean>((resolve) => {
          const approvalRequest: ToolApprovalRequest = {
            toolName,
            parameters,
            preview,
            onApprove: () => resolve(true),
            onReject: () => resolve(false)
          };
          setPendingApproval(approvalRequest);
        });

        if (!approved) {
          const toolIndex = executedTools.findIndex(
            tool => tool.name === toolName && tool.status === 'running'
          );

          if (toolIndex !== -1) {
            executedTools[toolIndex] = {
              ...executedTools[toolIndex],
              status: 'error',
              result: 'Rejected by user'
            };
            options.onToolComplete?.(executedTools[toolIndex]);
          }

          return {
            success: false,
            error: 'Tool execution rejected by user'
          };
        }
      }

      const result = await originalExecute(toolName, parameters, context, timeout);

      const toolIndex = executedTools.findIndex(
        tool => tool.name === toolName && tool.status === 'running'
      );

      if (toolIndex !== -1) {
        executedTools[toolIndex] = {
          ...executedTools[toolIndex],
          status: result.success ? 'completed' : 'error',
          result: formatToolResult(toolName, result.data || result.error, parameters)
        };
        options.onToolComplete?.(executedTools[toolIndex]);
      }

      return result;
    };
  }, [options]);

  return {
    pendingApproval,
    wrapToolExecution
  };
}
