'use client';

import React from 'react';
import { ShieldCheck, UserCheck, Lock, LogOut, Calendar } from 'lucide-react';

interface NavbarProps {
  activeTab: 'user' | 'admin';
  setActiveTab: (tab: 'user' | 'admin') => void;
  isAdminAuthenticated: boolean;
  onAdminLogout: () => void;
  currentFortnightLabel: string;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  isAdminAuthenticated,
  onAdminLogout,
  currentFortnightLabel
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full shadow-xs">
      {/* Top Banner (half width, centered) */}
      <div className="w-full flex justify-center bg-transparent">
        <div className="w-full sm:w-1/2 max-w-xl bg-gradient-to-r from-sky-950 via-slate-900 to-sky-950 text-white rounded-b-xl border-b border-x border-sky-800/60 shadow-md px-4 sm:px-6 py-2">
          {/* Brand Identity / Banner Title with note below */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-3 text-center sm:text-left">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm shadow-sky-600/30">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-white text-sm sm:text-base leading-tight">
                LHG Credentials Verification App
              </span>
              <span className="text-[11px] sm:text-xs text-sky-300 font-normal flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3 w-3 text-sky-400 shrink-0" />
                <span>Audit Cycle: <strong className="text-white font-medium">{currentFortnightLabel}</strong></span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Bar */}
      <div className="w-full border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex h-13 items-center justify-end">
          {/* Mode Switcher Tabs & Admin Logout */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm">
              <button
                onClick={() => setActiveTab('user')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                  activeTab === 'user'
                    ? 'bg-white text-sky-700 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>Staff Verification</span>
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                  activeTab === 'admin'
                    ? 'bg-white text-sky-700 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Lock className="h-4 w-4" />
                <span>Admin Portal</span>
              </button>
            </div>

            {/* Admin Logout button if logged in */}
            {activeTab === 'admin' && isAdminAuthenticated && (
              <button
                onClick={onAdminLogout}
                title="Sign out of Admin"
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-red-400 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
