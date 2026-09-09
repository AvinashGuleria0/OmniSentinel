'use client';

import React, { useState } from 'react';
import { X, Check, ShieldCheck, Sparkles, ExternalLink, Clock, CreditCard, Tag, Layers, ArrowUpRight } from 'lucide-react';
import { ParseIntentResponse, CreateMonitorInput } from '@omnisentinel/shared';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '../common/Toast';

interface IntentPreviewModalProps {
  data: ParseIntentResponse | null;
  onClose: () => void;
  onMonitorCreated: () => void;
}

const FREQUENCY_OPTIONS = [
  { label: '15 Mins', value: 15 },
  { label: '30 Mins', value: 30 },
  { label: '1 Hour', value: 60 },
  { label: '2 Hours', value: 120 },
  { label: '6 Hours', value: 360 },
];

const AVAILABLE_BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis'];

export function IntentPreviewModal({ data, onClose, onMonitorCreated }: IntentPreviewModalProps) {
  if (!data) return null;

  const { analysis, previewResults } = data;
  const { toast } = useToast();

  const [selectedItem, setSelectedItem] = useState(previewResults[0] || null);
  const [selectedBanks, setSelectedBanks] = useState<string[]>(['HDFC']);
  const [includeCoupons, setIncludeCoupons] = useState<boolean>(true);
  const [frequencyMinutes, setFrequencyMinutes] = useState<number>(60);
  const [targetValue, setTargetValue] = useState<number | null>(analysis.targetValue);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const toggleBank = (bank: string) => {
    setSelectedBanks((prev) =>
      prev.includes(bank) ? prev.filter((b) => b !== bank) : [...prev, bank]
    );
  };

  const handleDeploy = async () => {
    setIsSubmitting(true);
    try {
      const payload: CreateMonitorInput = {
        title: analysis.title || selectedItem?.title || analysis.targetQuery,
        type: analysis.type,
        targetUrl: selectedItem?.url || analysis.initialUrl || null,
        targetSymbol: analysis.type === 'STOCK' || analysis.type === 'JOB' ? analysis.targetQuery : null,
        rawPrompt: `Track ${analysis.targetQuery} with target ${targetValue ?? 'any change'}`,
        conditionOperator: analysis.conditionOperator,
        targetValue: targetValue,
        currency: analysis.currency || 'INR',
        frequencyMinutes: frequencyMinutes,
        filterMetadata: {
          include_coupons: includeCoupons,
          selected_banks: selectedBanks,
          selected_preview_title: selectedItem?.title,
        },
      };

      await api.createMonitor(payload);
      toast('success', 'Sentinel Deployed', `Autonomous tracking initiated for "${payload.title}". First check enqueued.`);
      onMonitorCreated();
      onClose();
    } catch (err: any) {
      toast('error', 'Deployment Failed', err.message || 'Could not deploy monitor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-dark-850/50">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Search-and-Confirm Preview</h3>
              <p className="text-xs text-slate-400">Review AI extracted criteria and preview candidate targets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Extracted Intent Badge Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-dark-850 border border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Domain:</span>
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {analysis.type}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Condition:</span>
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-dark-800 text-slate-200 border border-white/10">
                {analysis.conditionOperator} {targetValue !== null ? formatCurrency(targetValue, analysis.currency) : 'New Matches'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{Math.round(analysis.confidence * 100)}% Confidence</span>
            </div>
          </div>

          {/* Candidate Preview Cards */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Select Target Candidate ({previewResults.length} Found)
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {previewResults.map((item, idx) => {
                const isSelected = selectedItem?.url === item.url;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedItem(item)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'bg-dark-850/60 border-white/[0.06] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-dark-800 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <Layers className="w-5 h-5 text-slate-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{item.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        <span className="px-1.5 py-0.2 bg-dark-700 rounded text-[10px] uppercase">{item.source}</span>
                        {item.currentPrice !== null && (
                          <span className="text-emerald-400 font-semibold">{formatCurrency(item.currentPrice, item.currency)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
                        title="Open source URL"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
            {/* Target Value Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Target Threshold ({analysis.currency})
              </label>
              <input
                type="number"
                value={targetValue ?? ''}
                onChange={(e) => setTargetValue(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Target Price or Salary"
                className="w-full px-3 py-2 bg-dark-850 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Check Frequency Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Check Frequency
              </label>
              <div className="flex gap-1.5">
                {FREQUENCY_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFrequencyMinutes(f.value)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      frequencyMinutes === f.value
                        ? 'bg-cyan-500 text-white border-cyan-400 shadow-glow-cyan'
                        : 'bg-dark-850 text-slate-400 border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* E-Commerce Specific Bank & Coupon Controls */}
          {analysis.type === 'ECOMMERCE' && (
            <div className="p-3.5 rounded-xl bg-dark-850 border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span>Applicable Bank Discount Cards</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCoupons}
                    onChange={(e) => setIncludeCoupons(e.target.checked)}
                    className="rounded border-slate-700 bg-dark-800 text-cyan-500 focus:ring-0"
                  />
                  <span>Auto-Apply Coupons</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {AVAILABLE_BANKS.map((bank) => {
                  const isChecked = selectedBanks.includes(bank);
                  return (
                    <button
                      key={bank}
                      onClick={() => toggleBank(bank)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                        isChecked
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-dark-800 text-slate-400 border-white/[0.06] hover:text-white'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-sm flex items-center justify-center border ${
                        isChecked ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-600'
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <span>{bank} Card</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.08] bg-dark-850/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeploy}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs transition-all shadow-glow-cyan disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isSubmitting ? 'Deploying...' : 'Deploy Autonomous Sentinel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
