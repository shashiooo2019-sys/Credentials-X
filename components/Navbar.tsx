'use client';

import React from 'react';
import { ShieldCheck, UserCheck, Lock, LogOut, Calendar, Plane, Sparkles } from 'lucide-react';

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
    <header className="sticky top-0 z-40 w-full">
      {/* Top Banner: Rich Airline Deep Navy & Sapphire with Warm Amber Glow & Golden Trim */}
      <div className="w-full flex justify-center bg-transparent px-2 sm:px-4">
        <div className="w-full sm:w-11/12 max-w-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-b-2xl border-b-2 border-x border-amber-400/40 shadow-xl px-4 sm:px-6 py-2.5 backdrop-blur-md relative overflow-hidden">
          {/* Subtle colorful light accents inside banner */}
          <div className="pointer-events-none absolute -top-8 -left-8 h-24 w-24 rounded-full bg-blue-500/20 blur-xl" />
          <div className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-amber-500/20 blur-xl" />

          <div className="flex items-center justify-between gap-3">
            {/* Brand Identity / Banner Title */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 text-slate-950 shadow-md shadow-amber-500/30 ring-2 ring-amber-300/40 font-bold">
                <Plane className="h-5 w-5 transform -rotate-45 text-slate-950" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-tight text-white text-sm sm:text-base leading-tight drop-shadow-xs">
                    LHG Credentials Verification
                  </span>
                  <span className="hidden sm:inline-block rounded-sm bg-amber-400/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-300 border border-amber-400/30">
                    DELSM
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3 w-3 text-amber-400 shrink-0" />
                  <span>Audit Cycle: <strong className="text-white font-semibold">{currentFortnightLabel}</strong></span>
                </span>
              </div>
            </div>

            {/* Quick badge */}
            <div className="hidden md:flex items-center gap-1.5 rounded-full bg-blue-900/60 px-3 py-1 border border-blue-700/50 text-[11px] font-medium text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Operations &amp; Security</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Bar with crisp glassmorphic backdrop */}
      <div className="w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 shadow-xs mt-1">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
          {/* Left badge indicator */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 text-indigo-900 border border-indigo-200/80 dark:from-indigo-950/60 dark:via-slate-900 dark:to-purple-950/60 dark:text-indigo-200 dark:border-indigo-800/80 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-400/40" />
              <span className="font-bold text-indigo-950 dark:text-indigo-200">Ground Operations</span>
              <span className="text-indigo-400 dark:text-indigo-600">·</span>
              <span className="text-slate-600 dark:text-slate-400 hidden sm:inline">Station Compliance</span>
            </span>
          </div>

          {/* Mode Switcher Tabs & Admin Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm shadow-inner">
              <button
                onClick={() => setActiveTab('user')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-bold transition-all duration-200 ${
                  activeTab === 'user'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-sm shadow-blue-500/25 ring-1 ring-white/20'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <UserCheck className="h-4 w-4 text-white" />
                <span>Staff Verification</span>
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-bold transition-all duration-200 ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-700 text-white shadow-sm shadow-purple-500/25 ring-1 ring-white/20'
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
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:from-rose-100 hover:to-red-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition-colors shadow-2xs"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
