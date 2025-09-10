import * as vscode from 'vscode';
import { DataManager } from './dataManager';
import { 
  ActivityEvent, 
  ActivityType, 
  FileActivityData, 
  EditActivityData, 
  CommandActivityData,
  DebugActivityData,
  GitActivityData
} from './types';

export class ActivityTracker implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private dataManager: DataManager;
  private lastEditTime = new Map<string, number>();
  private editBuffer = new Map<string, { added: number; deleted: number; edits: number }>();
  private isActive = true;
  private sessionId: string;
  private focusTimer: NodeJS.Timeout | null = null;
  private editTimers = new Map<string, NodeJS.Timeout>();
  private originalExecuteCommand: typeof vscode.commands.executeCommand | null = null;

  constructor(private context: vscode.ExtensionContext, dataManager: DataManager) {
    this.dataManager = dataManager;
    this.sessionId = this.generateSessionId();
    this.setupEventListeners();
    this.trackWorkspaceOpen();
    this.setupActivityMonitoring();
    this.setupGitTracking();
    this.setupCommandTracking();
  }

  private generateSessionId(): string {
    try {
      const timestamp = Date.now().toString();
      const random = Math.random().toString(36).substring(2, 11);
      return `session_${timestamp}_${random}`;
    } catch (error) {
      console.error('Error generating session ID:', error);
      return `session_${Date.now()}_fallback`;
    }
  }

  private setupEventListeners(): void {
    try {
      // File system events
      this.disposables.push(
        vscode.workspace.onDidOpenTextDocument(this.onFileOpen.bind(this)),
        vscode.workspace.onDidCloseTextDocument(this.onFileClose.bind(this)),
        vscode.workspace.onDidSaveTextDocument(this.onFileSave.bind(this)),
        vscode.workspace.onDidChangeTextDocument(this.onFileEdit.bind(this)),
        vscode.workspace.onDidCreateFiles(this.onFileCreate.bind(this)),
        vscode.workspace.onDidDeleteFiles(this.onFileDelete.bind(this)),
        vscode.workspace.onDidRenameFiles(this.onFileRename.bind(this))
      );

      // Window events
      this.disposables.push(
        vscode.window.onDidChangeActiveTextEditor(this.onFileSwitch.bind(this)),
        vscode.window.onDidChangeWindowState(this.onWindowStateChange.bind(this))
      );

      // Debug events
      this.disposables.push(
        vscode.debug.onDidStartDebugSession(this.onDebugStart.bind(this)),
        vscode.debug.onDidTerminateDebugSession(this.onDebugStop.bind(this))
      );

      // Terminal events
      this.disposables.push(
        vscode.window.onDidOpenTerminal(this.onTerminalOpen.bind(this)),
        vscode.window.onDidCloseTerminal(this.onTerminalClose.bind(this))
      );

      // Extension events
      this.disposables.push(
        vscode.extensions.onDidChange(this.onExtensionsChange.bind(this))
      );

      // Task events
      this.disposables.push(
        vscode.tasks.onDidStartTask(this.onTaskStart.bind(this)),
        vscode.tasks.onDidEndTask(this.onTaskEnd.bind(this))
      );

      // Workspace folder events
      this.disposables.push(
        vscode.workspace.onDidChangeWorkspaceFolders(this.onWorkspaceChange.bind(this))
      );

    } catch (error) {
      console.error('Failed to setup event listeners:', error);
    }
  }

  private setupCommandTracking(): void {
    try {
      // Store the original function
      this.originalExecuteCommand = vscode.commands.executeCommand;
      const tracker = this;
      
      // Replace the executeCommand function with our instrumented version
      vscode.commands.executeCommand = function<T>(command: string, ...rest: any[]): Thenable<T> {
        const startTime = Date.now();
        
        // Call the original function with cast to Thenable<T>
        const result = tracker.originalExecuteCommand!.apply(vscode.commands, [command, ...rest]) as Thenable<T>;
        
        // Track the command execution time
        result.then(
          () => tracker.trackCommand(command, undefined, Date.now() - startTime),
          () => tracker.trackCommand(command, undefined, Date.now() - startTime)
        );
        
        return result;
      };
    } catch (error) {
      console.error('Failed to setup command tracking:', error);
    }
  }

  private setupActivityMonitoring(): void {
    this.startInactivityTimer();
  }

  private startInactivityTimer(): void {
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
    }
    this.focusTimer = setTimeout(() => {
      this.trackEvent(ActivityType.FOCUS_LOST, { reason: 'inactivity_timeout' });
    }, 5 * 60 * 1000);
  }

  private isTrackingEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('devActivityTracker');
    return config.get<boolean>('enableTracking', true);
  }

  private createEvent(type: ActivityType, data: any): ActivityEvent {
    return {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      data: {
        ...data,
        workspaceName: this.getProjectName()
      },
      sessionId: this.sessionId,
      workspaceId: this.getWorkspaceId(),
      projectName: this.getProjectName()
    };
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private getWorkspaceId(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath;
  }

  private getProjectName(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.name;
  }

  private trackEvent(type: ActivityType, data: any): void {
    if (!this.isTrackingEnabled() || !this.isActive) return;

    try {
      // Ensure data is an object
      const safeData = data || {};
      
      const event = this.createEvent(type, safeData);
      if (event && this.dataManager) {
        this.dataManager.addEvent(event);
      }
    } catch (error) {
      console.error(`Failed to track event (${type}):`, error);
    }
  }

  private getFileData(document: vscode.TextDocument): FileActivityData {
    try {
      if (!document) {
        throw new Error('Document is undefined');
      }

      // Safe text extraction with size limit to prevent memory issues
      let text = '';
      try {
        // Get only first 100KB to avoid memory issues with large files
        const maxSize = 100 * 1024;
        const maxLines = Math.min(document.lineCount, 1000);
        // Fixed: Ensure we don't go beyond the last line of the document
        const endLine = Math.min(maxLines - 1, document.lineCount - 1);
        const endCharacter = endLine >= 0 ? document.lineAt(endLine).text.length : 0;
        text = document.getText(new vscode.Range(0, 0, endLine, endCharacter));
        if (text.length > maxSize) {
          text = text.substring(0, maxSize);
        }
      } catch (textError) {
        console.error('Error getting document text:', textError);
        text = '';
      }

      // Use safe path extraction
      const pathParts = document.fileName.split(/[/\\]/);
      const fileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'unknown';
      
      return {
        fileName,
        filePath: document.uri.fsPath,
        fileExtension: fileName.includes('.') ? fileName.split('.').pop() || '' : '',
        language: document.languageId,
        lineCount: document.lineCount,
        characterCount: text.length,
        fileSize: Buffer.byteLength(text, 'utf8'),
        isUntitled: document.isUntitled,
        isDirty: document.isDirty,
        encoding: 'utf8'
      };
    } catch (error) {
      console.error('Failed to get file data:', error);
      return {
        fileName: 'unknown',
        filePath: document?.uri?.fsPath || 'unknown',
        fileExtension: '',
        language: document?.languageId || 'unknown',
        lineCount: 0,
        characterCount: 0,
        fileSize: 0,
        isUntitled: document?.isUntitled || false,
        isDirty: document?.isDirty || false,
        encoding: 'utf8'
      };
    }
  }

  // Event handlers
  private onFileOpen(document: vscode.TextDocument): void {
    this.trackEvent(ActivityType.FILE_OPEN, this.getFileData(document));
  }

  private onFileClose(document: vscode.TextDocument): void {
    this.trackEvent(ActivityType.FILE_CLOSE, this.getFileData(document));
    this.flushEditBuffer(document.uri.fsPath);
  }

  private onFileSave(document: vscode.TextDocument): void {
    this.trackEvent(ActivityType.FILE_SAVE, {
      ...this.getFileData(document),
      saveTime: Date.now()
    });
    // Also check for git operations when files are saved
    this.detectGitOperations(document);
  }

  private onFileCreate(event: vscode.FileCreateEvent): void {
    try {
      if (!event || !event.files || !Array.isArray(event.files)) {
        return;
      }
      
      event.files.forEach(uri => {
        if (!uri || !uri.fsPath) return;
        
        const pathParts = uri.fsPath.split(/[/\\]/);
        const fileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'unknown';
        const fileExt = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
        
        this.trackEvent(ActivityType.FILE_CREATE, {
          fileName: fileName,
          filePath: uri.fsPath,
          fileExtension: fileExt,
          createdAt: Date.now()
        });
      });
    } catch (error) {
      console.error('Error in onFileCreate:', error);
    }
  }

  private onFileDelete(event: vscode.FileDeleteEvent): void {
    try {
      if (!event || !event.files || !Array.isArray(event.files)) {
        return;
      }
      
      event.files.forEach(uri => {
        if (!uri || !uri.fsPath) return;
        
        const pathParts = uri.fsPath.split(/[/\\]/);
        const fileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'unknown';
        const fileExt = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
        
        this.trackEvent(ActivityType.FILE_DELETE, {
          fileName: fileName,
          filePath: uri.fsPath,
          fileExtension: fileExt,
          deletedAt: Date.now()
        });
      });
    } catch (error) {
      console.error('Error in onFileDelete:', error);
    }
  }

  private onFileRename(event: vscode.FileRenameEvent): void {
    try {
      if (!event || !event.files || !Array.isArray(event.files)) {
        return;
      }
      
      event.files.forEach(({ oldUri, newUri }) => {
        if (!oldUri || !newUri || !oldUri.fsPath || !newUri.fsPath) return;
        
        const oldPathParts = oldUri.fsPath.split(/[/\\]/);
        const newPathParts = newUri.fsPath.split(/[/\\]/);
        const oldFileName = oldPathParts.length > 0 ? oldPathParts[oldPathParts.length - 1] : 'unknown';
        const newFileName = newPathParts.length > 0 ? newPathParts[newPathParts.length - 1] : 'unknown';
        
        this.trackEvent(ActivityType.FILE_RENAME, {
          oldFileName: oldFileName,
          newFileName: newFileName,
          oldFilePath: oldUri.fsPath,
          newFilePath: newUri.fsPath,
          renamedAt: Date.now()
        });
      });
    } catch (error) {
      console.error('Error in onFileRename:', error);
    }
  }

  private onFileEdit(event: vscode.TextDocumentChangeEvent): void {
    if (!event.document || event.document.uri.scheme !== 'file') {
      return;
    }

    const document = event.document;
    const filePath = document.uri.fsPath;
    const now = Date.now();

    const lastEdit = this.lastEditTime.get(filePath) || 0;
    if (now - lastEdit < 1000) {
      this.updateEditBuffer(filePath, event.contentChanges);
      return;
    }

    this.flushEditBuffer(filePath);
    this.lastEditTime.set(filePath, now);
    this.updateEditBuffer(filePath, event.contentChanges);

    // Clear existing timer
    const existingTimer = this.editTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.flushEditBuffer(filePath);
      this.editTimers.delete(filePath);
    }, 1000);
    
    this.editTimers.set(filePath, timer);
  }

  private updateEditBuffer(filePath: string, changes: readonly vscode.TextDocumentContentChangeEvent[]): void {
    const buffer = this.editBuffer.get(filePath) || { added: 0, deleted: 0, edits: 0 };

    for (const change of changes) {
      buffer.deleted += change.rangeLength;
      buffer.added += change.text.length;
      buffer.edits++;
    }

    this.editBuffer.set(filePath, buffer);
  }

  private flushEditBuffer(filePath: string): void {
    const buffer = this.editBuffer.get(filePath);
    if (!buffer || (buffer.added === 0 && buffer.deleted === 0)) {
      this.editBuffer.delete(filePath);
      this.lastEditTime.delete(filePath);
      return;
    }

    const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === filePath);
    if (!document) {
      this.editBuffer.delete(filePath);
      this.lastEditTime.delete(filePath);
      return;
    }

    try {
      const editData: EditActivityData = {
        ...this.getFileData(document),
        charactersAdded: buffer.added,
        charactersDeleted: buffer.deleted,
        editType: buffer.added > 0 && buffer.deleted > 0 ? 'replace' : 
                  buffer.added > 0 ? 'insert' : 'delete',
        cursorPosition: vscode.window.activeTextEditor?.selection.active
      };

      this.trackEvent(ActivityType.FILE_EDIT, editData);
    } catch (error) {
      console.error('Failed to flush edit buffer:', error);
    } finally {
      this.editBuffer.delete(filePath);
      this.lastEditTime.delete(filePath);
    }
  }

  private onFileSwitch(editor: vscode.TextEditor | undefined): void {
    if (!editor) return;

    this.trackEvent(ActivityType.FILE_SWITCH, {
      ...this.getFileData(editor.document),
      cursorPosition: editor.selection.active,
      visibleRange: editor.visibleRanges[0]
    });
  }

  private onWindowStateChange(windowState: vscode.WindowState): void {
    const eventType = windowState.focused ? ActivityType.FOCUS_GAINED : ActivityType.FOCUS_LOST;
    this.trackEvent(eventType, { 
      focused: windowState.focused,
      timestamp: Date.now()
    });

    this.isActive = windowState.focused;

    if (windowState.focused) {
      this.startInactivityTimer();
    }
  }

  private onDebugStart(session: vscode.DebugSession): void {
    const data: DebugActivityData = {
      debugType: session.type,
      configurationName: session.name,
      breakpointCount: vscode.debug.breakpoints.length
    };

    this.trackEvent(ActivityType.DEBUG_START, data);
  }

  private onDebugStop(session: vscode.DebugSession): void {
    const data: DebugActivityData = {
      debugType: session.type,
      configurationName: session.name,
      breakpointCount: vscode.debug.breakpoints.length
    };

    this.trackEvent(ActivityType.DEBUG_STOP, data);
  }

  private onTerminalOpen(terminal: vscode.Terminal): void {
    this.trackEvent(ActivityType.TERMINAL_OPEN, {
      terminalName: terminal.name,
      creationOptions: terminal.creationOptions
    });
  }

  private onTerminalClose(terminal: vscode.Terminal): void {
    this.trackEvent(ActivityType.TERMINAL_CLOSE, {
      terminalName: terminal.name,
      exitStatus: terminal.exitStatus
    });
  }

  private onExtensionsChange(): void {
    this.trackEvent(ActivityType.EXTENSION_INSTALL, {
      extensionCount: vscode.extensions.all.length,
      activeExtensions: vscode.extensions.all.filter(ext => ext.isActive).length
    });
  }

  private onTaskStart(event: vscode.TaskStartEvent): void {
    this.trackEvent(ActivityType.TASK_START, {
      taskName: event.execution.task.name,
      taskType: event.execution.task.definition.type,
      scope: event.execution.task.scope
    });
  }

  private onTaskEnd(event: vscode.TaskEndEvent): void {
    this.trackEvent(ActivityType.TASK_END, {
      taskName: event.execution.task.name,
      taskType: event.execution.task.definition.type,
      scope: event.execution.task.scope
    });
  }

  private onWorkspaceChange(event: vscode.WorkspaceFoldersChangeEvent): void {
    event.added.forEach(folder => {
      this.trackEvent(ActivityType.WORKSPACE_OPEN, {
        workspacePath: folder.uri.fsPath,
        workspaceName: folder.name
      });
    });

    event.removed.forEach(folder => {
      this.trackEvent(ActivityType.WORKSPACE_CLOSE, {
        workspacePath: folder.uri.fsPath,
        workspaceName: folder.name
      });
    });
  }

  private trackWorkspaceOpen(): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      this.trackEvent(ActivityType.WORKSPACE_OPEN, {
        workspacePath: workspaceFolder.uri.fsPath,
        workspaceName: workspaceFolder.name
      });
    }
  }

  public trackCommand(command: string | any, title?: string, executionTime?: number): void {
    try {
      // Safe extraction of command ID
      let commandId: string;
      
      if (typeof command === 'string') {
        commandId = command;
      } else if (command && typeof command === 'object') {
        commandId = command.command || 'unknown.command';
      } else {
        commandId = 'unknown.command';
      }
      
      const data: CommandActivityData = {
        commandId,
        commandTitle: title || (typeof command !== 'string' && command?.command ? command.command : undefined),
        executionTime,
        category: this.categorizeCommand(commandId)
      };

      this.trackEvent(ActivityType.COMMAND_EXECUTE, data);
    } catch (error) {
      console.error('Error tracking command:', error);
    }
  }

  private categorizeCommand(commandId: string): string {
    if (commandId.startsWith('git.')) return 'git';
    if (commandId.startsWith('debug.')) return 'debug';
    if (commandId.startsWith('workbench.action.files.')) return 'file';
    if (commandId.startsWith('editor.action.')) return 'editor';
    if (commandId.startsWith('workbench.action.terminal.')) return 'terminal';
    return 'other';
  }

  private setupGitTracking(): void {
    try {
      // Git operations are now tracked through file saves and command execution
      // This method is kept for future git-specific tracking enhancements
    } catch (error) {
      console.error('Failed to setup git tracking:', error);
    }
  }

  private detectGitOperations(document: vscode.TextDocument): void {
    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) return;

      // Check for git commit messages or other git-related files
      const fileName = document.fileName.toLowerCase();
      
      if (fileName.includes('commit_editmsg') || fileName.includes('merge_msg')) {
        const gitData: GitActivityData = {
          repository: workspaceFolder.name,
          commitMessage: document.getText().split('\n')[0], // First line as commit message
        };

        this.trackEvent(ActivityType.GIT_COMMIT, gitData);
      }
    } catch (error) {
      console.error('Failed to detect git operations:', error);
    }
  }

  public dispose(): void {
    try {
      // Restore original executeCommand function
      if (this.originalExecuteCommand) {
        vscode.commands.executeCommand = this.originalExecuteCommand;
        this.originalExecuteCommand = null;
      }

      // Flush any remaining edit buffers
      for (const filePath of this.editBuffer.keys()) {
        this.flushEditBuffer(filePath);
      }

      // Clear all edit timers
      for (const timer of this.editTimers.values()) {
        clearTimeout(timer);
      }
      this.editTimers.clear();

      // Clear focus timer
      if (this.focusTimer) {
        clearTimeout(this.focusTimer);
        this.focusTimer = null;
      }

      // Dispose all event listeners
      this.disposables.forEach(d => {
        try {
          d.dispose();
        } catch (error) {
          console.error('Error disposing listener:', error);
        }
      });
      this.disposables = [];

    } catch (error) {
      console.error('Failed to dispose ActivityTracker:', error);
    }
  }
}