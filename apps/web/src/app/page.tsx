'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/common/Header';
import { UniversalSearchBar } from '@/components/intent/UniversalSearchBar';
import { IntentPreviewModal } from '@/components/intent/IntentPreviewModal';
import { MonitorsGrid } from '@/components/monitors/MonitorsGrid';
import { MonitorAnalyticsDrawer } from '@/components/analytics/MonitorAnalyticsDrawer';
import { MonitorRecord, api } from '@/lib/api';
import { ParseIntentResponse } from '@omnisentinel/shared';
import { useToast } from '@/components/common/Toast';

export default function DashboardPage() {
  const [monitors, setMonitors] = useState<MonitorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [previewData, setPreviewData] = useState<ParseIntentResponse | null>(null);
  const [analyticsMonitor, setAnalyticsMonitor] = useState<MonitorRecord | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getMonitors();
      setMonitors(data);
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const activeCount = monitors.filter((m) => m.status === 'ACTIVE').length;

  const scrollToSearch = () => {
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const input = searchRef.current?.querySelector('input') as HTMLInputElement;
      input?.focus();
    }, 300);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <Header
        activeCount={activeCount}
        totalCount={monitors.length}
        apiOnline={apiOnline}
        onNewMonitor={scrollToSearch}
      />

      <main style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '0 24px' }}>
        {/* ── Hero ── */}
        <section style={{ padding: '56px 0 40px', maxWidth: 640 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>
            Autonomous Tracking Platform
          </p>
          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 40px)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.15,
              letterSpacing: '-0.8px',
              marginBottom: 16,
            }}
          >
            Describe it once.
            <br />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>We'll watch it forever.</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 480 }}>
            Track price drops, stock alerts, job postings, and web changes — using plain language. No code, no config.
          </p>
        </section>

        {/* ── Search Bar ── */}
        <section style={{ paddingBottom: 56 }} ref={searchRef}>
          <UniversalSearchBar onParsed={(result) => setPreviewData(result)} />
        </section>

        {/* ── Divider with label ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>
            Active Monitors
          </span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
        </div>

        {/* ── Monitors Grid ── */}
        <section style={{ paddingBottom: 80 }}>
          <MonitorsGrid
            monitors={monitors}
            isLoading={isLoading}
            onRefresh={load}
            onOpenAnalytics={setAnalyticsMonitor}
            onNewMonitor={scrollToSearch}
          />
        </section>
      </main>

      {/* Modals / Drawers */}
      {previewData && (
        <IntentPreviewModal
          data={previewData}
          onClose={() => setPreviewData(null)}
          onMonitorCreated={load}
        />
      )}

      {analyticsMonitor && (
        <MonitorAnalyticsDrawer
          monitor={analyticsMonitor}
          onClose={() => setAnalyticsMonitor(null)}
        />
      )}
    </div>
  );
}
