import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';

export class ApiClient {
  private client: AxiosInstance;
  private apiUrl: string;
  private sessionToken: string | undefined;

  constructor(private context: vscode.ExtensionContext) {
    // Get configuration
    const config = vscode.workspace.getConfiguration('devActivityTracker');
    this.apiUrl = config.get<string>('apiUrl', 'http://localhost:3000/api');
    
    // Create HTTP client
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Try to load saved token
    this.sessionToken = this.context.globalState.get<string>('sessionToken');
    if (this.sessionToken) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.sessionToken}`;
    }
  }

  /**
   * Update API configuration
   */
  public updateConfig(): void {
    const config = vscode.workspace.getConfiguration('devActivityTracker');
    this.apiUrl = config.get<string>('apiUrl', 'http://localhost:3000/api');
    this.client.defaults.baseURL = this.apiUrl;
  }

  /**
   * Set auth session token
   */
  public setSessionToken(token: string): void {
    this.sessionToken = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    this.context.globalState.update('sessionToken', token);
  }

  /**
   * Clear auth session token
   */
  public clearSessionToken(): void {
    this.sessionToken = undefined;
    delete this.client.defaults.headers.common['Authorization'];
    this.context.globalState.update('sessionToken', undefined);
  }

  /**
   * Sync activity data with API
   */
  public async syncActivityData(events: any[], sessions: any[]): Promise<any> {
    try {
      if (!this.sessionToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await this.client.post('/devtracker/sync', {
        events,
        sessions
      });

      return response.data;
    } catch (error) {
      console.error('API sync error:', error);
      throw error;
    }
  }

  /**
   * Get activity stats from API
   */
  public async getActivityStats(days: number = 7): Promise<any> {
    try {
      if (!this.sessionToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await this.client.get(`/devtracker/stats?days=${days}`);
      return response.data;
    } catch (error) {
      console.error('API stats error:', error);
      throw error;
    }
  }

  /**
   * Check if connected to API
   */
  public async testConnection(): Promise<boolean> {
    try {
      if (!this.sessionToken) {
        return false;
      }
      
      await this.client.get('/auth/session');
      return true;
    } catch (error) {
      return false;
    }
  }
}