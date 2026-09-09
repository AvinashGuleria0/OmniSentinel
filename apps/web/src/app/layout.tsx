import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/common/Toast';

export const metadata: Metadata = {
  title: 'OmniSentinel - Autonomous Multi-Source Tracking Platform',
  description:
    'Real-time autonomous tracking across e-commerce price drops, stock triggers, job postings, and dynamic web content with AI intent classification.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dark-950 text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
