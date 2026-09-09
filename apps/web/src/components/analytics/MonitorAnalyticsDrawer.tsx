'use client';

import React, { useEffect, useState } from 'react';
import { X, TrendingDown, Image as ImageIcon, Clock, ExternalLink, ChevronLeft } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { MonitorRecord, CheckLogPoint, api } from '@/lib/api';
import { useToast } from '../common/Toast';

interface MonitorAnalyticsDrawerProps {
  monitor: MonitorRecord | null;
  onClose: () => void;
}

function fmt(v: string | null, c: string) {
  if (!v) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return `${c === 'INR' ? '₹' : '$'}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function relTime(d: string | null) {
  if (!d) return '—';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const STATUS_COLOR: Record<string, string> = {
  CONDITION_MET: 'var(--success)',
  SUCCESS: 'var(--accent)',
  NO_CHANGE: 'var(--text-tertiary)',
  FAILED: 'var(--danger)',
  BLOCKED: 'var(--danger)',
};

export function MonitorAnalyticsDrawer({ monitor, onClose }: MonitorAnalyticsDrawerProps) {
  const [history, setHistory] = useState<CheckLogPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!monitor) return;
    setLoading(true);
    api.getMonitorHistory(monitor.id)
      .then(setHistory)
      .catch((e) => toast('error', 'Failed to load history', e.message))
      .finally(() => setLoading(false));
  }, [monitor, toast]);

  if (!monitor) return null;

  const targetNum = monitor.targetValue ? Number(monitor.targetValue) : null;
  const chartData = history
    .filter((h) => h.recordedValue !== null)
    .map((h) => ({
      t: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      v: h.recordedValue,
      status: h.status,
    }));
  const latestShot = history.find((h) => h.screenshotUrl)?.screenshotUrl;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 50,
        }}
      />

      {/* Drawer */}
      <div
        className="fade-in"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: 520,
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 6px' }}>
            <ChevronLeft size={15} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {monitor.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {monitor.type} · {monitor.frequencyMinutes}m interval
            </div>
          </div>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'Target', value: fmt(monitor.targetValue, monitor.currency) },
              { label: 'Latest', value: fmt(monitor.lastKnownValue, monitor.currency) },
              { label: 'Checked', value: relTime(monitor.lastCheckedAt) },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: '12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4, fontFamily: 'monospace' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingDown size={12} />
              Price History ({chartData.length} readings)
            </div>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '16px 16px 8px 4px',
              }}
            >
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="t"
                      stroke="var(--border)"
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--border)"
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      formatter={(val: any) => [fmt(String(val), monitor.currency), 'Value']}
                      labelStyle={{ color: 'var(--text-secondary)' }}
                    />
                    {targetNum !== null && (
                      <ReferenceLine
                        y={targetNum}
                        stroke="var(--warning)"
                        strokeDasharray="3 3"
                        label={{ value: 'Target', fill: 'var(--warning)', fontSize: 10, position: 'insideTopRight' }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ fill: 'var(--accent)', r: 2.5, strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {loading ? 'Loading...' : 'No data yet. Run a check to record history.'}
                </div>
              )}
            </div>
          </div>

          {/* Screenshot */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ImageIcon size={12} />
                Visual Proof
              </span>
              {latestShot && (
                <a href={latestShot} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', textDecoration: 'none', fontSize: 11, fontWeight: 500 }}>
                  Open <ExternalLink size={10} />
                </a>
              )}
            </div>
            {latestShot ? (
              <div
                onClick={() => setLightbox(latestShot)}
                style={{
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  cursor: 'zoom-in',
                  aspectRatio: '16/9',
                  background: 'var(--surface)',
                }}
              >
                <img src={latestShot} alt="Proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ padding: '24px', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
                Screenshots are captured for E-Commerce and Web monitors.
              </div>
            )}
          </div>

          {/* Audit Log */}
          {history.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                Execution Log
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {history.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'var(--surface)',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[log.status] || 'var(--muted)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{log.status}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-tertiary)' }}>
                      {log.recordedValue !== null && (
                        <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 12 }}>
                          {fmt(String(log.recordedValue), monitor.currency)}
                        </span>
                      )}
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightbox}
            alt="Screenshot"
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
      )}
    </>
  );
}
