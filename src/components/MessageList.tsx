import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../config/themes.js';
import { Message } from '../services/aiProvider.js';
import MarkdownText from './MarkdownText.js';

interface MessageListProps {
  messages: Message[];
  theme: Theme;
  isStreaming?: boolean;
  streamingMessageIndex?: number;
}

const MessageList: React.FC<MessageListProps> = ({ messages, theme, isStreaming = false, streamingMessageIndex = -1 }) => {
  if (messages.length === 0) {
    return (
      <Box marginBottom={1}>
        <Text color={theme.colors.secondary}>No messages yet. Start chatting below!</Text>
      </Box>
    );
  }

  return (
    <>
      {messages.map((msg, index) => (
        <Box key={index} marginBottom={1} flexDirection="column">
          {msg.role === 'user' ? (
            <Text color={theme.colors.text}>{msg.content}</Text>
          ) : (
            <Box paddingLeft={2}>
              <MarkdownText 
                content={msg.content} 
                theme={theme} 
                withBullet={true} 
                isStreaming={isStreaming && index === streamingMessageIndex}
              />
            </Box>
          )}
        </Box>
      ))}
    </>
  );
};

export default MessageList;
