import React, { useState, useEffect } from 'react';
import { Text, useInput } from 'ink';

interface CustomTextInputProps {
  value: string;
  placeholder?: string;
  focus?: boolean;
  showCursor?: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onUpArrow?: () => void;
  onDownArrow?: () => void;
}

const CustomTextInput: React.FC<CustomTextInputProps> = ({
  value,
  placeholder = '',
  focus = true,
  showCursor = true,
  onChange,
  onSubmit,
  onUpArrow,
  onDownArrow
}) => {
  const [cursorOffset, setCursorOffset] = useState(value.length);

  useEffect(() => {
    setCursorOffset(Math.min(value.length, cursorOffset));
  }, [value]);

  useInput((input, key) => {
    if (!focus) return;

    if (key.return) {
      onSubmit(value);
      setCursorOffset(0);
      return;
    }

    if (key.upArrow) {
      if (onUpArrow) {
        onUpArrow();
      }
      return;
    }

    if (key.downArrow) {
      if (onDownArrow) {
        onDownArrow();
      }
      return;
    }

    if (key.leftArrow) {
      setCursorOffset(Math.max(0, cursorOffset - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorOffset(Math.min(value.length, cursorOffset + 1));
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorOffset > 0) {
        const newValue = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
        onChange(newValue);
        setCursorOffset(cursorOffset - 1);
      }
      return;
    }

    if (input && !key.ctrl && !key.meta && !key.escape) {
      const newValue = value.slice(0, cursorOffset) + input + value.slice(cursorOffset);
      onChange(newValue);
      setCursorOffset(cursorOffset + input.length);
    }
  }, { isActive: focus });

  const displayValue = value || placeholder;
  const isPlaceholder = !value && !!placeholder;

  if (!showCursor || !focus) {
    return <Text dimColor={isPlaceholder}>{displayValue}</Text>;
  }

  const beforeCursor = value.slice(0, cursorOffset);
  const cursorChar = value[cursorOffset] || ' ';
  const afterCursor = value.slice(cursorOffset + 1);

  if (value.length === 0) {
    return (
      <>
        <Text dimColor>{placeholder.slice(0, 1)}</Text>
        <Text inverse>{placeholder[1] || ' '}</Text>
        <Text dimColor>{placeholder.slice(2)}</Text>
      </>
    );
  }

  return (
    <>
      <Text>{beforeCursor}</Text>
      <Text inverse>{cursorChar}</Text>
      <Text>{afterCursor}</Text>
    </>
  );
};

export default CustomTextInput;
