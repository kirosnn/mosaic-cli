import { BaseAdapter } from './baseAdapter.js';
import { IDEType } from '../types.js';

export class CursorAdapter extends BaseAdapter {
  readonly type: IDEType = 'cursor';
  readonly cliCommands: string[] = ['cursor'];
  readonly processNames: string[] = ['Cursor.exe'];
}
