'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, TrendingUp, ShoppingBag, Briefcase, Globe, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ParseIntentResponse } from '@omnisentinel/shared';
import { useToast } from '../common/Toast';

interface UniversalSearchBarProps {
  onParsed: (result: ParseIntentResponse) => void;
  isOpenModal?: boolean;
}

const SAMPLE_PROMPTS = [
  { text: 'Alert me when Nike Air Max drops below 3000 on Amazon with HDFC card', type: 'ECOMMERCE', label: 'E-Commerce' },
  { text: 'Notify me when Airtel stock drops below 1600', type: 'STOCK', label: 'Stocks' },
  { text: 'Remote MERN stack internship with at least 25000 stipend', type: 'JOB', label: 'Jobs' },
  { text: 'Alert me when Delhi University releases the cutoff list', type: 'GENERIC_WEB', label: 'Web Scrape' },
];

export function UniversalSearchBar({ onParsed }: UniversalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Keyboard shortcut: Cmd+K or Ctrl+K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Rotate placeholder every 4.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SAMPLE_PROMPTS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async (promptToUse?: string) => {
    const text = promptToUse || query;
    if (!text.trim() || text.length < 3) {
      toast('error', 'Prompt too short', 'Please describe your monitoring intent in at least 3 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.parseIntent(text);
      onParsed(response);
      toast('success', 'Intent Decoded', `Detected ${response.analysis.type} alert with ${Math.round(response.analysis.confidence * 100)}% confidence.`);
    } catch (err: any) {
      toast('error', 'Classification Failed', err.message || 'Could not parse intent');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSearch();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-10">
      {/* Primary Input Container with Glowing Cyber Frame */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 rounded-2xl blur-md opacity-30 group-hover:opacity-60 transition duration-500 group-focus-within:opacity-80"></div>

        <div className="relative flex items-center bg-dark-900/90 border border-cyan-500/20 rounded-2xl px-4 py-3.5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 mr-3 flex-shrink-0">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={`e.g. "${SAMPLE_PROMPTS[placeholderIndex].text}"`}
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 tracking-wide"
          />

          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <button
              onClick={() => handleSearch()}
              disabled={isLoading || !query.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-glow-cyan"
            >
              <span>Analyze</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Preset Quick Intent Chips */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="text-slate-400 font-medium mr-1 text-[11px] uppercase tracking-wider">Try Presets:</span>
        {SAMPLE_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuery(p.text);
              handleSearch(p.text);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-850/80 hover:bg-dark-800 text-slate-300 hover:text-cyan-400 border border-white/[0.06] hover:border-cyan-500/30 transition-all"
          >
            {p.type === 'STOCK' && <TrendingUp className="w-3 h-3 text-cyan-400" />}
            {p.type === 'ECOMMERCE' && <ShoppingBag className="w-3 h-3 text-emerald-400" />}
            {p.type === 'JOB' && <Briefcase className="w-3 h-3 text-violet-400" />}
            {p.type === 'GENERIC_WEB' && <Globe className="w-3 h-3 text-amber-400" />}
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
