import * as vscode from 'vscode';
import { DataManager } from './dataManager';
import { ActivityTracker } from './activityTracker';
import { StatsViewProvider } from './statsViewProvider';
import { ApiClient } from './apiClient';

let dataManager: DataManager;
let activityTracker: ActivityTracker;
let statsViewProvider: StatsViewProvider;
let apiClient: ApiClient;

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Developer Activity Tracker activated');

  // Initialize core components
  dataManager = new DataManager(context);
  activityTracker = new ActivityTracker(context, dataManager);
  statsViewProvider = new StatsViewProvider(context, dataManager);
  apiClient = new ApiClient(context);

  // Set context for views
  vscode.commands.executeCommand('setContext', 'devActivityTracker.enabled', true);

  // Register commands
  const showStatsCommand = vscode.commands.registerCommand('devActivityTracker.showStats', async () => {
    await showActivityStats();
  });

  const exportDataCommand = vscode.commands.registerCommand('devActivityTracker.exportData', async () => {
    await exportActivityData();
  });

  const clearDataCommand = vscode.commands.registerCommand('devActivityTracker.clearData', async () => {
    await clearActivityData();
  });

  const toggleTrackingCommand = vscode.commands.registerCommand('devActivityTracker.toggleTracking', async () => {
    await toggleTracking();
  });

  const syncCommand = vscode.commands.registerCommand('devActivityTracker.syncWithCodeFlow', async () => {
    await syncWithCodeFlow();
  });

  // Register webview provider
  const statsWebviewProvider = vscode.window.registerWebviewViewProvider(
    'devActivityTracker.activityView',
    statsViewProvider,
    {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }
  );

  // Register disposables
  context.subscriptions.push(
    activityTracker,
    dataManager,
    showStatsCommand,
    exportDataCommand,
    clearDataCommand,
    toggleTrackingCommand,
    statsWebviewProvider,
    syncCommand
  );

  // Show welcome notification
  const config = vscode.workspace.getConfiguration('devActivityTracker');
  const enableNotifications = config.get<boolean>('enableNotifications', true);
  
  if (enableNotifications) {
    vscode.window.showInformationMessage(
      '🎯 Developer Activity Tracker is now monitoring your coding activity!',
      'Show Stats',
      'Settings'
    ).then(selection => {
      if (selection === 'Show Stats') {
        showActivityStats();
      } else if (selection === 'Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'devActivityTracker');
      }
    });
  }

  // Schedule periodic productivity notifications
  scheduleProductivityNotifications();
}

async function showActivityStats() {
  try {
    const stats = dataManager.generateStats(7);
    
    const panel = vscode.window.createWebviewPanel(
      'activityStats',
      'Developer Activity Statistics',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = generateStatsHTML(stats);
    
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'exportData':
          await exportActivityData();
          break;
        case 'clearData':
          await clearActivityData();
          break;
        case 'refreshStats':
          const newStats = dataManager.generateStats(message.days || 7);
          panel.webview.html = generateStatsHTML(newStats);
          break;
      }
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to show activity stats: ${error}`);
  }
}

function generateStatsHTML(stats: any): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Developer Activity Statistics</title>
        <style>
            :root {
                --primary-color: #007acc;
                --text-color: var(--vscode-foreground);
                --bg-color: var(--vscode-editor-background);
                --card-bg: var(--vscode-editor-inactiveSelectionBackground);
                --border-color: var(--vscode-panel-border);
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: var(--bg-color);
                color: var(--text-color);
                line-height: 1.6;
                padding: 20px;
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid var(--border-color);
            }

            .header h1 {
                font-size: 2.5rem;
                font-weight: 700;
                color: var(--primary-color);
            }

            .time-filter {
                display: flex;
                gap: 10px;
            }

            .filter-btn {
                padding: 8px 16px;
                border: 1px solid var(--border-color);
                background: var(--card-bg);
                color: var(--text-color);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .filter-btn:hover, .filter-btn.active {
                background: var(--primary-color);
                color: white;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }

            .stat-card {
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 24px;
                position: relative;
                transition: transform 0.2s ease;
            }

            .stat-card:hover {
                transform: translateY(-2px);
            }

            .stat-number {
                font-size: 2.5rem;
                font-weight: 700;
                color: var(--primary-color);
                margin-bottom: 8px;
                display: block;
            }

            .stat-label {
                color: var(--vscode-descriptionForeground);
                font-size: 0.9rem;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .productivity-score {
                text-align: center;
                margin-bottom: 30px;
            }

            .score-circle {
                width: 120px;
                height: 120px;
                border-radius: 50%;
                background: conic-gradient(
                    var(--primary-color) 0deg,
                    var(--primary-color) calc(${stats.productivityScore || 0} * 3.6deg),
                    var(--border-color) calc(${stats.productivityScore || 0} * 3.6deg),
                    var(--border-color) 360deg
                );
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
                position: relative;
            }

            .score-circle::before {
                content: '';
                width: 90px;
                height: 90px;
                border-radius: 50%;
                background: var(--bg-color);
                position: absolute;
            }

            .score-text {
                font-size: 1.8rem;
                font-weight: 700;
                color: var(--primary-color);
                z-index: 1;
            }

            .list-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
            }

            .list-card {
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 24px;
            }

            .list-title {
                font-size: 1.2rem;
                font-weight: 600;
                margin-bottom: 20px;
                color: var(--text-color);
            }

            .item-list {
                list-style: none;
            }

            .item-list li {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid var(--border-color);
            }

            .item-list li:last-child {
                border-bottom: none;
            }

            .item-name {
                font-weight: 500;
                flex: 1;
            }

            .item-value {
                font-weight: 600;
                color: var(--primary-color);
            }

            .actions {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-top: 30px;
            }

            .action-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .action-btn.primary {
                background: var(--primary-color);
                color: white;
            }

            .action-btn.secondary {
                background: var(--card-bg);
                color: var(--text-color);
                border: 1px solid var(--border-color);
            }

            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: var(--vscode-descriptionForeground);
            }

            .empty-icon {
                font-size: 4rem;
                margin-bottom: 20px;
                opacity: 0.3;
            }

            @media (max-width: 768px) {
                .list-container {
                    grid-template-columns: 1fr;
                }
                
                .header {
                    flex-direction: column;
                    gap: 20px;
                    text-align: center;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 Activity Statistics</h1>
            <div class="time-filter">
                <button class="filter-btn active" onclick="filterStats(7)">7 Days</button>
                <button class="filter-btn" onclick="filterStats(30)">30 Days</button>
                <button class="filter-btn" onclick="filterStats(90)">90 Days</button>
            </div>
        </div>

        ${stats.totalEvents > 0 ? `
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-number">${stats.totalEvents.toLocaleString()}</span>
                    <span class="stat-label">Total Events</span>
                </div>
                
                <div class="stat-card">
                    <span class="stat-number">${Math.round(stats.activeTime / (1000 * 60)).toLocaleString()}</span>
                    <span class="stat-label">Active Minutes</span>
                </div>
                
                <div class="stat-card">
                    <span class="stat-number">${Math.round(stats.codingTime / (1000 * 60)).toLocaleString()}</span>
                    <span class="stat-label">Coding Minutes</span>
                </div>
                
                <div class="stat-card">
                    <span class="stat-number">${stats.filesSwitched.toLocaleString()}</span>
                    <span class="stat-label">Files Switched</span>
                </div>
                
                <div class="stat-card">
                    <span class="stat-number">${stats.filesEdited.toLocaleString()}</span>
                    <span class="stat-label">Files Edited</span>
                </div>
                
                <div class="stat-card">
                    <span class="stat-number">${stats.streakData.current}</span>
                    <span class="stat-label">Current Streak</span>
                </div>
            </div>

            <div class="productivity-score">
                <h2>Productivity Score</h2>
                <div class="score-circle">
                    <span class="score-text">${stats.productivityScore}%</span>
                </div>
                <p>Based on your coding activity and engagement patterns</p>
            </div>

            <div class="list-container">
                <div class="list-card">
                    <h3 class="list-title">🔥 Most Edited Files</h3>
                    <ul class="item-list">
                        ${stats.mostEditedFiles.slice(0, 8).map((file: any) => `
                            <li>
                                <span class="item-name" title="${file.file}">${file.file.length > 30 ? file.file.substring(0, 30) + '...' : file.file}</span>
                                <span class="item-value">${file.edits} edits</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div class="list-card">
                    <h3 class="list-title">🌟 Most Used Languages</h3>
                    <ul class="item-list">
                        ${stats.mostUsedLanguages.slice(0, 8).map((lang: any) => `
                            <li>
                                <span class="item-name">${lang.language}</span>
                                <span class="item-value">${Math.round(lang.time / (1000 * 60))} min</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        ` : `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h2>No Activity Data Yet</h2>
                <p>Start coding and your activity will be tracked here!</p>
            </div>
        `}

        <div class="actions">
            <button class="action-btn primary" onclick="exportData()">
                📤 Export Data
            </button>
            <button class="action-btn secondary" onclick="refreshStats()">
                🔄 Refresh
            </button>
            <button class="action-btn secondary" onclick="clearData()">
                🗑️ Clear Data
            </button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function exportData() {
                vscode.postMessage({ command: 'exportData' });
            }

            function clearData() {
                if (confirm('Are you sure you want to clear all activity data?')) {
                    vscode.postMessage({ command: 'clearData' });
                }
            }

            function refreshStats() {
                const activeFilter = document.querySelector('.filter-btn.active');
                const days = parseInt(activeFilter.textContent.split(' ')[0]);
                vscode.postMessage({ command: 'refreshStats', days });
            }

            function filterStats(days) {
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
                vscode.postMessage({ command: 'refreshStats', days });
            }
        </script>
    </body>
    </html>
  `;
}

async function exportActivityData() {
  try {
    const config = vscode.workspace.getConfiguration('devActivityTracker');
    const defaultFormat = config.get<'json' | 'csv'>('exportFormat', 'json');
    
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`activity-data-${new Date().toISOString().split('T')[0]}.${defaultFormat}`),
      filters: {
        'JSON files': ['json'],
        'CSV files': ['csv']
      }
    });

    if (uri) {
      const format = uri.path.endsWith('.csv') ? 'csv' : 'json';
      await dataManager.exportData(uri, format);
      
      vscode.window.showInformationMessage(
        `✅ Activity data exported to ${uri.fsPath}`,
        'Open File'
      ).then(selection => {
        if (selection === 'Open File') {
          vscode.commands.executeCommand('vscode.open', uri);
        }
      });
    }
  } catch (error) {
    vscode.window.showErrorMessage(`❌ Failed to export data: ${error}`);
  }
}

async function clearActivityData() {
  const confirmation = await vscode.window.showWarningMessage(
    '⚠️ Are you sure you want to clear all activity data?',
    {
      detail: 'This action cannot be undone. All tracked events and statistics will be permanently deleted.',
      modal: true
    },
    'Yes, Clear Data',
    'Cancel'
  );

  if (confirmation === 'Yes, Clear Data') {
    try {
      dataManager.clearData();
      vscode.window.showInformationMessage('✅ Activity data cleared successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Failed to clear data: ${error}`);
    }
  }
}

async function toggleTracking() {
  const config = vscode.workspace.getConfiguration('devActivityTracker');
  const currentState = config.get<boolean>('enableTracking', true);
  
  await config.update('enableTracking', !currentState, vscode.ConfigurationTarget.Global);
  
  const newState = !currentState;
  const message = newState 
    ? '✅ Activity tracking enabled' 
    : '⏸️ Activity tracking disabled';
    
  vscode.window.showInformationMessage(message);
}

async function syncWithCodeFlow() {
  try {
    const isConnected = await apiClient.testConnection();
    
    if (!isConnected) {
      const authToken = await vscode.window.showInputBox({
        prompt: 'Enter your CodeFlow session token',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'Paste session token here'
      });
      
      if (!authToken) {
        vscode.window.showErrorMessage('Authentication cancelled');
        return;
      }
      
      apiClient.setSessionToken(authToken);
    }
    
    const config = vscode.workspace.getConfiguration('devActivityTracker');
    await config.update('enableSync', true, vscode.ConfigurationTarget.Global);
    
    const result = await dataManager.syncDataWithAPI();
    
    if (result.success) {
      vscode.window.showInformationMessage('Successfully synced with CodeFlow!');
    } else {
      vscode.window.showErrorMessage(`Sync failed: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function scheduleProductivityNotifications() {
  const config = vscode.workspace.getConfiguration('devActivityTracker');
  const enableNotifications = config.get<boolean>('enableNotifications', true);
  
  if (!enableNotifications) return;

  // Show daily summary at 6 PM
  const now = new Date();
  const targetTime = new Date();
  targetTime.setHours(18, 0, 0, 0);
  
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const timeUntilTarget = targetTime.getTime() - now.getTime();
  
  setTimeout(() => {
    showDailySummary();
    setInterval(showDailySummary, 24 * 60 * 60 * 1000);
  }, timeUntilTarget);
}

function showDailySummary() {
  const config = vscode.workspace.getConfiguration('devActivityTracker');
  const enableNotifications = config.get<boolean>('enableNotifications', true);
  
  if (!enableNotifications) return;

  const todayStats = dataManager.generateStats(1);
  
  if (todayStats.totalEvents > 0) {
    const activeMinutes = Math.round(todayStats.activeTime / (1000 * 60));
    const codingMinutes = Math.round(todayStats.codingTime / (1000 * 60));
    
    vscode.window.showInformationMessage(
      `📊 Today's Summary: ${activeMinutes} active minutes, ${codingMinutes} coding minutes, ${todayStats.filesEdited} files edited`,
      'View Details'
    ).then(selection => {
      if (selection === 'View Details') {
        showActivityStats();
      }
    });
  }
}

export function deactivate() {
  console.log('🛑 Developer Activity Tracker deactivated');
  
  // Clean up any remaining resources
  if (dataManager) {
    dataManager.dispose();
  }
  if (activityTracker) {
    activityTracker.dispose();
  }
}