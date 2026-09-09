'use client';

import React, { useState, useEffect } from 'react';
import { X, TrendingDown, Image as ImageIcon, CheckCircle, AlertTriangle, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { MonitorRecord, CheckLogPoint, api } from '@/lib/api';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { useToast } from '../common/Toast';

interface MonitorAnalyticsDrawerProps {
  monitor: MonitorRecord | null;
  onClose: () => void;
}

export function MonitorAnalyticsDrawer({ monitor, onClose }: MonitorAnalyticsDrawerProps) {
  const [history, setHistory] = useState<CheckLogPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!monitor) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const data = await api.getMonitorHistory(monitor.id);
        setHistory(data);
      } catch (err: any) {
        toast('error', 'History fetch failed', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [monitor, toast]);

  if (!monitor) return null;

  // Format chart data
  const chartData = history
    .filter((h) => h.recordedValue !== null)
    .map((h) => ({
      timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date(h.timestamp).toLocaleDateString(),
      recordedValue: h.recordedValue,
      status: h.status,
    }));

  const targetValueNum = monitor.targetValue ? parseFloat(monitor.targetValue) : null;
  const latestScreenshot = history.find((h) => h.screenshotUrl)?.screenshotUrl;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-dark-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl h-full bg-dark-900 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.08] bg-dark-850/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {monitor.type}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                monitor.status === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : monitor.status === 'TRIGGERED_SNOOZED'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
              }`}>
                {monitor.status}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">{monitor.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Prompt: &quot;{monitor.rawPrompt}&quot;</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Metrics Overview Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-dark-850 border border-white/[0.06]">
              <span className="text-[11px] font-medium text-slate-400 block">Condition Target</span>
              <span className="text-base font-bold text-white mt-0.5 block">
                {targetValueNum !== null ? formatCurrency(targetValueNum, monitor.currency) : 'New Entry'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-850 border border-white/[0.06]">
              <span className="text-[11px] font-medium text-slate-400 block">Latest Recorded</span>
              <span className="text-base font-bold text-cyan-400 mt-0.5 block">
                {monitor.lastKnownValue ? formatCurrency(parseFloat(monitor.lastKnownValue), monitor.currency) : 'Pending'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-850 border border-white/[0.06]">
              <span className="text-[11px] font-medium text-slate-400 block">Last Checked</span>
              <span className="text-xs font-semibold text-slate-300 mt-1 block">
                {formatRelativeTime(monitor.lastCheckedAt)}
              </span>
            </div>
          </div>

          {/* Price Drop Trend Line Chart (Recharts) */}
          <div className="p-4 rounded-xl bg-dark-850 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Historical Price Trend ({chartData.length} Cycles)
                </h4>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0f1d',
                        borderColor: '#233354',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [formatCurrency(val, monitor.currency), 'Recorded Value']}
                    />
                    {targetValueNum !== null && (
                      <ReferenceLine
                        y={targetValueNum}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{ value: 'Target', fill: '#f59e0b', fontSize: 10, position: 'right' }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="recordedValue"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={{ fill: '#06b6d4', r: 3 }}
                      activeDot={{ r: 5, stroke: '#38bdf8', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-slate-500 text-xs">
                <Clock className="w-6 h-6 mb-2 text-slate-600 animate-spin" />
                <span>No check cycles recorded yet. Polling will begin shortly.</span>
              </div>
            )}
          </div>

          {/* Visual Proof Screenshot Drawer Section */}
          <div className="p-4 rounded-xl bg-dark-850 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Visual Proof (Live Screenshot)
                </h4>
              </div>
              {latestScreenshot && (
                <a
                  href={latestScreenshot}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Full CDN URL</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {latestScreenshot ? (
              <div
                onClick={() => setSelectedScreenshot(latestScreenshot)}
                className="relative rounded-lg overflow-hidden border border-white/10 group cursor-pointer aspect-video bg-dark-950 flex items-center justify-center"
              >
                <img
                  src={latestScreenshot}
                  alt="Audit Proof Screenshot"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-dark-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium">
                  Click to Expand
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-lg border border-dashed border-white/10 text-center text-xs text-slate-500">
                Visual proof screenshot is generated on Playwright browser checks for E-commerce & Generic Web monitors.
              </div>
            )}
          </div>

          {/* Execution Audit Log Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Executions</h4>
            <div className="border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.06]">
              {history.slice(0, 8).map((log) => (
                <div key={log.id} className="p-3 flex items-center justify-between text-xs bg-dark-850/40">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      log.status === 'CONDITION_MET'
                        ? 'bg-emerald-400'
                        : log.status === 'SUCCESS'
                        ? 'bg-cyan-400'
                        : log.status === 'NO_CHANGE'
                        ? 'bg-slate-400'
                        : 'bg-rose-400'
                    }`} />
                    <span className="font-medium text-white">{log.status}</span>
                  </div>

                  <div className="flex items-center gap-4 text-slate-400">
                    {log.recordedValue !== null && (
                      <span className="text-white font-mono">{formatCurrency(log.recordedValue, monitor.currency)}</span>
                    )}
                    <span className="text-[11px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Screenshot Lightbox */}
      {selectedScreenshot && (
        <div
          onClick={() => setSelectedScreenshot(null)}
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-6 cursor-pointer"
        >
          <img
            src={selectedScreenshot}
            alt="Fullscreen Proof"
            className="max-w-full max-h-full rounded-xl border border-white/20 object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
