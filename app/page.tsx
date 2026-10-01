'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import UserVerificationFlow from '@/components/UserVerificationFlow';
import AdminPortal from '@/components/AdminPortal';
import { ShieldCheck, Info, CheckCircle2, Sparkles, Calendar, Zap, Shield } from 'lucide-react';

function getInitialFortnightLabel(): string {
  const today = new Date();
  const day = today.getDate();
  const month = today.toLocaleString('default', { month: 'short' });
  const year = today.getFullYear();
  const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
  return day <= 15 ? `1-15 ${month} ${year}` : `16-${lastDay} ${month} ${year}`;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(sessionStorage.getItem('admin_session_token'));
    }
    return false;
  });

  const [currentFortnightLabel] = useState<string>(getInitialFortnightLabel);

  const handleAdminAuthenticated = () => {
    setIsAdminAuthenticated(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin_session_token', 'active-' + Date.now());
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_session_token');
    }
    setActiveTab('user');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/40 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40 dark:text-slate-100 flex flex-col font-sans relative selection:bg-blue-600 selection:text-white">
      {/* Rich ambient colorful lighting effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-500/10 to-cyan-400/10 blur-3xl dark:from-blue-600/15 dark:to-cyan-500/10" />
        <div className="absolute top-1/3 -right-32 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-purple-500/10 to-pink-400/10 blur-3xl dark:from-purple-600/15 dark:to-pink-500/10" />
        <div className="absolute bottom-10 left-10 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-emerald-400/10 to-teal-400/10 blur-3xl dark:from-emerald-600/15 dark:to-teal-500/10" />
        <div className="absolute top-2/3 left-1/3 h-[300px] w-[300px] rounded-full bg-amber-400/10 blur-3xl dark:bg-amber-500/10" />
      </div>

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminAuthenticated={isAdminAuthenticated}
        onAdminLogout={handleAdminLogout}
        currentFortnightLabel={currentFortnightLabel}
      />

      <main className="flex-1">
        {/* Staff Verification Flow */}
        {activeTab === 'user' && (
          <div>
            {/* Contextual notice with rich, colorful gradient styling and airline badge */}
            <div className="border-b border-indigo-200/70 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-2.5 px-4 text-center text-xs shadow-xs">
              <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-extrabold text-amber-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-amber-300/30">
                  <Zap className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                  Mandatory Bi-Weekly Audit Cycle:
                </span>
                <span className="font-medium text-slate-100">
                  All station staff must confirm active operational credentials for cycle{' '}
                  <strong className="font-bold text-slate-950 bg-amber-300 px-2 py-0.5 rounded-md border border-amber-400 shadow-2xs font-mono ml-1">
                    {currentFortnightLabel}
                  </strong>
                </span>
              </div>
            </div>

            <UserVerificationFlow />
          </div>
        )}

        {/* Administrator Portal */}
        {activeTab === 'admin' && (
          <div>
            <AdminPortal
              isAuthenticated={isAdminAuthenticated}
              onAuthenticated={handleAdminAuthenticated}
              onLogout={handleAdminLogout}
            />
          </div>
        )}
      </main>

      {/* Footer with colorful trust accents */}
      <footer className="border-t border-slate-200/90 bg-white/95 backdrop-blur-md py-6 dark:border-slate-800 dark:bg-slate-900/95 text-xs text-slate-500 shadow-xs mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs">
                LHG Credentials Verification Portal
              </span>
              <span className="text-[10px] text-slate-400">
                Lufthansa Group · DELSM Operations &amp; Security
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/60">
              <Calendar className="h-3 w-3 text-blue-600" />
              <span>Fortnight Cycles (1-15 &amp; 16-31)</span>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/60">
              <Shield className="h-3 w-3 text-purple-600" />
              <span>Live Firebase Firestore Sync</span>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Aviation Compliant &amp; Active</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
