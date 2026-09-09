'use client';

import React from 'react';
import { Sun, Moon, Shield, Plus } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface HeaderProps {
  activeCount: number;
  totalCount: number;
  apiOnline: boolean;
  onNewMonitor: () => void;
}

export function Header({ activeCount, totalCount, apiOnline, onNewMonitor }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <header
      style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 24px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={18} color="var(--accent)" strokeWidth={2} />
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            OmniSentinel
          </span>
        </div>

        {/* Center — Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="badge"
            style={{
              background: apiOnline ? 'var(--success-surface)' : 'var(--danger-surface)',
              color: apiOnline ? 'var(--success)' : 'var(--danger)',
            }}
          >
            <span
              className="pulse-dot"
              style={{
                background: apiOnline ? 'var(--success)' : 'var(--danger)',
                color: apiOnline ? 'var(--success)' : 'var(--danger)',
              }}
            />
            {apiOnline ? 'Connected' : 'Offline'}
          </span>

          {apiOnline && (
            <span
              className="badge"
              style={{
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {activeCount}/{totalCount} active
            </span>
          )}
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggle}
            className="btn btn-ghost"
            style={{ padding: '6px 8px' }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={onNewMonitor} className="btn btn-primary" style={{ fontSize: 13 }}>
            <Plus size={14} />
            New Monitor
          </button>
        </div>
      </div>
    </header>
  );
}
