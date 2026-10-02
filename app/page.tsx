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
    <div className="min-h-screen darkblue-mesh-bg text-slate-100 flex flex-col font-sans relative selection:bg-blue-600 selection:text-white">
      {/* Dark Blue Atmospheric Specular Ambient Lights */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 left-1/4 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-blue-600/15 to-indigo-900/10 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-sky-600/15 to-blue-950/20 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-950/30 blur-3xl" />
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
            {/* Dark Blue Contextual Notice with Luminous Accent */}
            <div className="border-b border-blue-900/50 bg-gradient-to-r from-slate-950 via-blue-950/80 to-slate-950 text-white py-3 px-4 text-center text-xs shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(59,130,246,0.2)] transition-all duration-200">
              <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-extrabold text-white bg-gradient-to-b from-blue-600 via-blue-700 to-indigo-900 px-3 py-1 rounded-lg border border-blue-400/40 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] hover:-translate-y-0.5 transition-transform duration-200">
                  <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  Audit Cycle:
                </span>
                <span className="font-medium text-slate-200">
                  All station staff must verify operational system credentials for cycle{' '}
                  <strong className="font-extrabold text-white bg-gradient-to-b from-blue-900/90 to-slate-900 px-2.5 py-1 rounded-md border border-blue-500/50 shadow-[0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(147,197,253,0.3)] font-mono ml-1 inline-block hover:-translate-y-0.5 transition-transform duration-200 text-sky-200">
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

      {/* Dark Blue Footer with Aviation Styling */}
      <footer className="border-t border-blue-900/60 bg-gradient-to-b from-slate-950 via-slate-950 to-[#050b18] py-6 text-xs text-slate-400 shadow-[0_-4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(59,130,246,0.15)] mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-blue-600 to-indigo-950 text-white shadow-[0_3px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] border border-blue-400/30 hover:-translate-y-0.5 transition-transform duration-200">
              <ShieldCheck className="h-4 w-4 text-sky-300" />
            </div>
            <div>
              <span className="font-extrabold text-white block text-xs tracking-tight">
                LHG Credentials Verification Portal
              </span>
              <span className="text-[10px] text-slate-400">
                Lufthansa Group · DELSM Operations &amp; Security
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-200 bg-gradient-to-b from-slate-900 to-blue-950 px-3 py-1 rounded-xl border border-blue-900/60 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-0.5 transition-transform duration-200">
              <Calendar className="h-3 w-3 text-sky-400" />
              <span>Fortnight Cycles (1-15 &amp; 16-31)</span>
            </span>
            <span className="text-blue-900">·</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-200 bg-gradient-to-b from-slate-900 to-blue-950 px-3 py-1 rounded-xl border border-blue-900/60 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-0.5 transition-transform duration-200">
              <Shield className="h-3 w-3 text-sky-400" />
              <span>Live Firestore Database Sync</span>
            </span>
            <span className="text-blue-900">·</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300 bg-gradient-to-b from-emerald-950/80 to-slate-950 px-3 py-1 rounded-xl border border-emerald-700/50 shadow-[0_2px_6px_rgba(5,150,105,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-0.5 transition-transform duration-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Aviation Compliant &amp; Active</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
