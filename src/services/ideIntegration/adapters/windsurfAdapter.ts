import { BaseAdapter } from './baseAdapter.js';
import { IDEType } from '../types.js';

export class WindsurfAdapter extends BaseAdapter {
  readonly type: IDEType = 'windsurf';
  readonly cliCommands: string[] = ['windsurf'];
  readonly processNames: string[] = ['Windsurf.exe'];
}
