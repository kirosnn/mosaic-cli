import React from 'react';
import { Box, Text } from 'ink';

interface ToolApprovalPromptProps {
  toolName: string;
  preview: string;
  theme: any;
}

const ToolApprovalPrompt: React.FC<ToolApprovalPromptProps> = ({ toolName, preview, theme }) => {
  const toolDisplayNames: Record<string, string> = {
    'write_file': 'Write File',
    'update_file': 'Update File',
    'delete_file': 'Delete File',
    'create_directory': 'Create Directory',
    'execute_shell': 'Execute Shell Command'
  };

  const displayName = toolDisplayNames[toolName] || toolName;

  const safePreview = preview || '';
  const previewLines = safePreview.split('\n');
  const maxPreviewLines = 25;
  const truncated = previewLines.length > maxPreviewLines;
  const displayLines = truncated ? previewLines.slice(0, maxPreviewLines) : previewLines;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.accent} padding={1} marginY={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.accent}>
          Approval Required: {displayName}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {displayLines.map((line, index) => (
          <Text key={index} color={theme.colors.text}>
            {line}
          </Text>
        ))}
        {truncated && (
          <Text color={theme.colors.secondary}>
            ... ({previewLines.length - maxPreviewLines} more lines)
          </Text>
        )}
      </Box>

      <Box>
        <Text color={theme.colors.secondary}>
          Press [Y] to approve, [N] to reject
        </Text>
      </Box>
    </Box>
  );
};

export default ToolApprovalPrompt;