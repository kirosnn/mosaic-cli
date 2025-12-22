import { useState, useCallback, useRef } from 'react';
import { useInput } from 'ink';
import { ToolApprovalRequest, needsApproval } from '../types/toolApproval.js';
import { generateToolPreview, generateToolPreviewData } from '../utils/diffFormatter.js';
import { formatToolName, formatToolResult } from '../utils/toolFormatters.js';
import { ToolExecution } from '../types/toolExecution.js';

interface UseToolApprovalOptions {
  onToolStart?: (tool: ToolExecution) => void;
  onToolComplete?: (tool: ToolExecution) => void;
}

export function useToolApproval(options: UseToolApprovalOptions = {}) {
  const [pendingApproval, setPendingApproval] = useState<ToolApprovalRequest | null>(null);
  const approveAllSession = useRef<boolean>(false);

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

      if (needsApproval(toolName) && !approveAllSession.current) {
        const preview = await generateToolPreview(toolName, parameters);
        const previewData = await generateToolPreviewData(toolName, parameters);

        const approval = await new Promise<{ approved: boolean; approveAll: boolean; modify?: string }>((resolve) => {
          const approvalRequest: ToolApprovalRequest = {
            toolName,
            parameters,
            preview,
            previewData,
            onApprove: () => resolve({ approved: true, approveAll: false }),
            onReject: () => resolve({ approved: false, approveAll: false }),
            onApproveAll: () => {
              approveAllSession.current = true;
              resolve({ approved: true, approveAll: true });
            },
            onModify: (instructions: string) => {
              resolve({ approved: false, approveAll: false, modify: instructions });
            }
          };
          setPendingApproval(approvalRequest);
        });

        setPendingApproval(null);

        if (approval.modify) {
          const toolIndex = executedTools.findIndex(
            tool => tool.name === toolName && tool.status === 'running'
          );

          if (toolIndex !== -1) {
            executedTools[toolIndex] = {
              ...executedTools[toolIndex],
              status: 'error',
              result: `User requested modification: ${approval.modify}`
            };
            options.onToolComplete?.(executedTools[toolIndex]);
          }

          return {
            success: false,
            error: `User requested modification: ${approval.modify}`
          };
        }

        if (!approval.approved) {
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
