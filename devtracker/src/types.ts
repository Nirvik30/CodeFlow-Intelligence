export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: ActivityType;
  data: ActivityData;
  workspaceId?: string;
  projectName?: string;
  sessionId: string;
}

export enum ActivityType {
  FILE_OPEN = 'file_open',
  FILE_CLOSE = 'file_close',
  FILE_SWITCH = 'file_switch',
  FILE_EDIT = 'file_edit',
  FILE_SAVE = 'file_save',
  FILE_CREATE = 'file_create',
  FILE_DELETE = 'file_delete',
  FILE_RENAME = 'file_rename',
  COMMAND_EXECUTE = 'command_execute',
  DEBUG_START = 'debug_start',
  DEBUG_STOP = 'debug_stop',
  DEBUG_BREAKPOINT = 'debug_breakpoint',
  TERMINAL_OPEN = 'terminal_open',
  TERMINAL_CLOSE = 'terminal_close',
  EXTENSION_INSTALL = 'extension_install',
  EXTENSION_UNINSTALL = 'extension_uninstall',
  WORKSPACE_OPEN = 'workspace_open',
  WORKSPACE_CLOSE = 'workspace_close',
  FOCUS_GAINED = 'focus_gained',
  FOCUS_LOST = 'focus_lost',
  TASK_START = 'task_start',
  TASK_END = 'task_end',
  GIT_COMMIT = 'git_commit',
  GIT_PUSH = 'git_push',
  GIT_PULL = 'git_pull',
  SEARCH_PERFORMED = 'search_performed'
}

export interface BaseActivityData {
  fileName?: string;
  filePath?: string;
  fileExtension?: string;
  lineCount?: number;
  characterCount?: number;
  workspaceName?: string;
}

export interface FileActivityData extends BaseActivityData {
  language?: string;
  isUntitled?: boolean;
  isDirty?: boolean;
  fileSize?: number;
  encoding?: string;
}

export interface EditActivityData extends FileActivityData {
  linesAdded?: number;
  linesDeleted?: number;
  charactersAdded?: number;
  charactersDeleted?: number;
  editType?: 'insert' | 'delete' | 'replace';
  cursorPosition?: { line: number; character: number };
}

export interface CommandActivityData {
  commandId: string;
  commandTitle?: string;
  category?: string;
  executionTime?: number;
}

export interface DebugActivityData {
  debugType?: string;
  configurationName?: string;
  breakpointCount?: number;
  duration?: number;
}

export interface GitActivityData {
  repository?: string;
  branch?: string;
  commitHash?: string;
  commitMessage?: string;
  filesChanged?: number;
}

export interface SearchActivityData {
  query: string;
  resultsCount?: number;
  searchScope?: 'workspace' | 'file' | 'selection';
  isRegex?: boolean;
  isCaseSensitive?: boolean;
}

export type ActivityData = 
  | FileActivityData 
  | EditActivityData 
  | CommandActivityData 
  | DebugActivityData 
  | GitActivityData
  | SearchActivityData
  | BaseActivityData;

export interface ActivityStats {
  totalEvents: number;
  filesSwitched: number;
  filesEdited: number;
  filesCreated: number;
  commandsExecuted: number;
  activeTime: number;
  codingTime: number;
  debugTime: number;
  mostEditedFiles: Array<{ file: string; edits: number; time: number }>;
  mostUsedLanguages: Array<{ language: string; time: number; files: number }>;
  mostUsedCommands: Array<{ command: string; count: number }>;
  dailyActivity: Array<{ date: string; events: number; activeTime: number }>;
  hourlyActivity: Array<{ hour: number; events: number; activeTime: number }>;
  productivityScore: number;
  streakData: { current: number; longest: number };
}

export interface SessionData {
  id: string;
  startTime: number;
  endTime?: number;
  workspaceId?: string;
  projectName?: string;
  totalEvents: number;
  activeTime: number;
}

export interface ExportData {
  exportDate: string;
  version: string;
  totalEvents: number;
  timeRange: { start: string; end: string };
  events: ActivityEvent[];
  sessions: SessionData[];
  stats: ActivityStats;
  metadata: {
    vscodeVersion: string;
    extensionVersion: string;
    platform: string;
  };
}