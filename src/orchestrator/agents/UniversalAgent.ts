import { Agent } from '../types.js';
import { buildUniversalAgentSystemPrompt } from '../../config/systemPrompt.js';

export const universalAgent: Agent = {
  id: 'universal_agent',
  name: 'Universal AI Agent',
  description: 'An intelligent agent that can handle any task by analyzing intent and planning execution',
  systemPrompt: buildUniversalAgentSystemPrompt(),
  availableTools: [
    'read_file',
    'write_file',
    'update_file',
    'list_directory',
    'create_directory',
    'delete_file',
    'file_exists',
    'execute_shell',
    'execute_node',
    'search_code',
    'install_package'
  ],
  temperature: 0.7,
  maxTokens: 16384
};
