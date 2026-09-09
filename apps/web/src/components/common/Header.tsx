'use client';

import React from 'react';
import { ShieldCheck, Activity, Bell, Cpu } from 'lucide-react';

interface HeaderProps {
  activeCount: number;
  totalCount: number;
  snoozedCount: number;
  apiOnline: boolean;
  onOpenSearch: () => void;
}

export function Header({
  activeCount,
  totalCount,
  snoozedCount,
  apiOnline,
  onOpenSearch,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-dark-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 glow-cyan">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">OmniSentinel</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                v1.0 Autonomous
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Intent-First Multi-Source Tracking Engine</p>
          </div>
        </div>

        {/* Live System Status & Telemetry */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-900 border border-white/[0.06]">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${apiOnline ? 'bg-emerald-400' : 'bg-rose-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${apiOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <span className="text-xs font-medium text-slate-300">
              {apiOnline ? 'Gateway Connected' : 'Gateway Offline'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div>
              <span className="text-slate-500">Total:</span>{' '}
              <span className="font-semibold text-white">{totalCount}</span>
            </div>
            <div className="h-3 w-px bg-white/10"></div>
            <div>
              <span className="text-slate-500">Active:</span>{' '}
              <span className="font-semibold text-emerald-400">{activeCount}</span>
            </div>
            <div className="h-3 w-px bg-white/10"></div>
            <div>
              <span className="text-slate-500">Snoozed:</span>{' '}
              <span className="font-semibold text-amber-400">{snoozedCount}</span>
            </div>
          </div>
        </div>

        {/* Action Button & Shortcuts */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-xs hover:from-cyan-400 hover:to-blue-500 transition-all shadow-glow-cyan"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>New Sentinel</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded text-white ml-1">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
