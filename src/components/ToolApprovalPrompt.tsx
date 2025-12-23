import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface DiffLine {
  lineNumber: number | null;
  content: string;
  type: 'add' | 'remove' | 'context' | 'empty';
}

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
  const [isTyping, setIsTyping] = useState(false);
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
    'Yes, allow all edits during this session',
    'Write here what you want Mosaic to do differently.'
  ];

  useInput((input, key) => {
    if (isTyping) {
      if (key.return) {
        setIsTyping(false);
        if (customInput.trim()) {
          onModify(customInput.trim());
        }
      } else if (key.escape) {
        setIsTyping(false);
        setCustomInput('');
      }
      return;
    }

    if (key.escape) {
      onReject();
    } else if (key.upArrow) {
      setSelectedOption(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setSelectedOption(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      if (selectedOption === 0) {
        onApprove();
      } else if (selectedOption === 1) {
        onApproveAll();
      } else if (selectedOption === 2) {
        setIsTyping(true);
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
                {selectedOption === index ? '  ❯ ' : '    '}{index + 1}. {option}
              </Text>
            </Box>
          ))}
        </Box>

        {isTyping && (
          <Box>
            <Text color={theme.colors.text}>  {'> '}</Text>
            <TextInput
              value={customInput}
              onChange={setCustomInput}
              placeholder="Type your instructions here..."
            />
          </Box>
        )}
      </Box>

      <Box>
        <Text color={theme.colors.secondary}>  Esc to cancel</Text>
      </Box>
    </Box>
  );
};

export default ToolApprovalPrompt;