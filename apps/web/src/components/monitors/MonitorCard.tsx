'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Briefcase,
  Globe,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  LineChart,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { MonitorRecord, api } from '@/lib/api';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { useToast } from '../common/Toast';

interface MonitorCardProps {
  monitor: MonitorRecord;
  onRefresh: () => void;
  onOpenAnalytics: (m: MonitorRecord) => void;
}

export function MonitorCard({ monitor, onRefresh, onOpenAnalytics }: MonitorCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleRearm = async () => {
    setIsProcessing(true);
    try {
      await api.updateMonitor(monitor.id, { status: 'ACTIVE' });
      toast('success', 'Sentinel Re-armed', `Monitor "${monitor.title}" has been reactivated and immediate check scheduled.`);
      onRefresh();
    } catch (err: any) {
      toast('error', 'Re-arm Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTogglePause = async () => {
    setIsProcessing(true);
    const newStatus = monitor.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    try {
      await api.updateMonitor(monitor.id, { status: newStatus });
      toast('info', `Monitor ${newStatus === 'ACTIVE' ? 'Resumed' : 'Paused'}`, `Status updated to ${newStatus}.`);
      onRefresh();
    } catch (err: any) {
      toast('error', 'Update Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete sentinel "${monitor.title}"?`)) return;
    setIsProcessing(true);
    try {
      await api.deleteMonitor(monitor.id);
      toast('success', 'Sentinel Dismissed', `Monitor "${monitor.title}" and its audit logs have been deleted.`);
      onRefresh();
    } catch (err: any) {
      toast('error', 'Delete Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const targetValueNum = monitor.targetValue ? parseFloat(monitor.targetValue) : null;
  const lastKnownValueNum = monitor.lastKnownValue ? parseFloat(monitor.lastKnownValue) : null;

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col justify-between relative group overflow-hidden border border-white/[0.08]">
      {/* Top Banner & Status Indicator */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              monitor.type === 'STOCK'
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                : monitor.type === 'ECOMMERCE'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : monitor.type === 'JOB'
                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {monitor.type === 'STOCK' && <TrendingUp className="w-4 h-4" />}
              {monitor.type === 'ECOMMERCE' && <ShoppingBag className="w-4 h-4" />}
              {monitor.type === 'JOB' && <Briefcase className="w-4 h-4" />}
              {monitor.type === 'GENERIC_WEB' && <Globe className="w-4 h-4" />}
            </div>

            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-white/[0.05] text-slate-300 border border-white/[0.08]">
              {monitor.type}
            </span>
          </div>

          {/* Status Badge */}
          <div className="flex items-center">
            {monitor.status === 'ACTIVE' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Active
              </span>
            )}

            {monitor.status === 'TRIGGERED_SNOOZED' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-3 h-3" />
                Snoozed (48h)
              </span>
            )}

            {monitor.status === 'PAUSED' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                <Pause className="w-3 h-3" />
                Paused
              </span>
            )}

            {monitor.status === 'BLOCKED' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertCircle className="w-3 h-3" />
                Blocked
              </span>
            )}
          </div>
        </div>

        {/* Title & Target */}
        <h3 className="text-base font-bold text-white tracking-tight line-clamp-1 group-hover:text-cyan-300 transition-colors">
          {monitor.title}
        </h3>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
          &quot;{monitor.rawPrompt}&quot;
        </p>

        {/* Target Symbol or URL Link */}
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          {monitor.targetSymbol && (
            <span className="font-mono px-2 py-0.5 rounded bg-dark-800 border border-white/5 text-cyan-300 text-[11px]">
              {monitor.targetSymbol}
            </span>
          )}
          {monitor.targetUrl && (
            <a
              href={monitor.targetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 text-[11px] truncate max-w-[200px]"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{new URL(monitor.targetUrl).hostname}</span>
            </a>
          )}
        </div>

        {/* Metric Comparison Box */}
        <div className="mt-4 grid grid-cols-2 gap-2 p-3 rounded-xl bg-dark-850/80 border border-white/[0.05]">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Condition</span>
            <span className="text-xs font-bold text-slate-200 mt-0.5 block font-mono">
              {monitor.conditionOperator}{' '}
              {targetValueNum !== null ? formatCurrency(targetValueNum, monitor.currency) : 'New Entry'}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Last Known</span>
            <span className="text-xs font-bold text-cyan-400 mt-0.5 block font-mono">
              {lastKnownValueNum !== null ? formatCurrency(lastKnownValueNum, monitor.currency) : 'Pending check'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Timestamps & Actions */}
      <div className="mt-5 pt-3.5 border-t border-white/[0.06] flex items-center justify-between">
        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Checked {formatRelativeTime(monitor.lastCheckedAt)}</span>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1">
          {monitor.status === 'TRIGGERED_SNOOZED' && (
            <button
              onClick={handleRearm}
              disabled={isProcessing}
              title="Re-arm monitor immediately"
              className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleTogglePause}
            disabled={isProcessing}
            title={monitor.status === 'PAUSED' ? 'Resume sentinel' : 'Pause sentinel'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {monitor.status === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => onOpenAnalytics(monitor)}
            title="Inspect historical trend and visual proof"
            className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 transition-colors"
          >
            <LineChart className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDelete}
            disabled={isProcessing}
            title="Delete sentinel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
