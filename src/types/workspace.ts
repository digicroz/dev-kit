// Workspace types for managing multiple projects and modules

export type ActionType =
  | "open-in-vscode"
  | "run-command"
  | "run-script"
  | "open-url"
  | "open-folder";

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
  modules: WorkspaceModule[];
}

export interface WorkspaceConfig {
  version: string;
  workspaces: Workspace[];
}
