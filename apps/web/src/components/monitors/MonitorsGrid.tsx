'use client';

import React, { useState, useMemo } from 'react';
import { MonitorRecord } from '@/lib/api';
import { MonitorCard } from './MonitorCard';
import { Search, Filter, ShieldAlert, Sparkles } from 'lucide-react';

interface MonitorsGridProps {
  monitors: MonitorRecord[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenAnalytics: (m: MonitorRecord) => void;
  onNewMonitor: () => void;
}

type DomainTab = 'ALL' | 'STOCK' | 'ECOMMERCE' | 'JOB' | 'GENERIC_WEB';

export function MonitorsGrid({
  monitors,
  isLoading,
  onRefresh,
  onOpenAnalytics,
  onNewMonitor,
}: MonitorsGridProps) {
  const [currentTab, setCurrentTab] = useState<DomainTab>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const matchesTab = currentTab === 'ALL' || m.type === currentTab;
      const matchesSearch =
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.rawPrompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.targetSymbol && m.targetSymbol.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [monitors, currentTab, searchTerm]);

  return (
    <div className="w-full">
      {/* Controls Bar: Category Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        {/* Domain Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-dark-900 border border-white/[0.08] w-full sm:w-auto overflow-x-auto">
          {(
            [
              { id: 'ALL', label: 'All Sentinels' },
              { id: 'STOCK', label: 'Stocks' },
              { id: 'ECOMMERCE', label: 'E-Commerce' },
              { id: 'JOB', label: 'Jobs' },
              { id: 'GENERIC_WEB', label: 'Web Scrapers' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                currentTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Filter */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sentinels..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-dark-900 border border-white/[0.08] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Grid State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-64 rounded-2xl bg-dark-900/60 border border-white/[0.06] animate-pulse p-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-6 w-24 bg-dark-800 rounded-lg" />
                <div className="h-5 w-48 bg-dark-800 rounded-lg" />
                <div className="h-4 w-full bg-dark-800/60 rounded-lg" />
              </div>
              <div className="h-10 w-full bg-dark-800/60 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredMonitors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMonitors.map((m) => (
            <MonitorCard
              key={m.id}
              monitor={m}
              onRefresh={onRefresh}
              onOpenAnalytics={onOpenAnalytics}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-dark-900/30 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No Active Sentinels Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {searchTerm
              ? `No monitors matched "${searchTerm}". Clear search or adjust filters.`
              : 'Launch your first autonomous sentinel by describing what you want to track above.'}
          </p>
          <button
            onClick={onNewMonitor}
            className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-xs hover:from-cyan-400 hover:to-blue-500 transition-all shadow-glow-cyan"
          >
            Create Sentinel
          </button>
        </div>
      )}
    </div>
  );
}
