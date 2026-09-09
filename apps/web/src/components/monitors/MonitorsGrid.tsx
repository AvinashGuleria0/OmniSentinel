'use client';

import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { MonitorRecord } from '@/lib/api';
import { MonitorCard } from './MonitorCard';

interface MonitorsGridProps {
  monitors: MonitorRecord[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenAnalytics: (m: MonitorRecord) => void;
  onNewMonitor: () => void;
}

type Tab = 'ALL' | 'STOCK' | 'ECOMMERCE' | 'JOB' | 'GENERIC_WEB';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'STOCK', label: 'Stocks' },
  { id: 'ECOMMERCE', label: 'Shopping' },
  { id: 'JOB', label: 'Jobs' },
  { id: 'GENERIC_WEB', label: 'Web' },
];

export function MonitorsGrid({ monitors, isLoading, onRefresh, onOpenAnalytics, onNewMonitor }: MonitorsGridProps) {
  const [tab, setTab] = useState<Tab>('ALL');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      monitors.filter((m) => {
        const byTab = tab === 'ALL' || m.type === tab;
        const q = search.toLowerCase();
        const bySearch =
          !q ||
          m.title.toLowerCase().includes(q) ||
          m.rawPrompt.toLowerCase().includes(q) ||
          (m.targetSymbol || '').toLowerCase().includes(q);
        return byTab && bySearch;
      }),
    [monitors, tab, search]
  );

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: tab === t.id ? 'var(--surface-2)' : 'transparent',
                color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 150ms ease',
                fontFamily: 'inherit',
              }}
            >
              {t.label}
              {t.id === 'ALL' ? (
                <span
                  style={{
                    marginLeft: 5,
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    fontWeight: 400,
                  }}
                >
                  {monitors.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter monitors..."
            style={{
              paddingLeft: 30,
              paddingRight: 12,
              paddingTop: 6,
              paddingBottom: 6,
              fontSize: 13,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              outline: 'none',
              width: 180,
            }}
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                height: 220,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map((m) => (
            <MonitorCard key={m.id} monitor={m} onRefresh={onRefresh} onOpenAnalytics={onOpenAnalytics} />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {search ? `No monitors matching "${search}"` : 'No monitors yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            {search
              ? 'Try a different search term.'
              : 'Describe what you want to track above, or refresh if data is not loading.'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {!search && (
              <button onClick={onNewMonitor} className="btn btn-primary">
                Create your first monitor
              </button>
            )}
            <button onClick={onRefresh} className="btn btn-secondary">
              ↻ Refresh
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
