import React, { useMemo, useRef, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../config/themes.js';

interface MarkdownTextProps {
  content: string;
  theme: Theme;
  withBullet?: boolean;
  isStreaming?: boolean;
}

const MarkdownText: React.FC<MarkdownTextProps> = ({ content, theme, withBullet = false, isStreaming = false }) => {
  const previousContentRef = useRef<string>('');
  const streamingBufferRef = useRef<string>('');

  useEffect(() => {
    if (isStreaming) {
      streamingBufferRef.current = content;
    } else {
      streamingBufferRef.current = '';
      previousContentRef.current = content;
    }
  }, [content, isStreaming]);

  const parseMarkdown = (text: string): React.ReactElement[] => {
    if (!text || text.trim() === '') {
      return [<Text key="empty" color={theme.colors.text}> </Text>];
    }

    const safeText = text.replace(/\r/g, '');
    const lines = safeText.split('\n');
    const elements: React.ReactElement[] = [];

    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <Box key={`code-${i}`} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginY={0}>
              {codeBlockLanguage && (
                <Text color={theme.colors.secondary} dimColor>{codeBlockLanguage}</Text>
              )}
              {codeBlockContent.map((codeLine, idx) => (
                <Text key={`code-line-${i}-${idx}`} color={theme.colors.accent}>{codeLine}</Text>
              ))}
            </Box>
          );
          codeBlockContent = [];
          codeBlockLanguage = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeBlockLanguage = line.trim().substring(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      if (line.startsWith('# ')) {
        elements.push(
          <Text key={`h1-${i}`} bold color={theme.colors.primary}>{line.substring(2)}</Text>
        );
        continue;
      }

      if (line.startsWith('## ')) {
        elements.push(
          <Text key={`h2-${i}`} bold color={theme.colors.primary}>{line.substring(3)}</Text>
        );
        continue;
      }

      if (line.startsWith('### ')) {
        elements.push(
          <Text key={`h3-${i}`} bold color={theme.colors.secondary}>{line.substring(4)}</Text>
        );
        continue;
      }

      if (line.startsWith('- ') || line.startsWith('* ')) {
        const listContent = line.substring(2);
        elements.push(
          <Box key={`ul-${i}`}>
            <Text color={theme.colors.accent}>  ◦ </Text>
            {processInlineMarkdown(listContent, theme, `ul-${i}`)}
          </Box>
        );
        continue;
      }

      const olMatch = line.match(/^(\d+)\.\s(.*)$/);
      if (olMatch) {
        elements.push(
          <Box key={`ol-${i}`}>
            <Text color={theme.colors.accent}>  {olMatch[1]}. </Text>
            {processInlineMarkdown(olMatch[2], theme, `ol-${i}`)}
          </Box>
        );
        continue;
      }

      if (line.startsWith('>')) {
        const quote = line.substring(1).trim();
        elements.push(
          <Box key={`blockquote-${i}`}>
            <Text color={theme.colors.secondary}>│ </Text>
            <Text color={theme.colors.secondary} italic>{quote}</Text>
          </Box>
        );
        continue;
      }

      if (line.trim() === '') {
        elements.push(<Text key={`blank-${i}`}> </Text>);
        continue;
      }

      elements.push(
        <Box key={`line-${i}`}>
          {processInlineMarkdown(line, theme, `line-${i}`)}
        </Box>
      );
    }

    return elements;
  };

  const processInlineMarkdown = (text: string, theme: Theme, keyPrefix: string): React.ReactElement => {
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
            <Text key={`${keyPrefix}-code-${i}`} backgroundColor="black" color={theme.colors.accent}>{code}</Text>
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
            <Text key={`${keyPrefix}-bold-${i}`} bold color={theme.colors.text}>{boldText}</Text>
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
            <Text key={`${keyPrefix}-italic-${i}`} italic color={theme.colors.text}>{italicText}</Text>
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
      <Box>
        {parts.map((part, index) => (
          typeof part === 'string'
            ? <Text key={`${keyPrefix}-seg-${index}`} color={theme.colors.text}>{part}</Text>
            : React.cloneElement(part as React.ReactElement, { key: `${keyPrefix}-seg-${index}` })
        ))}
      </Box>
    );
  };

  const elements = useMemo(() => {
    const textToRender = isStreaming ? streamingBufferRef.current : content;
    return parseMarkdown(textToRender);
  }, [content, isStreaming]);

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

  return (
    <Box flexDirection="column">
      {elements}
    </Box>
  );
};

export default MarkdownText;
