import { writeFileSync, existsSync } from 'fs';

const MAX_SNAPSHOTS = 50;
const MAX_FILE_SIZE = 100000;

export interface FileSnapshot {
  path: string;
  content: string;
  exists: boolean;
}

export interface ConversationSnapshot {
  messageIndex: number;
  timestamp: number;
  messagePreview: string;
  filesModified: FileSnapshot[];
}

class RewindService {
  private snapshots: ConversationSnapshot[] = [];
  private sessionActive: boolean = true;
  private fileContentCache: Map<string, string> = new Map();

  constructor() {
    this.snapshots = [];
  }

  private optimizeCache(): void {
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      const toRemove = this.snapshots.length - MAX_SNAPSHOTS;
      this.snapshots = this.snapshots.slice(toRemove);
    }

    this.fileContentCache.clear();
    for (const snapshot of this.snapshots) {
      for (const file of snapshot.filesModified) {
        const key = `${file.path}:${file.exists}`;
        if (!this.fileContentCache.has(key)) {
          this.fileContentCache.set(key, file.content);
        }
      }
    }
  }

  createSnapshot(messageIndex: number, messagePreview: string, filesModified: FileSnapshot[]): void {
    if (!this.sessionActive || filesModified.length === 0) {
      return;
    }

    const optimizedFiles: FileSnapshot[] = [];
    const fileMap = new Map<string, FileSnapshot>();

    for (const file of filesModified) {
      if (file.content.length > MAX_FILE_SIZE) {
        continue;
      }
      fileMap.set(file.path, file);
    }

    for (const [, file] of fileMap) {
      const key = `${file.path}:${file.exists}`;
      const cachedContent = this.fileContentCache.get(key);

      if (cachedContent === file.content) {
        continue;
      }

      optimizedFiles.push({
        path: file.path,
        content: file.content,
        exists: file.exists
      });

      this.fileContentCache.set(key, file.content);
    }

    if (optimizedFiles.length === 0) {
      return;
    }

    const snapshot: ConversationSnapshot = {
      messageIndex,
      timestamp: Date.now(),
      messagePreview: messagePreview.slice(0, 100),
      filesModified: optimizedFiles
    };

    this.snapshots.push(snapshot);
    this.optimizeCache();
  }

  getSnapshots(): ConversationSnapshot[] {
    return [...this.snapshots];
  }

  clearSnapshots(): void {
    this.snapshots = [];
    this.fileContentCache.clear();
  }

  removeSnapshotsAfter(messageIndex: number): void {
    this.snapshots = this.snapshots.filter(s => s.messageIndex <= messageIndex);
    this.optimizeCache();
  }

  endSession(): void {
    this.sessionActive = false;
    this.snapshots = [];
    this.fileContentCache.clear();
  }

  startNewSession(): void {
    this.sessionActive = true;
    this.snapshots = [];
    this.fileContentCache.clear();
  }

  getCacheStats(): { snapshotCount: number; cachedFilesCount: number; estimatedSize: number } {
    let estimatedSize = 0;
    for (const snapshot of this.snapshots) {
      for (const file of snapshot.filesModified) {
        estimatedSize += file.content.length;
      }
    }
    return {
      snapshotCount: this.snapshots.length,
      cachedFilesCount: this.fileContentCache.size,
      estimatedSize
    };
  }

  async restoreToSnapshot(messageIndex: number): Promise<{ filesRestored: string[], errors: string[] }> {
    const filesRestored: string[] = [];
    const errors: string[] = [];

    const snapshotsToRestore = this.snapshots.filter(s => s.messageIndex > messageIndex);

    const fileStates = new Map<string, FileSnapshot>();

    for (const snapshot of snapshotsToRestore.reverse()) {
      for (const file of snapshot.filesModified) {
        if (!fileStates.has(file.path)) {
          fileStates.set(file.path, file);
        }
      }
    }

    for (const [path, snapshot] of fileStates) {
      try {
        if (snapshot.exists) {
          writeFileSync(path, snapshot.content, 'utf-8');
          filesRestored.push(path);
        } else {
          if (existsSync(path)) {
            const fs = await import('fs/promises');
            await fs.unlink(path);
            filesRestored.push(path);
          }
        }
      } catch (error) {
        errors.push(`Failed to restore ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    this.removeSnapshotsAfter(messageIndex);

    return { filesRestored, errors };
  }
}

export const rewindService = new RewindService();
