import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface DiffLine {
  lineNumber: number | null;
  content: string;
  type: 'add' | 'remove' | 'context' | 'empty';
}

interface ToolApprovalPromptNewProps {
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

const ToolApprovalPromptNew: React.FC<ToolApprovalPromptNewProps> = ({
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
    'execute_shell': 'Execute shell command'
  };

  const displayName = toolDisplayNames[toolName] || toolName;

  const options = [
    'Yes',
    'Yes, allow all edits during this session (shift+tab)',
    'Type here to tell Mosaic what to do differently'
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
    const lineNumStr = line.lineNumber !== null ? String(line.lineNumber) : '';
    const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
    const lineContent = `${lineNumStr} ${prefix}${line.content}`;
    const contentWidth = terminalWidth;
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

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.colors.text}>{displayName} {filePath}</Text>
      </Box>
      <Box flexDirection="column">
        {diffLines.slice(0, 50).map((line, index) => renderDiffLine(line, index))}
        {diffLines.length > 50 && (
          <Box>
            <Text color={theme.colors.secondary}>... ({diffLines.length - 50} more lines)</Text>
          </Box>
        )}
      </Box>
      <Box flexDirection="column">
        <Text color={theme.colors.text}>Do you want to make this edit to {filePath}?</Text>
        <Box flexDirection="column">
          {options.map((option, index) => (
            <Box key={index}>
              <Text color={selectedOption === index ? theme.colors.accent : theme.colors.text}>
                {selectedOption === index ? '> ' : '  '}{index + 1}. {option}
              </Text>
            </Box>
          ))}
        </Box>
        {isTyping && (
          <Box>
            <Text color={theme.colors.text}>{'> '}</Text>
            <TextInput
              value={customInput}
              onChange={setCustomInput}
              placeholder="Type your instructions here..."
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ToolApprovalPromptNew;
