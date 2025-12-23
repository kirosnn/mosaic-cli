import { readFileTool } from './readFileTool.js';
import { writeFileTool } from './writeFileTool.js';
import { updateFileTool } from './updateFileTool.js';
import { listDirectoryTool } from './listDirectoryTool.js';
import { deleteFileTool } from './deleteFileTool.js';
import { fileExistsTool } from './fileExistsTool.js';

export const allFileTools = [
  readFileTool,
  writeFileTool,
  updateFileTool,
  listDirectoryTool,
  deleteFileTool,
  fileExistsTool
];