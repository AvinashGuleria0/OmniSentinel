import {
  CreateMonitorInput,
  UpdateMonitorInput,
  ParseIntentResponse,
} from '@omnisentinel/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
  }

  return json.data !== undefined ? json.data : json;
}

export interface MonitorRecord {
  id: string;
  userId: string;
  title: string;
  type: 'STOCK' | 'ECOMMERCE' | 'JOB' | 'GENERIC_WEB';
  status: 'ACTIVE' | 'TRIGGERED_SNOOZED' | 'PAUSED' | 'BLOCKED';
  targetUrl: string | null;
  targetSymbol: string | null;
  rawPrompt: string;
  conditionOperator: string;
  targetValue: string | null;
  currency: string;
  filterMetadata: Record<string, any>;
  frequencyMinutes: number;
  lastCheckedAt: string | null;
  nextRunAt: string;
  snoozedUntil: string | null;
  lastContentHash: string | null;
  lastKnownValue: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface CheckLogPoint {
  id: string;
  status: 'SUCCESS' | 'FAILED' | 'CONDITION_MET' | 'NO_CHANGE' | 'BLOCKED';
  recordedValue: number | null;
  screenshotUrl: string | null;
  metadata: Record<string, any>;
  timestamp: string;
}

export const api = {
  // Intent classification
  parseIntent: async (prompt: string): Promise<ParseIntentResponse> => {
    return fetchJson<ParseIntentResponse>('/intent/parse', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  // Monitors CRUD
  getMonitors: async (): Promise<MonitorRecord[]> => {
    return fetchJson<MonitorRecord[]>('/monitors');
  },

  getMonitor: async (id: string): Promise<MonitorRecord> => {
    return fetchJson<MonitorRecord>(`/monitors/${id}`);
  },

  createMonitor: async (data: CreateMonitorInput): Promise<MonitorRecord> => {
    return fetchJson<MonitorRecord>('/monitors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateMonitor: async (id: string, data: UpdateMonitorInput): Promise<MonitorRecord> => {
    return fetchJson<MonitorRecord>(`/monitors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteMonitor: async (id: string): Promise<{ success: boolean; message: string }> => {
    return fetchJson<{ success: boolean; message: string }>(`/monitors/${id}`, {
      method: 'DELETE',
    });
  },

  getMonitorHistory: async (id: string): Promise<CheckLogPoint[]> => {
    return fetchJson<CheckLogPoint[]>(`/monitors/${id}/history`);
  },

  checkHealth: async (): Promise<{ status: string; service: string }> => {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    const res = await fetch(`${rootUrl}/health`);
    return res.json();
  },
};
