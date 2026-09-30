'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import UserVerificationFlow from '@/components/UserVerificationFlow';
import AdminPortal from '@/components/AdminPortal';
import { ShieldCheck, Info, CheckCircle2 } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans">
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
            {/* Contextual notice */}
            <div className="border-b border-sky-100 bg-sky-50/60 dark:border-sky-950 dark:bg-sky-950/20 py-2.5 px-4 text-center text-xs text-sky-900 dark:text-sky-300">
              <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-center gap-2">
                <span className="flex items-center gap-1 font-semibold">
                  <Info className="h-3.5 w-3.5 text-sky-600" />
                  Bi-Weekly Audit Requirement:
                </span>
                <span>
                  All station staff must confirm active operational credentials for cycle{' '}
                  <strong>{currentFortnightLabel}</strong>.
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

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-900 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-600" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              LHG Credentials Verification App
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Fortnight Audits (1-15 & 16-31)</span>
            <span>·</span>
            <span>Master PDF Database Registry</span>
            <span>·</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>Compliant & Active</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
