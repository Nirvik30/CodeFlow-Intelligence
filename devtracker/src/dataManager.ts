import * as vscode from 'vscode';
import { 
  ActivityEvent, 
  ActivityStats, 
  ActivityType, 
  SessionData, 
  ExportData,
  FileActivityData,
  CommandActivityData,
  BaseActivityData,
  ActivityData
} from './types';
import { ApiClient } from './apiClient';

export class DataManager {
  private storageUri: vscode.Uri;
  private sessionsUri: vscode.Uri;
  private events: ActivityEvent[] = [];
  private sessions: SessionData[] = [];
  private currentSession: SessionData | null = null;
  private readonly maxEvents = 50000;
  private saveTimer: NodeJS.Timeout | null = null;
  private apiClient: ApiClient;
  private syncTimer: NodeJS.Timeout | null = null;

  constructor(private context: vscode.ExtensionContext) {
    this.storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'activity-data.json');
    this.sessionsUri = vscode.Uri.joinPath(context.globalStorageUri, 'sessions-data.json');
    this.initializeStorage();
    this.apiClient = new ApiClient(context);
    this.setupPeriodicSync();
  }

  // Type guard functions
  private isFileActivityData(data: ActivityData): data is FileActivityData {
    return data && typeof data === 'object' && 
           ('fileName' in data || 'filePath' in data || 'language' in data);
  }

  private isCommandActivityData(data: ActivityData): data is CommandActivityData {
    return data && typeof data === 'object' && 'commandId' in data;
  }

  private async initializeStorage(): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(this.storageUri, '..')
      );
      await this.loadData();
      this.startNewSession();
      this.startPeriodicCleanup();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  private async loadData(): Promise<void> {
    try {
      // Load events
      const eventsData = await vscode.workspace.fs.readFile(this.storageUri);
      const eventsJson = JSON.parse(eventsData.toString());
      this.events = eventsJson.events || [];

      // Load sessions
      const sessionsData = await vscode.workspace.fs.readFile(this.sessionsUri);
      const sessionsJson = JSON.parse(sessionsData.toString());
      this.sessions = sessionsJson.sessions || [];

      this.cleanOldData();
    } catch (error) {
      // Files don't exist or are corrupted, start fresh
      this.events = [];
      this.sessions = [];
    }
  }

  private async saveData(): Promise<void> {
    try {
      // Save events
      const eventsData = {
        events: this.events,
        lastUpdated: Date.now(),
        version: '1.0.0'
      };
      
      await vscode.workspace.fs.writeFile(
        this.storageUri,
        Buffer.from(JSON.stringify(eventsData, null, 2))
      );

      // Save sessions
      const sessionsData = {
        sessions: this.sessions,
        currentSession: this.currentSession,
        lastUpdated: Date.now(),
        version: '1.0.0'
      };

      await vscode.workspace.fs.writeFile(
        this.sessionsUri,
        Buffer.from(JSON.stringify(sessionsData, null, 2))
      );
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  private debouncedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveData();
    }, 2000);
  }

  public addEvent(event: ActivityEvent): void {
    this.events.push(event);
    
    // Update current session
    if (this.currentSession) {
      this.currentSession.totalEvents++;
      this.currentSession.endTime = Date.now();
    }

    // Prevent memory issues
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-Math.floor(this.maxEvents * 0.8));
    }

    // Save immediately for critical events, debounce for others
    if (this.isCriticalEvent(event.type)) {
      this.saveData();
    } else {
      this.debouncedSave();
    }
  }

  private isCriticalEvent(type: ActivityType): boolean {
    return [
      ActivityType.WORKSPACE_OPEN,
      ActivityType.WORKSPACE_CLOSE,
      ActivityType.DEBUG_START,
      ActivityType.GIT_COMMIT
    ].includes(type);
  }

  private startNewSession(): void {
    // End current session if exists
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.sessions.push(this.currentSession);
    }

    // Start new session
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      workspaceId: this.getWorkspaceId(),
      projectName: this.getProjectName(),
      totalEvents: 0,
      activeTime: 0
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private getWorkspaceId(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath;
  }

  private getProjectName(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.name;
  }

  public getEvents(startDate?: Date, endDate?: Date): ActivityEvent[] {
    let filteredEvents = this.events;

    if (startDate) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= startDate.getTime());
    }

    if (endDate) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= endDate.getTime());
    }

    return filteredEvents;
  }

  public generateStats(days: number = 7): ActivityStats {
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp >= cutoffDate);

    return {
      totalEvents: recentEvents.length,
      filesSwitched: this.countEventsByType(recentEvents, ActivityType.FILE_SWITCH),
      filesEdited: this.countEventsByType(recentEvents, ActivityType.FILE_EDIT),
      filesCreated: this.countEventsByType(recentEvents, ActivityType.FILE_CREATE),
      commandsExecuted: this.countEventsByType(recentEvents, ActivityType.COMMAND_EXECUTE),
      activeTime: this.calculateActiveTime(recentEvents),
      codingTime: this.calculateCodingTime(recentEvents),
      debugTime: this.calculateDebugTime(recentEvents),
      mostEditedFiles: this.getMostEditedFiles(recentEvents),
      mostUsedLanguages: this.getMostUsedLanguages(recentEvents),
      mostUsedCommands: this.getMostUsedCommands(recentEvents),
      dailyActivity: this.getDailyActivity(recentEvents, days),
      hourlyActivity: this.getHourlyActivity(recentEvents),
      productivityScore: this.calculateProductivityScore(recentEvents),
      streakData: this.calculateStreakData(days)
    };
  }

  private countEventsByType(events: ActivityEvent[], type: ActivityType): number {
    return events.filter(e => e.type === type).length;
  }

  private calculateActiveTime(events: ActivityEvent[]): number {
    let activeTime = 0;
    let lastActiveTime = 0;
    const maxIdleTime = 5 * 60 * 1000; // 5 minutes

    const activeEventTypes = [
      ActivityType.FILE_EDIT,
      ActivityType.FILE_SWITCH,
      ActivityType.COMMAND_EXECUTE,
      ActivityType.FOCUS_GAINED
    ];

    for (const event of events.sort((a, b) => a.timestamp - b.timestamp)) {
      if (activeEventTypes.includes(event.type)) {
        if (lastActiveTime && (event.timestamp - lastActiveTime) < maxIdleTime) {
          activeTime += event.timestamp - lastActiveTime;
        }
        lastActiveTime = event.timestamp;
      }
    }

    return activeTime;
  }

  private calculateCodingTime(events: ActivityEvent[]): number {
    const codingEvents = events.filter(e => 
      [ActivityType.FILE_EDIT, ActivityType.FILE_SAVE].includes(e.type)
    );
    return this.calculateActiveTime(codingEvents);
  }

  private calculateDebugTime(events: ActivityEvent[]): number {
    let debugTime = 0;
    let debugStart = 0;

    for (const event of events.sort((a, b) => a.timestamp - b.timestamp)) {
      if (event.type === ActivityType.DEBUG_START) {
        debugStart = event.timestamp;
      } else if (event.type === ActivityType.DEBUG_STOP && debugStart) {
        debugTime += event.timestamp - debugStart;
        debugStart = 0;
      }
    }

    return debugTime;
  }

  private getMostEditedFiles(events: ActivityEvent[]): Array<{ file: string; edits: number; time: number }> {
    const fileStats = new Map<string, { edits: number; time: number; lastEdit: number }>();

    events
      .filter(e => e.type === ActivityType.FILE_EDIT && this.isFileActivityData(e.data) && e.data.fileName)
      .forEach(e => {
        if (this.isFileActivityData(e.data) && e.data.fileName) {
          const fileName = e.data.fileName;
          const current = fileStats.get(fileName) || { edits: 0, time: 0, lastEdit: 0 };
          
          current.edits++;
          if (current.lastEdit && (e.timestamp - current.lastEdit) < 300000) {
            current.time += e.timestamp - current.lastEdit;
          }
          current.lastEdit = e.timestamp;
          
          fileStats.set(fileName, current);
        }
      });

    return Array.from(fileStats.entries())
      .map(([file, stats]) => ({ file, edits: stats.edits, time: stats.time }))
      .sort((a, b) => b.edits - a.edits)
      .slice(0, 10);
  }

  private getMostUsedLanguages(events: ActivityEvent[]): Array<{ language: string; time: number; files: number }> {
    const languageStats = new Map<string, { time: number; files: Set<string>; lastSwitch: number }>();

    events
      .filter(e => e.type === ActivityType.FILE_SWITCH && this.isFileActivityData(e.data) && e.data.language)
      .forEach(e => {
        if (this.isFileActivityData(e.data) && e.data.language) {
          const lang = e.data.language;
          const current = languageStats.get(lang) || { time: 0, files: new Set(), lastSwitch: 0 };
          
          if (current.lastSwitch && (e.timestamp - current.lastSwitch) < 300000) {
            current.time += e.timestamp - current.lastSwitch;
          }
          
          if (e.data.fileName) {
            current.files.add(e.data.fileName);
          }
          
          current.lastSwitch = e.timestamp;
          languageStats.set(lang, current);
        }
      });

    return Array.from(languageStats.entries())
      .map(([language, stats]) => ({ 
        language, 
        time: stats.time, 
        files: stats.files.size 
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
  }

  private getMostUsedCommands(events: ActivityEvent[]): Array<{ command: string; count: number }> {
    const commandCounts = new Map<string, number>();

    events
      .filter(e => e.type === ActivityType.COMMAND_EXECUTE && this.isCommandActivityData(e.data))
      .forEach(e => {
        if (this.isCommandActivityData(e.data)) {
          const commandId = e.data.commandId;
          commandCounts.set(commandId, (commandCounts.get(commandId) || 0) + 1);
        }
      });

    return Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getDailyActivity(events: ActivityEvent[], days: number): Array<{ date: string; events: number; activeTime: number }> {
    const dailyActivity = new Map<string, { events: number; activeTime: number }>();

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyActivity.set(dateKey, { events: 0, activeTime: 0 });
    }

    // Group events by day
    const eventsByDay = new Map<string, ActivityEvent[]>();
    events.forEach(event => {
      const date = new Date(event.timestamp);
      const dateKey = date.toISOString().split('T')[0];
      if (!eventsByDay.has(dateKey)) {
        eventsByDay.set(dateKey, []);
      }
      eventsByDay.get(dateKey)!.push(event);
    });

    // Calculate stats for each day
    eventsByDay.forEach((dayEvents, dateKey) => {
      if (dailyActivity.has(dateKey)) {
        dailyActivity.set(dateKey, {
          events: dayEvents.length,
          activeTime: this.calculateActiveTime(dayEvents)
        });
      }
    });

    return Array.from(dailyActivity.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private getHourlyActivity(events: ActivityEvent[]): Array<{ hour: number; events: number; activeTime: number }> {
    const hourlyActivity = new Map<number, ActivityEvent[]>();

    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourlyActivity.set(i, []);
    }

    // Group events by hour
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyActivity.get(hour)!.push(event);
    });

    return Array.from(hourlyActivity.entries())
      .map(([hour, hourEvents]) => ({
        hour,
        events: hourEvents.length,
        activeTime: this.calculateActiveTime(hourEvents)
      }));
  }

  private calculateProductivityScore(events: ActivityEvent[]): number {
    if (events.length === 0) return 0;

    const weights: Record<ActivityType, number> = {
      [ActivityType.FILE_EDIT]: 3,
      [ActivityType.FILE_SAVE]: 2,
      [ActivityType.FILE_CREATE]: 4,
      [ActivityType.DEBUG_START]: 2,
      [ActivityType.GIT_COMMIT]: 5,
      [ActivityType.COMMAND_EXECUTE]: 1,
      [ActivityType.FILE_OPEN]: 1,
      [ActivityType.FILE_CLOSE]: 0,
      [ActivityType.FILE_SWITCH]: 1,
      [ActivityType.FILE_DELETE]: 1,
      [ActivityType.FILE_RENAME]: 1,
      [ActivityType.DEBUG_STOP]: 0,
      [ActivityType.DEBUG_BREAKPOINT]: 1,
      [ActivityType.TERMINAL_OPEN]: 1,
      [ActivityType.TERMINAL_CLOSE]: 0,
      [ActivityType.EXTENSION_INSTALL]: 1,
      [ActivityType.EXTENSION_UNINSTALL]: 0,
      [ActivityType.WORKSPACE_OPEN]: 0,
      [ActivityType.WORKSPACE_CLOSE]: 0,
      [ActivityType.FOCUS_GAINED]: 0,
      [ActivityType.FOCUS_LOST]: 0,
      [ActivityType.TASK_START]: 2,
      [ActivityType.TASK_END]: 1,
      [ActivityType.GIT_PUSH]: 3,
      [ActivityType.GIT_PULL]: 2,
      [ActivityType.SEARCH_PERFORMED]: 1
    };

    let score = 0;
    events.forEach(event => {
      const weight = weights[event.type] || 0;
      score += weight;
    });

    // Normalize score (0-100)
    const maxPossibleScore = events.length * 5; // Max weight is 5
    return Math.min(100, Math.round((score / maxPossibleScore) * 100));
  }

  private calculateStreakData(days: number): { current: number; longest: number } {
    const dailyActivity = this.getDailyActivity(this.events, days);
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Calculate from most recent day backwards
    for (let i = dailyActivity.length - 1; i >= 0; i--) {
      if (dailyActivity[i].events > 0) {
        tempStreak++;
        if (i === dailyActivity.length - 1) {
          currentStreak = tempStreak;
        }
      } else {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        tempStreak = 0;
        if (i === dailyActivity.length - 1) {
          currentStreak = 0;
        }
      }
    }

    return {
      current: currentStreak,
      longest: Math.max(longestStreak, tempStreak)
    };
  }

  private cleanOldData(): void {
    const config = vscode.workspace.getConfiguration('devActivityTracker');
    const retentionDays = config.get<number>('dataRetentionDays', 30);
    const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    
    const initialEventsLength = this.events.length;
    const initialSessionsLength = this.sessions.length;
    
    this.events = this.events.filter(e => e.timestamp >= cutoffDate);
    this.sessions = this.sessions.filter(s => s.startTime >= cutoffDate);
    
    if (this.events.length !== initialEventsLength || 
        this.sessions.length !== initialSessionsLength) {
      this.saveData();
    }
  }

  private startPeriodicCleanup(): void {
    // Clean old data every hour
    setInterval(() => {
      this.cleanOldData();
    }, 60 * 60 * 1000);
  }

  public async exportData(uri: vscode.Uri, format: 'json' | 'csv' = 'json'): Promise<void> {
    const stats = this.generateStats(30);
    
    const exportData: ExportData = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      totalEvents: this.events.length,
      timeRange: {
        start: this.events.length > 0 ? new Date(Math.min(...this.events.map(e => e.timestamp))).toISOString() : '',
        end: this.events.length > 0 ? new Date(Math.max(...this.events.map(e => e.timestamp))).toISOString() : ''
      },
      events: this.events,
      sessions: this.sessions,
      stats,
      metadata: {
        vscodeVersion: vscode.version,
        extensionVersion: this.context.extension?.packageJSON.version || '1.0.0',
        platform: process.platform
      }
    };

    if (format === 'json') {
      await vscode.workspace.fs.writeFile(
        uri,
        Buffer.from(JSON.stringify(exportData, null, 2))
      );
    } else {
      const csvContent = this.convertToCSV(exportData);
      await vscode.workspace.fs.writeFile(
        uri,
        Buffer.from(csvContent)
      );
    }
  }

  private convertToCSV(data: ExportData): string {
    const headers = ['timestamp', 'type', 'fileName', 'language', 'sessionId', 'workspaceId'];
    const rows = data.events.map(event => {
      // Safely extract fileName and language with type guards
      const fileName = this.isFileActivityData(event.data) ? event.data.fileName || '' : '';
      const language = this.isFileActivityData(event.data) ? event.data.language || '' : '';
      
      return [
        new Date(event.timestamp).toISOString(),
        event.type,
        fileName,
        language,
        event.sessionId,
        event.workspaceId || ''
      ];
    });

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  public clearData(): void {
    this.events = [];
    this.sessions = [];
    this.currentSession = null;
    this.startNewSession();
    this.saveData();
  }

  public endCurrentSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.sessions.push(this.currentSession);
      this.currentSession = null;
      this.saveData();
    }
  }

  private setupPeriodicSync(): void {
    // Sync every 5 minutes
    const syncInterval = 5 * 60 * 1000;
    
    this.syncTimer = setInterval(() => {
      const config = vscode.workspace.getConfiguration('devActivityTracker');
      const syncEnabled = config.get<boolean>('enableSync', false);
      
      if (syncEnabled) {
        this.syncDataWithAPI();
      }
    }, syncInterval);
  }

  public async syncDataWithAPI(): Promise<any> {
    try {
      const config = vscode.workspace.getConfiguration('devActivityTracker');
      const syncEnabled = config.get<boolean>('enableSync', false);
      
      if (!syncEnabled) {
        return { success: false, message: 'Sync not enabled' };
      }
      
      // Get events and sessions since last sync
      const lastSyncTime = this.context.globalState.get<number>('lastSyncTime', 0);
      const eventsToSync = this.events.filter(e => e.timestamp > lastSyncTime);
      const sessionsToSync = this.sessions.filter(s => s.startTime > lastSyncTime);
      
      // If no new data to sync, skip
      if (eventsToSync.length === 0 && sessionsToSync.length === 0) {
        return { success: true, message: 'No new data to sync' };
      }
      
      // Sync with API
      const result = await this.apiClient.syncActivityData(eventsToSync, sessionsToSync);
      
      // Update last sync time on success
      if (result.success) {
        this.context.globalState.update('lastSyncTime', Date.now());
      }
      
      return result;
    } catch (error) {
      console.error('Failed to sync data with API:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  public dispose(): void {
    this.endCurrentSession();
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.saveData();
  }
}