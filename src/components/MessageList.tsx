import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../config/themes.js';
import { MessageWithTools } from '../types/toolExecution.js';
import MarkdownText from './MarkdownText.js';
import ToolExecutionList from './ToolExecutionList.js';

interface MessageListProps {
  messages: MessageWithTools[];
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
            <>
              {(() => {
                const content = msg.content || '';
                const allTools = msg.toolExecutions || [];
                const anchored = allTools.filter((t: any) => typeof t.insertAt === 'number');

                if (anchored.length === 0) {
                  return (
                    <>
                      <Box paddingLeft={2}>
                        <MarkdownText
                          content={content}
                          theme={theme}
                          withBullet={true}
                          isStreaming={isStreaming && index === streamingMessageIndex}
                        />
                      </Box>
                      {allTools.length > 0 && (
                        <Box marginTop={1} paddingLeft={2} flexDirection="column">
                          <ToolExecutionList tools={allTools} theme={theme} />
                        </Box>
                      )}
                    </>
                  );
                }

                const sorted = [...anchored].sort((a, b) => (a.insertAt! - b.insertAt!));
                const unanchored = allTools.filter((t: any) => typeof t.insertAt !== 'number');
                const groups: { pos: number; tools: any[] }[] = [];
                for (const t of sorted) {
                  const pos = Math.min(Math.max(0, (t as any).insertAt as number), content.length);
                  const last = groups[groups.length - 1];
                  if (last && last.pos === pos) {
                    last.tools.push(t);
                  } else {
                    groups.push({ pos, tools: [t] });
                  }
                }

                const segments: React.ReactNode[] = [];
                let cursor = 0;
                let bulletUsed = false;

                groups.forEach((g, gi) => {
                  const slice = content.slice(cursor, g.pos);
                  if (slice.length > 0) {
                    segments.push(
                      <Box key={`text-${index}-${cursor}-${g.pos}`} paddingLeft={2}>
                        <MarkdownText
                          content={slice}
                          theme={theme}
                          withBullet={!bulletUsed}
                          isStreaming={false}
                        />
                      </Box>
                    );
                    bulletUsed = true;
                  }

                  segments.push(
                    <Box key={`tools-${index}-${g.pos}-${gi}`} paddingLeft={2} marginTop={1} flexDirection="column">
                      <ToolExecutionList tools={g.tools as any} theme={theme} />
                    </Box>
                  );

                  cursor = g.pos;
                });

                const tail = content.slice(cursor);
                segments.push(
                  <Box key={`text-tail-${index}-${cursor}`} paddingLeft={2}>
                    <MarkdownText
                      content={tail}
                      theme={theme}
                      withBullet={!bulletUsed}
                      isStreaming={isStreaming && index === streamingMessageIndex}
                    />
                  </Box>
                );

                if (unanchored.length > 0) {
                  segments.push(
                    <Box key={`tools-unanchored-${index}`} paddingLeft={2} marginTop={1} flexDirection="column">
                      <ToolExecutionList tools={unanchored as any} theme={theme} />
                    </Box>
                  );
                }

                return <>{segments}</>;
              })()}
            </>
          )}
        </Box>
      ))}
    </>
  );
};

export default MessageList;