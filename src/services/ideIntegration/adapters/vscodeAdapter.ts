import { BaseAdapter } from './baseAdapter.js';
import { IDEType } from '../types.js';

export class VSCodeAdapter extends BaseAdapter {
  readonly type: IDEType = 'vscode';
  readonly cliCommands: string[] = ['code', 'code-insiders'];
  readonly processNames: string[] = ['Code.exe', 'Code - Insiders.exe'];
}
