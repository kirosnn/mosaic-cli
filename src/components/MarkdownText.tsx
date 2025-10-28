import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../config/themes.js';

interface MarkdownTextProps {
  content: string;
  theme: Theme;
  withBullet?: boolean;
}

const MarkdownText: React.FC<MarkdownTextProps> = ({ content, theme, withBullet = false }) => {
  const parseMarkdown = (text: string): React.ReactElement[] => {
    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];

    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <Box key={`code-${i}`} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginY={0}>
              {codeBlockLanguage && (
                <Text color={theme.colors.secondary} dimColor>{codeBlockLanguage}</Text>
              )}
              {codeBlockContent.map((codeLine, idx) => (
                <Text key={idx} color={theme.colors.accent}>{codeLine}</Text>
              ))}
            </Box>
          );
          codeBlockContent = [];
          codeBlockLanguage = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeBlockLanguage = line.substring(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      const processedLine = processInlineMarkdown(line, theme);

      if (line.startsWith('# ')) {
        elements.push(
          <Text key={i} bold color={theme.colors.primary}>{line.substring(2)}</Text>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <Text key={i} bold color={theme.colors.primary}>{line.substring(3)}</Text>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <Text key={i} bold color={theme.colors.secondary}>{line.substring(4)}</Text>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const listContent = line.substring(2);
        elements.push(
          <Box key={i}>
            <Text color={theme.colors.accent}>  • </Text>
            {processInlineMarkdown(listContent, theme)}
          </Box>
        );
      } else if (/^\d+\.\s/.test(line)) {
        const match = line.match(/^(\d+)\.\s(.*)$/);
        if (match) {
          elements.push(
            <Box key={i}>
              <Text color={theme.colors.accent}>  {match[1]}. </Text>
              {processInlineMarkdown(match[2], theme)}
            </Box>
          );
        }
      } else if (line.startsWith('>')) {
        elements.push(
          <Box key={i} borderStyle="single" borderColor="gray" borderLeft paddingLeft={1}>
            <Text color={theme.colors.secondary} italic>{line.substring(1).trim()}</Text>
          </Box>
        );
      } else if (line.trim() === '') {
        elements.push(<Text key={i}>{' '}</Text>);
      } else {
        elements.push(
          <Box key={i}>
            {processedLine}
          </Box>
        );
      }
    }

    return elements;
  };

  const processInlineMarkdown = (text: string, theme: Theme): React.ReactElement => {
    const parts: (string | React.ReactElement)[] = [];
    let currentText = '';
    let i = 0;

    while (i < text.length) {
      if (text[i] === '`' && text[i + 1] !== '`') {
        if (currentText) {
          parts.push(currentText);
          currentText = '';
        }

        const endIndex = text.indexOf('`', i + 1);
        if (endIndex !== -1) {
          const code = text.substring(i + 1, endIndex);
          parts.push(
            <Text key={`code-${i}`} backgroundColor="bgBlackBright" color={theme.colors.accent}>
              {code}
            </Text>
          );
          i = endIndex + 1;
          continue;
        }
      }

      if (text.substring(i, i + 2) === '**') {
        if (currentText) {
          parts.push(currentText);
          currentText = '';
        }

        const endIndex = text.indexOf('**', i + 2);
        if (endIndex !== -1) {
          const boldText = text.substring(i + 2, endIndex);
          parts.push(
            <Text key={`bold-${i}`} bold color={theme.colors.text}>
              {boldText}
            </Text>
          );
          i = endIndex + 2;
          continue;
        }
      }

      if (text[i] === '*' && text[i + 1] !== '*') {
        if (currentText) {
          parts.push(currentText);
          currentText = '';
        }

        const endIndex = text.indexOf('*', i + 1);
        if (endIndex !== -1 && text[endIndex + 1] !== '*') {
          const italicText = text.substring(i + 1, endIndex);
          parts.push(
            <Text key={`italic-${i}`} italic color={theme.colors.text}>
              {italicText}
            </Text>
          );
          i = endIndex + 1;
          continue;
        }
      }

      currentText += text[i];
      i++;
    }

    if (currentText) {
      parts.push(currentText);
    }

    return (
      <Text color={theme.colors.text}>
        {parts.map((part, index) => (
          typeof part === 'string' ? part : React.cloneElement(part as React.ReactElement, { key: `inline-${index}` })
        ))}
      </Text>
    );
  };

  const elements = parseMarkdown(content);

  if (withBullet && elements.length > 0) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={theme.colors.accent}>● </Text>
          <Box flexDirection="column">
            {elements[0]}
          </Box>
        </Box>
        {elements.slice(1).map((element, index) => (
          <Box key={`rest-${index}`} paddingLeft={2}>
            {element}
          </Box>
        ))}
      </Box>
    );
  }

  return <Box flexDirection="column">{elements}</Box>;
};

export default MarkdownText;
