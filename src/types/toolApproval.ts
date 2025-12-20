export interface ToolApprovalRequest {
  toolName: string;
  parameters: Record<string, any>;
  preview: string;
  onApprove: () => void;
  onReject: () => void;
}

export const TOOLS_REQUIRING_APPROVAL = [
  'write_file',
  'update_file',
  'delete_file',
  'create_directory',
  'execute_shell'
];

export const needsApproval = (toolName: string): boolean => {
  return TOOLS_REQUIRING_APPROVAL.includes(toolName);
};