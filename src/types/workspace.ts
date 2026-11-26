// Workspace types for managing multiple projects and modules

export type ActionType =
  | 'open-in-vscode'
  | 'open-in-zed'
  | 'open-in-antigravity'
  | 'run-command'
  | 'run-script'
  | 'open-url'
  | 'open-folder';

export interface WorkspaceAction {
  type: ActionType;
  command?: string; // For run-command type
  scriptPath?: string; // For run-script type
  url?: string; // For open-url type
  description?: string; // Optional description for the action
}

export interface WorkspaceModule {
  name: string;
  isIncludeByDefault: boolean;
  path: string;
  defaultActionIndex: number;
  actions: WorkspaceAction[];
}

export interface Workspace {
  name: string;
  description?: string;
  color?: string; // Color for UI (cyan, green, yellow, etc.)
  order?: number; // Lower first, default 0; set via "order" in any module's ws.dk.json
  modules: WorkspaceModule[];
}

export interface WorkspaceConfig {
  version: string;
  // Folders `dk ws` scans (2 levels deep) for ws.dk.json. Seeded with the digicroz repos dir.
  scanDirs?: string[];
  workspaces: Workspace[];
}
