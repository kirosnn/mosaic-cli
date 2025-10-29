import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

interface GlowingTextProps {
  text: string;
  theme: any;
}

const GlowingText: React.FC<GlowingTextProps> = ({ text, theme }) => {
  const [frame, setFrame] = useState(0);
  const safeText = text || '';

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % safeText.length);
    }, 60);
    return () => clearInterval(interval);
  }, [safeText]);

  return (
    <Text>
      {safeText.split('').map((char, i) => {
        const distance = Math.abs(frame - i);
        const glowLevel = distance === 0 ? theme.colors.accent
          : distance === 1 ? theme.colors.text
            : theme.colors.secondary;
        return (
          <Text key={i} color={glowLevel}>
            {char}
          </Text>
        );
      })}
    </Text>
  );
};

export default GlowingText;
