import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

interface GlowingTextProps {
  text: string;
  theme: any;
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

const interpolateColor = (hex1: string, hex2: string, factor: number): string => {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return hex1;
  return rgbToHex(
    rgb1.r + (rgb2.r - rgb1.r) * factor,
    rgb1.g + (rgb2.g - rgb1.g) * factor,
    rgb1.b + (rgb2.b - rgb1.b) * factor
  );
};

const darkenColor = (hex: string, factor: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb.r * (1 - factor),
    rgb.g * (1 - factor),
    rgb.b * (1 - factor)
  );
};

const GlowingText: React.FC<GlowingTextProps> = ({ text, theme }) => {
  const [frame, setFrame] = useState(0);
  const safeText = text || '';
  const glowRadius = 8;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % safeText.length);
    }, 55);
    return () => clearInterval(interval);
  }, [safeText]);

  const getGlowColor = (distance: number): string => {
    const white = '#ffffff';
    const accent = theme.colors.accent;

    if (distance === 0) {
      return white;
    }
    if (distance <= 2) {
      const factor = distance / 2;
      return interpolateColor(white, accent, factor);
    }
    if (distance <= glowRadius) {
      const factor = ((distance - 2) / (glowRadius - 2)) * 0.8;
      return darkenColor(accent, factor);
    }
    return theme.colors.secondary;
  };

  return (
    <Text>
      {safeText.split('').map((char, i) => {
        const distance = Math.abs(frame - i);
        const glowColor = getGlowColor(distance);
        return (
          <Text key={i} color={glowColor}>
            {char}
          </Text>
        );
      })}
    </Text>
  );
};

export default GlowingText;