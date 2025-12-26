import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import CustomTextInput from './CustomTextInput.js';
import { DiffLine } from '../types/toolExecution.js';

interface ToolApprovalPromptProps {
  toolName: string;
  filePath: string;
  diffLines: DiffLine[];
  theme: any;
  terminalWidth: number;
  onApprove: () => void;
  onReject: () => void;
  onApproveAll: () => void;
  onModify: (instructions: string) => void;
}

const ToolApprovalPrompt: React.FC<ToolApprovalPromptProps> = ({
  toolName,
  filePath,
  diffLines,
  theme,
  terminalWidth,
  onApprove,
  onReject,
  onApproveAll,
  onModify
}) => {
  const [selectedOption, setSelectedOption] = useState(0);
  const [customInput, setCustomInput] = useState('');

  const toolDisplayNames: Record<string, string> = {
    'write_file': 'Write file',
    'update_file': 'Edit file',
    'delete_file': 'Delete file',
    'execute_shell': 'Execute bash command'
  };

  const displayName = toolDisplayNames[toolName] || toolName;

  const options = [
    'Yes',
    'Yes, allow all edits during this session'
  ];

  useInput((input, key) => {
    if (selectedOption === 2) {
      if (key.return && customInput.trim()) {
        onModify(customInput.trim());
        return;
      } else if (key.escape) {
        if (customInput) {
          setCustomInput('');
        } else {
          onReject();
        }
        return;
      } else if (key.upArrow && !customInput) {
        setSelectedOption(1);
        return;
      }
      return;
    }

    if (key.escape) {
      onReject();
    } else if (key.upArrow) {
      setSelectedOption(prev => (prev > 0 ? prev - 1 : 2));
    } else if (key.downArrow) {
      setSelectedOption(prev => (prev < 2 ? prev + 1 : 0));
    } else if (key.return) {
      if (selectedOption === 0) {
        onApprove();
      } else if (selectedOption === 1) {
        onApproveAll();
      }
    } else if (key.tab && key.shift) {
      onApproveAll();
    }
  });

  const renderDiffLine = (line: DiffLine, index: number) => {
    const lineNumStr = line.lineNumber !== null ? String(line.lineNumber).padStart(4, ' ') : '    ';
    const contentWidth = terminalWidth - 5;
    const lineContent = `${lineNumStr} ${line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '} ${line.content}`;
    const paddedLine = lineContent.padEnd(contentWidth, ' ');

    if (line.type === 'empty') {
      return (
        <Box key={index}>
          <Text color={theme.colors.secondary}>{lineNumStr}   {line.content}</Text>
        </Box>
      );
    }

    if (line.type === 'add') {
      return (
        <Box key={index}>
          <Text color={theme.code.added} backgroundColor={theme.code.addedBg}>{paddedLine}</Text>
        </Box>
      );
    }

    if (line.type === 'remove') {
      return (
        <Box key={index}>
          <Text color={theme.code.removed} backgroundColor={theme.code.removedBg}>{paddedLine}</Text>
        </Box>
      );
    }

    return (
      <Box key={index}>
        <Text color={theme.colors.text}>{lineNumStr}   {line.content}</Text>
      </Box>
    );
  };

  const horizontalLine = '─'.repeat(terminalWidth - 4);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.colors.accent}>{horizontalLine}</Text>
      </Box>

      <Box>
        <Text color={theme.colors.text}>  {displayName} {filePath}</Text>
      </Box>

      <Box>
        <Text color={theme.colors.secondary}>{horizontalLine}</Text>
      </Box>

      <Box flexDirection="column" paddingLeft={1}>
        {diffLines.slice(0, 50).map((line, index) => renderDiffLine(line, index))}
        {diffLines.length > 50 && (
          <Box>
            <Text color={theme.colors.secondary}>  ... ({diffLines.length - 50} more lines)</Text>
          </Box>
        )}
      </Box>

      <Box>
        <Text color={theme.colors.secondary}>{horizontalLine}</Text>
      </Box>

      <Box flexDirection="column" paddingLeft={1}>
        <Text color={theme.colors.text}>  Do you want to make this edit to {filePath}?</Text>
        <Box flexDirection="column">
          {options.map((option, index) => (
            <Box key={index}>
              <Text color={selectedOption === index ? theme.colors.accent : theme.colors.text}>
                {selectedOption === index ? '  > ' : '    '}{index + 1}. {option}
              </Text>
            </Box>
          ))}
          <Box>
            <Text color={selectedOption === 2 ? theme.colors.accent : theme.colors.text}>
              {selectedOption === 2 ? '  > ' : '    '}3.{' '}
            </Text>
            <Text dimColor={true}>
              <CustomTextInput
                value={customInput}
                onChange={setCustomInput}
                onSubmit={(value) => {
                  if (value.trim()) {
                    onModify(value.trim());
                  }
                }}
                placeholder="Write here what you want Mosaic to do differently."
                focus={selectedOption === 2}
              />
            </Text>
          </Box>
        </Box>
      </Box>

      <Box>
        <Text color={theme.colors.secondary}>  Esc to cancel</Text>
      </Box>
    </Box>
  );
};

export default ToolApprovalPrompt;