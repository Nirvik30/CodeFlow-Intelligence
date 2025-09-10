import * as vscode from 'vscode';
import { DataManager } from './dataManager';

export class StatsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'devActivityTracker.activityView';

  constructor(
    private context: vscode.ExtensionContext,
    private dataManager: DataManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'showFullStats':
          vscode.commands.executeCommand('devActivityTracker.showStats');
          break;
        case 'refreshStats':
          webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
          break;
      }
    });

    // Refresh stats periodically
    setInterval(() => {
      if (webviewView.visible) {
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
      }
    }, 60000); // Refresh every minute
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const stats = this.dataManager.generateStats(1); // Today's stats
    const weekStats = this.dataManager.generateStats(7); // This week's stats

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Activity Tracker</title>
          <style>
              body {
                  font-family: var(--vscode-font-family);
                  font-size: var(--vscode-font-size);
                  color: var(--vscode-foreground);
                  background-color: var(--vscode-editor-background);
                  margin: 0;
                  padding: 16px;
              }

              .stat-item {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 8px 0;
                  border-bottom: 1px solid var(--vscode-panel-border);
              }

              .stat-item:last-child {
                  border-bottom: none;
              }

              .stat-label {
                  font-size: 13px;
                  color: var(--vscode-descriptionForeground);
              }

              .stat-value {
                  font-weight: 600;
                  color: var(--vscode-textLink-foreground);
              }

              .section-title {
                  font-size: 14px;
                  font-weight: 600;
                  margin: 16px 0 8px 0;
                  color: var(--vscode-foreground);
              }

              .action-button {
                  background: var(--vscode-button-background);
                  color: var(--vscode-button-foreground);
                  border: none;
                  padding: 8px 16px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 13px;
                  margin: 8px 4px 8px 0;
                  transition: background-color 0.2s;
              }

              .action-button:hover {
                  background: var(--vscode-button-hoverBackground);
              }

              .productivity-score {
                  text-align: center;
                  margin: 16px 0;
              }

              .score-circle {
                  width: 60px;
                  height: 60px;
                  border-radius: 50%;
                  background: conic-gradient(
                      var(--vscode-textLink-foreground) 0deg,
                      var(--vscode-textLink-foreground) calc(${stats.productivityScore} * 3.6deg),
                      var(--vscode-panel-border) calc(${stats.productivityScore} * 3.6deg),
                      var(--vscode-panel-border) 360deg
                  );
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 8px;
                  position: relative;
              }

              .score-circle::before {
                  content: '';
                  width: 45px;
                  height: 45px;
                  border-radius: 50%;
                  background: var(--vscode-editor-background);
                  position: absolute;
              }

              .score-text {
                  font-size: 12px;
                  font-weight: 600;
                  color: var(--vscode-textLink-foreground);
                  z-index: 1;
              }

              .empty-state {
                  text-align: center;
                  padding: 24px 16px;
                  color: var(--vscode-descriptionForeground);
              }

              .refresh-button {
                  background: transparent;
                  border: 1px solid var(--vscode-panel-border);
                  color: var(--vscode-foreground);
                  padding: 6px 12px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 12px;
                  margin-bottom: 16px;
                  width: 100%;
              }

              .refresh-button:hover {
                  background: var(--vscode-toolbar-hoverBackground);
              }
          </style>
      </head>
      <body>
          <button class="refresh-button" onclick="refreshStats()">🔄 Refresh</button>
          
          ${stats.totalEvents > 0 ? `
              <div class="productivity-score">
                  <div class="score-circle">
                      <span class="score-text">${stats.productivityScore}%</span>
                  </div>
                  <div class="stat-label">Productivity Score</div>
              </div>

              <div class="section-title">📊 Today</div>
              <div class="stat-item">
                  <span class="stat-label">Active Time</span>
                  <span class="stat-value">${Math.round(stats.activeTime / (1000 * 60))}m</span>
              </div>
              <div class="stat-item">
                  <span class="stat-label">Coding Time</span>
                  <span class="stat-value">${Math.round(stats.codingTime / (1000 * 60))}m</span>
              </div>
              <div class="stat-item">
                  <span class="stat-label">Files Edited</span>
                  <span class="stat-value">${stats.filesEdited}</span>
              </div>
              <div class="stat-item">
                  <span class="stat-label">Commands</span>
                  <span class="stat-value">${stats.commandsExecuted}</span>
              </div>

              <div class="section-title">📈 This Week</div>
              <div class="stat-item">
                  <span class="stat-label">Total Events</span>
                  <span class="stat-value">${weekStats.totalEvents}</span>
              </div>
              <div class="stat-item">
                  <span class="stat-label">Active Hours</span>
                  <span class="stat-value">${Math.round(weekStats.activeTime / (1000 * 60 * 60))}h</span>
              </div>
              <div class="stat-item">
                  <span class="stat-label">Streak</span>
                  <span class="stat-value">${weekStats.streakData.current} days</span>
              </div>

              ${weekStats.mostUsedLanguages.length > 0 ? `
                  <div class="section-title">🌟 Top Languages</div>
                  ${weekStats.mostUsedLanguages.slice(0, 3).map((lang: any) => `
                      <div class="stat-item">
                          <span class="stat-label">${lang.language}</span>
                          <span class="stat-value">${Math.round(lang.time / (1000 * 60))}m</span>
                      </div>
                  `).join('')}
              ` : ''}
          ` : `
              <div class="empty-state">
                  <div style="font-size: 24px; margin-bottom: 8px;">📊</div>
                  <div>No activity today</div>
                  <div style="font-size: 12px; margin-top: 4px;">Start coding to see stats!</div>
              </div>
          `}

          <button class="action-button" onclick="showFullStats()">
              📈 View Full Statistics
          </button>

          <script>
              const vscode = acquireVsCodeApi();

              function showFullStats() {
                  vscode.postMessage({ type: 'showFullStats' });
              }

              function refreshStats() {
                  vscode.postMessage({ type: 'refreshStats' });
              }
          </script>
      </body>
      </html>
    `;
  }
}