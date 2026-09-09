'use client';

import React, { useState } from 'react';
import { X, Check, ExternalLink, CreditCard, ChevronDown, Shield, Loader2 } from 'lucide-react';
import { ParseIntentResponse, CreateMonitorInput } from '@omnisentinel/shared';
import { api } from '@/lib/api';
import { useToast } from '../common/Toast';

interface IntentPreviewModalProps {
  data: ParseIntentResponse | null;
  onClose: () => void;
  onMonitorCreated: () => void;
}

const FREQUENCIES = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '6h', value: 360 },
];

const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis'];

const OP_LABELS: Record<string, string> = {
  LT: 'drops below',
  GT: 'rises above',
  EQUALS: 'equals',
  NEW_ENTRY: 'any new match',
  CONTAINS: 'contains keyword',
};

export function IntentPreviewModal({ data, onClose, onMonitorCreated }: IntentPreviewModalProps) {
  if (!data) return null;
  const { analysis, previewResults } = data;
  const { toast } = useToast();

  const [selected, setSelected] = useState(previewResults[0] || null);
  const [banks, setBanks] = useState<string[]>(['HDFC']);
  const [coupons, setCoupons] = useState(true);
  const [freq, setFreq] = useState(60);
  const [target, setTarget] = useState<number | string>(analysis.targetValue ?? '');
  const [submitting, setSubmitting] = useState(false);

  const toggleBank = (b: string) => setBanks((p) => p.includes(b) ? p.filter((x) => x !== b) : [...p, b]);

  const deploy = async () => {
    setSubmitting(true);
    try {
      const payload: CreateMonitorInput = {
        title: selected?.title || analysis.title || analysis.targetQuery,
        type: analysis.type,
        targetUrl: selected?.url || analysis.initialUrl || null,
        targetSymbol: analysis.type === 'STOCK' || analysis.type === 'JOB' ? analysis.targetQuery : null,
        rawPrompt: `Track ${analysis.targetQuery}`,
        conditionOperator: analysis.conditionOperator,
        targetValue: target !== '' ? Number(target) : null,
        currency: analysis.currency || 'INR',
        frequencyMinutes: freq,
        filterMetadata: { include_coupons: coupons, selected_banks: banks },
      };
      await api.createMonitor(payload);
      toast('success', 'Monitor created', `"${payload.title}" is now active.`);
      onMonitorCreated();
      onClose();
    } catch (err: any) {
      toast('error', 'Failed to create', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Confirm Monitor</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
              AI detected:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                {analysis.type}
              </span>{' '}
              · {Math.round(analysis.confidence * 100)}% confidence
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 6px' }}>
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Extracted Condition Banner */}
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--accent-surface)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius)',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{analysis.targetQuery}</span>
            {' '}
            <span>{OP_LABELS[analysis.conditionOperator] || analysis.conditionOperator}</span>
            {' '}
            {analysis.targetValue !== null && (
              <span style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'monospace' }}>
                {analysis.currency === 'INR' ? '₹' : '$'}{analysis.targetValue?.toLocaleString()}
              </span>
            )}
          </div>

          {/* Preview Candidates */}
          {previewResults.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Select Target ({previewResults.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {previewResults.map((item, i) => {
                  const isSelected = selected?.url === item.url;
                  return (
                    <div
                      key={i}
                      onClick={() => setSelected(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius)',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--accent-surface)' : 'var(--surface)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {/* Thumbnail */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          overflow: 'hidden',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>IMG</span>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.source}</span>
                          {item.currentPrice !== null && (
                            <span style={{ color: 'var(--success)', fontWeight: 600, fontFamily: 'monospace' }}>
                              {item.currency === 'INR' ? '₹' : '$'}{item.currentPrice?.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={12} color="var(--text-tertiary)" />
                        </a>
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-strong)'}`,
                            background: isSelected ? 'var(--accent)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isSelected && <Check size={9} color="white" strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <hr className="divider" />

          {/* Settings Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Target Value */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                Target Threshold
              </label>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. 1600"
                className="input"
              />
            </div>

            {/* Frequency */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                Check Frequency
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFreq(f.value)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: 6,
                      border: `1px solid ${freq === f.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: freq === f.value ? 'var(--accent-surface)' : 'var(--surface)',
                      color: freq === f.value ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bank Discounts (E-Commerce only) */}
          {analysis.type === 'ECOMMERCE' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CreditCard size={12} />
                  Bank Discounts
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={coupons} onChange={(e) => setCoupons(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  Apply coupons
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {BANKS.map((b) => {
                  const checked = banks.includes(b);
                  return (
                    <button
                      key={b}
                      onClick={() => toggleBank(b)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                        background: checked ? 'var(--accent-surface)' : 'var(--surface)',
                        color: checked ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={deploy} disabled={submitting} className="btn btn-primary">
            {submitting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={13} />}
            {submitting ? 'Creating...' : 'Create Monitor'}
          </button>
        </div>
      </div>
    </div>
  );
}
