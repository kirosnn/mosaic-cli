import * as path from 'path';

export class PathSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

export function validateAndResolvePath(
  targetPath: string,
  workingDirectory: string,
  allowedExternalPaths: string[] = []
): string {
  const resolvedPath = path.resolve(workingDirectory, targetPath);
  const normalizedResolved = path.normalize(resolvedPath);
  const normalizedWorkspace = path.normalize(workingDirectory);

  const isWithinWorkspace = normalizedResolved.startsWith(normalizedWorkspace);

  if (isWithinWorkspace) {
    return resolvedPath;
  }

  for (const allowedPath of allowedExternalPaths) {
    const normalizedAllowed = path.normalize(allowedPath);
    if (normalizedResolved.startsWith(normalizedAllowed)) {
      return resolvedPath;
    }
  }

  throw new PathSecurityError(
    `Access denied: Path "${targetPath}" resolves to "${resolvedPath}" which is outside the workspace "${workingDirectory}". ` +
    `The agent can only access files within the workspace or directories it has created.`
  );
}

export function isPathSafe(
  targetPath: string,
  workingDirectory: string,
  allowedExternalPaths: string[] = []
): boolean {
  try {
    validateAndResolvePath(targetPath, workingDirectory, allowedExternalPaths);
    return true;
  } catch (error) {
    return false;
  }
}

export function createPathValidator(workingDirectory: string) {
  const allowedExternalPaths: Set<string> = new Set();

  return {
    validate: (targetPath: string): string => {
      return validateAndResolvePath(
        targetPath,
        workingDirectory,
        Array.from(allowedExternalPaths)
      );
    },

    isSafe: (targetPath: string): boolean => {
      return isPathSafe(
        targetPath,
        workingDirectory,
        Array.from(allowedExternalPaths)
      );
    },

    allowPath: (externalPath: string): void => {
      const resolvedPath = path.resolve(externalPath);
      allowedExternalPaths.add(resolvedPath);
    },

    disallowPath: (externalPath: string): void => {
      const resolvedPath = path.resolve(externalPath);
      allowedExternalPaths.delete(resolvedPath);
    },

    getAllowedPaths: (): string[] => {
      return Array.from(allowedExternalPaths);
    },

    clearAllowedPaths: (): void => {
      allowedExternalPaths.clear();
    }
  };
}
