'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import UserVerificationFlow from '@/components/UserVerificationFlow';
import AdminPortal from '@/components/AdminPortal';
import { ShieldCheck, CheckCircle2, Calendar, Zap, Shield } from 'lucide-react';

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
    <div className="min-h-screen silver-mesh-bg text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans relative selection:bg-slate-800 selection:text-white">
      {/* 3D Silver Metallic Ambient Specular Layers */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-white/40 to-slate-300/20 blur-3xl dark:from-slate-700/15 dark:to-slate-800/10" />
        <div className="absolute top-1/3 -right-32 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-slate-200/50 to-slate-400/20 blur-3xl dark:from-slate-800/20 dark:to-slate-900/10" />
        <div className="absolute bottom-10 left-10 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-white/30 to-slate-300/30 blur-3xl dark:from-slate-700/10 dark:to-slate-800/10" />
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
            {/* 3D Contextual Notice with Metallic Silver Depth */}
            <div className="border-b border-slate-300/90 bg-gradient-to-r from-slate-800 via-slate-900 to-black text-white py-3 px-4 text-center text-xs shadow-[0_4px_10px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-200">
              <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-extrabold text-slate-900 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 px-3 py-1 rounded-lg border border-slate-300 shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 transition-transform duration-200">
                  <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  Audit Cycle:
                </span>
                <span className="font-medium text-slate-200">
                  All station staff must verify operational system credentials for cycle{' '}
                  <strong className="font-extrabold text-slate-950 bg-gradient-to-b from-white via-slate-100 to-slate-200 px-2.5 py-1 rounded-md border border-slate-400 shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,1)] font-mono ml-1 inline-block hover:-translate-y-0.5 transition-transform duration-200">
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

      {/* 3D Silver Footer with Depth */}
      <footer className="border-t border-slate-300/90 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300/90 py-6 dark:border-slate-800 dark:bg-gradient-to-b dark:from-slate-900 dark:to-black text-xs text-slate-600 shadow-[0_-4px_12px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-slate-700 to-slate-950 text-white shadow-[0_3px_6px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.3)] border border-slate-600 hover:-translate-y-0.5 transition-transform duration-200">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 dark:text-slate-100 block text-xs tracking-tight">
                LHG Credentials Verification Portal
              </span>
              <span className="text-[10px] text-slate-500">
                Lufthansa Group · DELSM Operations &amp; Security
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 bg-gradient-to-b from-white to-slate-200 dark:from-slate-800 dark:to-slate-900 px-3 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-[0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 transition-transform duration-200">
              <Calendar className="h-3 w-3 text-slate-700 dark:text-slate-300" />
              <span>Fortnight Cycles (1-15 &amp; 16-31)</span>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 bg-gradient-to-b from-white to-slate-200 dark:from-slate-800 dark:to-slate-900 px-3 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-[0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 transition-transform duration-200">
              <Shield className="h-3 w-3 text-slate-700 dark:text-slate-300" />
              <span>Live Firestore Database Sync</span>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 bg-gradient-to-b from-emerald-50 to-emerald-100 dark:from-emerald-950/60 dark:to-slate-900 px-3 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-[0_2px_4px_rgba(5,150,105,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 transition-transform duration-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Aviation Compliant &amp; Active</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
