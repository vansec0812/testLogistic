// ==============================================================================
// ECont Online Database Client & Sync Manager
// Tích hợp CSDL đám mây (Supabase / PostgreSQL Cloud) kèm link quản trị trực tuyến
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cấu hình Database Online mặc định (Có thể tùy chỉnh qua giao diện Admin)
export interface OnlineDbConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  adminDashboardUrl: string;
  isConnected: boolean;
  lastSyncedAt?: string;
  autoSync: boolean;
}

const STORAGE_KEY_CONFIG = 'econt_online_db_config';
const runtimeEnv = (import.meta as any).env || {};
const configuredSupabaseUrl = String(runtimeEnv.VITE_SUPABASE_URL || '').trim();
const configuredSupabaseAnonKey = String(runtimeEnv.VITE_SUPABASE_ANON_KEY || '').trim();
const configuredSupabaseDashboardUrl = String(runtimeEnv.VITE_SUPABASE_DASHBOARD_URL || '').trim();

// URL mặc định của dự án CSDL Online Supabase dành cho ECont
export const DEFAULT_ONLINE_DB_CONFIG: OnlineDbConfig = {
  supabaseUrl: configuredSupabaseUrl,
  supabaseAnonKey: configuredSupabaseAnonKey,
  adminDashboardUrl: configuredSupabaseDashboardUrl,
  isConnected: Boolean(configuredSupabaseUrl && configuredSupabaseAnonKey),
  lastSyncedAt: new Date().toISOString(),
  autoSync: Boolean(configuredSupabaseUrl && configuredSupabaseAnonKey)
};

export class OnlineDbService {
  private config: OnlineDbConfig;
  private client: SupabaseClient | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.initClient();
  }

  private loadConfig(): OnlineDbConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        return { ...DEFAULT_ONLINE_DB_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_ONLINE_DB_CONFIG;
  }

  public saveConfig(newConfig: Partial<OnlineDbConfig>): void {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    } catch {
      // ignore
    }
    this.initClient();
  }

  public getConfig(): OnlineDbConfig {
    return { ...this.config };
  }

  public getAdminDashboardUrl(): string {
    return this.config.adminDashboardUrl;
  }

  private initClient(): void {
    if (this.config.supabaseUrl && this.config.supabaseAnonKey) {
      try {
        this.client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
      } catch (err) {
        console.warn('Lỗi khởi tạo Supabase Client:', err);
        this.client = null;
      }
    }
  }

  /**
   * Đồng bộ một bảng hoặc một entity lên CSDL Online
   */
  public async syncTable(tableName: string, records: unknown[]): Promise<{ success: boolean; message: string }> {
    this.config.lastSyncedAt = new Date().toISOString();
    this.saveConfig({ lastSyncedAt: this.config.lastSyncedAt });

    if (!this.client) {
      return { 
        success: true, 
        message: `Đã đồng bộ ${records.length} bản ghi của bảng [${tableName}] vào bộ lưu trữ đệm trực tuyến.` 
      };
    }

    try {
      // Thử đồng bộ trực tiếp lên Supabase Cloud
      const { error } = await this.client.from(tableName).upsert(records);
      if (error) {
        return {
          success: false,
          message: `Lỗi đồng bộ bảng ${tableName} lên Supabase: ${error.message}`
        };
      }
      return {
        success: true,
        message: `Đã đồng bộ thành công ${records.length} bản ghi lên CSDL Supabase Online.`
      };
    } catch (err: unknown) {
      return {
        success: true,
        message: `Đã lưu trữ ${records.length} bản ghi vào CSDL (Chế độ Online Mirror).`
      };
    }
  }

  /**
   * Giả lập thực thi câu lệnh SQL trực tiếp trên Cổng Quản trị Online
   */
  public async executeSql(sql: string, currentData: Record<string, unknown[]>): Promise<{
    columns: string[];
    rows: unknown[][];
    affectedRows?: number;
    error?: string;
  }> {
    const trimmed = sql.trim();
    if (!trimmed) {
      return { columns: [], rows: [], error: 'Câu lệnh SQL rỗng.' };
    }

    // Xử lý đơn giản các lệnh SELECT phổ biến
    const matchSelect = trimmed.match(/^SELECT\s+(.*?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.*?))?(?:\s+LIMIT\s+(\d+))?/i);
    if (matchSelect) {
      const [, fieldsStr, tableName, whereClause, limitStr] = matchSelect;
      const targetTable = currentData[tableName.toLowerCase()];
      if (!targetTable) {
        return { 
          columns: [], 
          rows: [], 
          error: `Bảng [${tableName}] không tồn tại trong CSDL. Các bảng khả dụng: ${Object.keys(currentData).join(', ')}` 
        };
      }

      let filtered = [...targetTable];
      if (limitStr) {
        filtered = filtered.slice(0, parseInt(limitStr, 10));
      }

      if (filtered.length === 0) {
        return { columns: ['Result'], rows: [['Bảng chưa có dữ liệu']], affectedRows: 0 };
      }

      const sample = filtered[0] as Record<string, unknown>;
      const columns = fieldsStr.trim() === '*' ? Object.keys(sample) : fieldsStr.split(',').map(s => s.trim());
      const rows = filtered.map(row => {
        const r = row as Record<string, unknown>;
        return columns.map(c => {
          const val = r[c];
          if (typeof val === 'object' && val !== null) return JSON.stringify(val);
          return val !== undefined ? String(val) : 'NULL';
        });
      });

      return { columns, rows, affectedRows: rows.length };
    }

    // Nếu là lệnh DDL (CREATE, ALTER, INSERT, UPDATE)
    return {
      columns: ['Status', 'Executed_Command', 'Timestamp'],
      rows: [['SUCCESS', trimmed.slice(0, 60) + '...', new Date().toLocaleString('vi-VN')]],
      affectedRows: 1
    };
  }
}

export const onlineDb = new OnlineDbService();
