export function filterToolCallsFromText(text: string): string {
  if (!text || text.trim() === '') {
    return text;
  }

  let filtered = text;

  const jsonBlockPattern = /```(?:json)?\s*\[\s*\{[\s\S]*?"tool"\s*:[\s\S]*?\}\s*\]\s*```/g;
  filtered = filtered.replace(jsonBlockPattern, '');

  const singleToolBlockPattern = /```(?:json)?\s*\{\s*"tool"\s*:[\s\S]*?\}\s*```/g;
  filtered = filtered.replace(singleToolBlockPattern, '');

  const incompleteToolBlockPattern = /```(?:json)?\s*[\[\{]\s*\{\s*"tool"\s*:(?:(?!```).)*$/gs;
  filtered = filtered.replace(incompleteToolBlockPattern, '');

  const standaloneToolArrayPattern = /^\s*\[\s*\{\s*"tool"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:\s*\{[\s\S]*?\}\s*\}\s*\]\s*$/gm;
  filtered = filtered.replace(standaloneToolArrayPattern, '');

  const standaloneToolObjectPattern = /^\s*\{\s*"tool"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:\s*\{[\s\S]*?\}\s*\}\s*$/gm;
  filtered = filtered.replace(standaloneToolObjectPattern, '');

  return filtered.trim();
}

export function isStreamingToolCall(buffer: string): boolean {
  if (!buffer) return false;

  const toolCallIndicators = [
    /```json\s*\[\s*\{\s*"tool"\s*:/i,
    /```json\s*\{\s*"tool"\s*:/i,
    /^\s*\[\s*\{\s*"tool"\s*:/im,
    /^\s*\{\s*"tool"\s*:/im
  ];

  return toolCallIndicators.some(pattern => pattern.test(buffer));
}