import React, { useState, useEffect } from 'react';
import { Text, useInput } from 'ink';

interface CustomTextInputProps {
  value: string;
  placeholder?: string;
  focus?: boolean;
  showCursor?: boolean;
  mask?: string;
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
  mask,
  onChange,
  onSubmit,
  onUpArrow,
  onDownArrow
}) => {
  const [cursorOffset, setCursorOffset] = useState(value.length);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setCursorOffset(Math.min(value.length, cursorOffset));
  }, [value]);

  useEffect(() => {
    if (!focus || !showCursor) return;

    if (isTyping) {
      setCursorVisible(true);
      const typingTimeout = setTimeout(() => {
        setIsTyping(false);
      }, 500);
      return () => clearTimeout(typingTimeout);
    }

    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [focus, showCursor, isTyping]);

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
      setIsTyping(true);
      setCursorOffset(Math.max(0, cursorOffset - 1));
      return;
    }

    if (key.rightArrow) {
      setIsTyping(true);
      setCursorOffset(Math.min(value.length, cursorOffset + 1));
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorOffset > 0) {
        setIsTyping(true);
        const newValue = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
        onChange(newValue);
        setCursorOffset(cursorOffset - 1);
      }
      return;
    }

    if (input && !key.ctrl && !key.meta && !key.escape) {
      setIsTyping(true);
      const newValue = value.slice(0, cursorOffset) + input + value.slice(cursorOffset);
      onChange(newValue);
      setCursorOffset(cursorOffset + input.length);
    }
  }, { isActive: focus });

  const maskedValue = mask ? mask.repeat(value.length) : value;
  const displayValue = maskedValue || placeholder;
  const isPlaceholder = !value && !!placeholder;

  if (!showCursor || !focus) {
    return <Text dimColor={isPlaceholder}>{displayValue}</Text>;
  }

  const beforeCursor = maskedValue.slice(0, cursorOffset);
  const cursorChar = maskedValue[cursorOffset] || ' ';
  const afterCursor = maskedValue.slice(cursorOffset + 1);

  if (value.length === 0) {
    return (
      <>
        <Text dimColor>{placeholder}</Text>
        {cursorVisible && <Text inverse>{' '}</Text>}
        {!cursorVisible && <Text>{' '}</Text>}
      </>
    );
  }

  return (
    <>
      <Text>{beforeCursor}</Text>
      {cursorVisible && <Text inverse>{cursorChar}</Text>}
      {!cursorVisible && <Text>{cursorChar}</Text>}
      <Text>{afterCursor}</Text>
    </>
  );
};

export default CustomTextInput;