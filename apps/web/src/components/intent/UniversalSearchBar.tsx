'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, Loader2, TrendingUp, ShoppingBag, Briefcase, Globe } from 'lucide-react';
import { api } from '@/lib/api';
import { ParseIntentResponse } from '@omnisentinel/shared';
import { useToast } from '../common/Toast';

interface UniversalSearchBarProps {
  onParsed: (result: ParseIntentResponse) => void;
}

const PRESETS = [
  { icon: TrendingUp, label: 'Stock alert', prompt: 'Alert me when Airtel stock drops below 1600' },
  { icon: ShoppingBag, label: 'Price drop', prompt: 'Notify me when Nike Air Max drops below 3000 on Amazon with HDFC card' },
  { icon: Briefcase, label: 'Job board', prompt: 'Remote MERN internship with at least 25000 stipend' },
  { icon: Globe, label: 'Web change', prompt: 'Alert me when Delhi University releases the cutoff list' },
];

export function UniversalSearchBar({ onParsed }: UniversalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const run = async (prompt: string) => {
    if (!prompt.trim() || prompt.length < 3) {
      toast('error', 'Too short', 'Describe what you want to track in a few words.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.parseIntent(prompt);
      onParsed(result);
    } catch (err: any) {
      toast('error', 'Could not classify intent', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      {/* Search Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--surface)',
          border: `1px solid ${isFocused ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '10px 14px',
          transition: 'border-color 150ms ease',
        }}
      >
        {isLoading ? (
          <Loader2 size={16} color="var(--accent)" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />
        ) : (
          <Search size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
        )}

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && run(query)}
          disabled={isLoading}
          placeholder="Describe what you want to track... (⌘K)"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: 14,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <kbd
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: 'inherit',
            }}
          >
            ↵
          </kbd>
          <button
            onClick={() => run(query)}
            disabled={isLoading || !query.trim()}
            className="btn btn-primary"
            style={{ padding: '5px 12px', fontSize: 13 }}
          >
            Analyze
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Preset quick picks */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginRight: 2 }}>Try:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => { setQuery(p.prompt); run(p.prompt); }}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            <p.icon size={12} />
            {p.label}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
