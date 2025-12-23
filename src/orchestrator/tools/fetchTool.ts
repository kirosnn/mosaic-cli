import { Tool, ToolResult, AgentContext } from '../types.js';

export const fetchTool: Tool = {
  name: 'fetch',
  description: `Fetch information from a URL on the internet. Use this to:
  - Read documentation from official sources
  - Check package versions on npm/GitHub
  - Read API documentation
  - Get current information not in your training data

  IMPORTANT: Be economical with this tool:
  - Fetch only what you need, not entire websites
  - For documentation, fetch specific pages (e.g., /api/function-name)
  - Avoid fetching large resources (images, videos, binaries)
  - Prefer official documentation sources`,
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'The URL to fetch. Should be a specific resource, not a general homepage.',
      required: true
    },
    {
      name: 'method',
      type: 'string',
      description: 'HTTP method to use (GET, POST, etc.). Default: GET',
      required: false,
      default: 'GET'
    },
    {
      name: 'headers',
      type: 'object',
      description: 'Optional HTTP headers to include in the request',
      required: false
    },
    {
      name: 'body',
      type: 'string',
      description: 'Optional request body (for POST, PUT, etc.)',
      required: false
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      if (!params.url) {
        return {
          success: false,
          error: 'URL parameter is required'
        };
      }

      const url = params.url;
      const method = params.method || 'GET';
      const headers = params.headers || {};

      if (!headers['User-Agent']) {
        headers['User-Agent'] = 'Mosaic-CLI/1.0 (AI Agent)';
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(30000)
      };

      if (params.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOptions.body = params.body;
      }

      const response = await fetch(url, fetchOptions);

      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');

      if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
        return {
          success: false,
          error: `Resource too large (${contentLength} bytes). Please fetch a more specific resource.`
        };
      }

      if (contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/')) {
        return {
          success: false,
          error: 'Cannot fetch binary content (images, videos, audio). Please fetch text-based resources.'
        };
      }

      let content: string;
      if (contentType.includes('application/json')) {
        const json = await response.json();
        content = JSON.stringify(json, null, 2);
      } else {
        content = await response.text();
      }

      if (content.length > 100000) {
        content = content.substring(0, 100000) + '\n\n[Content truncated - too long]';
      }

      return {
        success: true,
        data: {
          url,
          status: response.status,
          statusText: response.statusText,
          contentType,
          content,
          truncated: content.length >= 100000
        }
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout after 30 seconds'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch URL'
      };
    }
  }
};
