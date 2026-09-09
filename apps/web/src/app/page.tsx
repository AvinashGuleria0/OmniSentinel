'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/common/Header';
import { UniversalSearchBar } from '@/components/intent/UniversalSearchBar';
import { IntentPreviewModal } from '@/components/intent/IntentPreviewModal';
import { MonitorsGrid } from '@/components/monitors/MonitorsGrid';
import { MonitorAnalyticsDrawer } from '@/components/analytics/MonitorAnalyticsDrawer';
import { MonitorRecord, api } from '@/lib/api';
import { ParseIntentResponse } from '@omnisentinel/shared';
import { Shield, Sparkles, RefreshCw, Radio } from 'lucide-react';
import { useToast } from '@/components/common/Toast';

export default function DashboardPage() {
  const [monitors, setMonitors] = useState<MonitorRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<ParseIntentResponse | null>(null);
  const [activeAnalyticsMonitor, setActiveAnalyticsMonitor] = useState<MonitorRecord | null>(null);
  const { toast } = useToast();

  const loadMonitors = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getMonitors();
      setMonitors(data);
      setApiOnline(true);
    } catch (err: any) {
      setApiOnline(false);
      toast('error', 'Connection Error', 'Failed to communicate with OmniSentinel Fastify gateway');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Initial fetch and health check
  useEffect(() => {
    loadMonitors();
    const interval = setInterval(loadMonitors, 20000); // 20s auto-refresh
    return () => clearInterval(interval);
  }, [loadMonitors]);

  const activeCount = monitors.filter((m) => m.status === 'ACTIVE').length;
  const snoozedCount = monitors.filter((m) => m.status === 'TRIGGERED_SNOOZED').length;

  return (
    <div className="min-h-screen flex flex-col bg-dark-950 bg-grid-pattern relative">
      {/* Background ambient lighting accents */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Navigation Bar */}
      <Header
        activeCount={activeCount}
        totalCount={monitors.length}
        snoozedCount={snoozedCount}
        apiOnline={apiOnline}
        onOpenSearch={() => {
          const input = document.querySelector('input[type="text"]') as HTMLInputElement;
          input?.focus();
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section with Live Pulse */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Autonomous Intelligence Loop Active</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Describe Your Intent.{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-400 bg-clip-text text-transparent">
              OmniSentinel Tracks It.
            </span>
          </h1>

          <p className="mt-2 text-sm sm:text-base text-slate-400">
            Self-healing monitoring across stocks, e-commerce bank discounts, job boards, and dynamic web content with zero code.
          </p>
        </div>

        {/* Universal Intent Command Search Bar */}
        <UniversalSearchBar onParsed={(result) => setPreviewData(result)} />

        {/* Monitors Grid Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Active Surveillance Sentinels</h2>
            <p className="text-xs text-slate-400">Real-time status and time-series telemetry of registered monitors</p>
          </div>

          <button
            onClick={loadMonitors}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900 hover:bg-dark-850 text-slate-400 hover:text-white border border-white/[0.08] text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

        {/* Grid of Monitors */}
        <MonitorsGrid
          monitors={monitors}
          isLoading={isLoading}
          onRefresh={loadMonitors}
          onOpenAnalytics={(m) => setActiveAnalyticsMonitor(m)}
          onNewMonitor={() => {
            const input = document.querySelector('input[type="text"]') as HTMLInputElement;
            input?.focus();
          }}
        />
      </main>

      {/* Search-and-Confirm Preview Modal */}
      {previewData && (
        <IntentPreviewModal
          data={previewData}
          onClose={() => setPreviewData(null)}
          onMonitorCreated={() => {
            loadMonitors();
          }}
        />
      )}

      {/* Analytics & Visual Proof Drawer */}
      {activeAnalyticsMonitor && (
        <MonitorAnalyticsDrawer
          monitor={activeAnalyticsMonitor}
          onClose={() => setActiveAnalyticsMonitor(null)}
        />
      )}
    </div>
  );
}
