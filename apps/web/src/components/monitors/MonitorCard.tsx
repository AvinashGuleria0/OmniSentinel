'use client';

import React, { useState } from 'react';
import {
  TrendingUp, ShoppingBag, Briefcase, Globe,
  Pause, Play, RotateCcw, Trash2, BarChart2, Clock, ExternalLink,
} from 'lucide-react';
import { MonitorRecord, api } from '@/lib/api';
import { useToast } from '../common/Toast';

interface MonitorCardProps {
  monitor: MonitorRecord;
  onRefresh: () => void;
  onOpenAnalytics: (m: MonitorRecord) => void;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  STOCK: <TrendingUp size={14} />,
  ECOMMERCE: <ShoppingBag size={14} />,
  JOB: <Briefcase size={14} />,
  GENERIC_WEB: <Globe size={14} />,
};

const TYPE_LABEL: Record<string, string> = {
  STOCK: 'Stock',
  ECOMMERCE: 'E-Commerce',
  JOB: 'Job',
  GENERIC_WEB: 'Web',
};

const OP_SYMBOL: Record<string, string> = {
  LT: '<',
  GT: '>',
  EQUALS: '=',
  NEW_ENTRY: '∃',
  CONTAINS: '⊃',
};

function StatusBadge({ status }: { status: MonitorRecord['status'] }) {
  const map: Record<string, { label: string; color: string; bg: string; pulse: boolean }> = {
    ACTIVE: { label: 'Active', color: 'var(--success)', bg: 'var(--success-surface)', pulse: true },
    TRIGGERED_SNOOZED: { label: 'Snoozed', color: 'var(--warning)', bg: 'var(--warning-surface)', pulse: false },
    PAUSED: { label: 'Paused', color: 'var(--text-tertiary)', bg: 'var(--surface-2)', pulse: false },
    BLOCKED: { label: 'Blocked', color: 'var(--danger)', bg: 'var(--danger-surface)', pulse: false },
  };
  const s = map[status] || map.PAUSED;
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {s.pulse && (
        <span className="pulse-dot" style={{ background: s.color, color: s.color }} />
      )}
      {s.label}
    </span>
  );
}

function relativeTime(d: string | null): string {
  if (!d) return '—';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatVal(v: string | null, currency: string): string {
  if (!v) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  const sym = currency === 'INR' ? '₹' : '$';
  return `${sym}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function MonitorCard({ monitor, onRefresh, onOpenAnalytics }: MonitorCardProps) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const act = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast('success', successMsg);
      onRefresh();
    } catch (err: any) {
      toast('error', 'Action failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  const rearm = () => act(() => api.updateMonitor(monitor.id, { status: 'ACTIVE' }).then(() => {}), 'Monitor re-armed');
  const togglePause = () =>
    act(
      () => api.updateMonitor(monitor.id, { status: monitor.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' }).then(() => {}),
      monitor.status === 'PAUSED' ? 'Monitor resumed' : 'Monitor paused'
    );
  const del = async () => {
    if (!confirm(`Delete "${monitor.title}"?`)) return;
    act(() => api.deleteMonitor(monitor.id).then(() => {}), 'Monitor deleted');
  };

  const targetNum = monitor.targetValue ? Number(monitor.targetValue) : null;
  const knownNum = monitor.lastKnownValue ? Number(monitor.lastKnownValue) : null;
  const dropPct =
    targetNum && knownNum
      ? (((knownNum - targetNum) / targetNum) * 100).toFixed(1)
      : null;

  return (
    <article
      className="card"
      style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Top Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'var(--surface-2)',
              color: 'var(--accent)',
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            {TYPE_ICON[monitor.type]}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {TYPE_LABEL[monitor.type]}
          </span>
        </div>
        <StatusBadge status={monitor.status} />
      </div>

      {/* Title */}
      <div>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.2px',
            lineHeight: 1.3,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {monitor.title}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {monitor.rawPrompt}
        </p>
      </div>

      <hr className="divider" />

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: 2 }}>Condition</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {OP_SYMBOL[monitor.conditionOperator]} {formatVal(monitor.targetValue, monitor.currency)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: 2 }}>Last Seen</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: knownNum ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: 'monospace' }}>
            {formatVal(monitor.lastKnownValue, monitor.currency)}
            {dropPct && (
              <span style={{ fontSize: 11, color: Number(dropPct) > 0 ? 'var(--success)' : 'var(--danger)', marginLeft: 4 }}>
                {Number(dropPct) > 0 ? '+' : ''}{dropPct}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Target Link */}
      {(monitor.targetSymbol || monitor.targetUrl) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {monitor.targetSymbol && (
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--accent)',
                background: 'var(--accent-surface)',
                border: '1px solid var(--accent-border)',
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              {monitor.targetSymbol}
            </span>
          )}
          {monitor.targetUrl && (
            <a
              href={monitor.targetUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              <ExternalLink size={10} />
              {(() => { try { return new URL(monitor.targetUrl).hostname; } catch { return monitor.targetUrl.slice(0, 24); } })()}
            </a>
          )}
        </div>
      )}

      <hr className="divider" />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <Clock size={11} />
          {relativeTime(monitor.lastCheckedAt)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {monitor.status === 'TRIGGERED_SNOOZED' && (
            <button onClick={rearm} disabled={busy} className="btn btn-ghost" style={{ padding: '4px 6px' }} title="Re-arm">
              <RotateCcw size={13} />
            </button>
          )}
          <button onClick={togglePause} disabled={busy} className="btn btn-ghost" style={{ padding: '4px 6px' }}
            title={monitor.status === 'PAUSED' ? 'Resume' : 'Pause'}>
            {monitor.status === 'PAUSED' ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button onClick={() => onOpenAnalytics(monitor)} className="btn btn-ghost" style={{ padding: '4px 6px' }} title="Analytics">
            <BarChart2 size={13} />
          </button>
          <button onClick={del} disabled={busy} className="btn btn-danger" style={{ padding: '4px 6px' }} title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
