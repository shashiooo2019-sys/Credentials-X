'use client';

import React from 'react';
import { ShieldCheck, UserCheck, Lock, LogOut, Calendar, Plane } from 'lucide-react';

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
      {/* Top Banner: Silver 3D Metallic Finish with Depth & Brushed Titanium Trim */}
      <div className="w-full flex justify-center bg-transparent px-2 sm:px-4">
        <div className="w-full sm:w-11/12 max-w-3xl bg-gradient-to-b from-slate-800 via-slate-900 to-black text-white rounded-b-2xl border-b-2 border-x border-slate-400/60 shadow-[0_12px_24px_-4px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.8)] px-4 sm:px-6 py-2.5 backdrop-blur-md relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-4px_rgba(0,0,0,0.5)]">
          {/* Metallic brushed reflection streak */}
          <div className="pointer-events-none absolute -top-12 -left-12 h-32 w-32 rounded-full bg-slate-300/10 blur-xl" />
          <div className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-slate-400/10 blur-xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          <div className="flex items-center justify-between gap-3">
            {/* Brand Identity / 3D Silver Medallion */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-slate-100 via-slate-300 to-slate-400 text-slate-900 shadow-[0_4px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] border border-slate-300 ring-2 ring-slate-500/40 font-bold transition-transform duration-200 hover:scale-105 hover:-translate-y-0.5">
                <Plane className="h-5 w-5 transform -rotate-45 text-slate-800 drop-shadow-sm" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-tight text-slate-100 text-sm sm:text-base leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    LHG Credentials Verification
                  </span>
                  <span className="hidden sm:inline-block rounded-md bg-gradient-to-b from-slate-200 to-slate-400 px-2 py-0.5 text-[10px] font-extrabold text-slate-900 shadow-sm border border-slate-300">
                    DELSM
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3 w-3 text-slate-300 shrink-0" />
                  <span>Audit Cycle: <strong className="text-white font-bold tracking-wide">{currentFortnightLabel}</strong></span>
                </span>
              </div>
            </div>

            {/* Operations Status 3D Pill */}
            <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-slate-800/90 px-3 py-1.5 border border-slate-600/70 text-[11px] font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Operations &amp; Security</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Bar with 3D Silver Styling */}
      <div className="w-full border-b border-slate-300/80 bg-gradient-to-b from-slate-100 via-slate-200/90 to-slate-300/80 backdrop-blur-md dark:border-slate-700 dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-800 dark:to-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] mt-1">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
          {/* Left badge indicator */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-b from-white to-slate-200 text-slate-800 border border-slate-300 shadow-[0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] dark:from-slate-800 dark:to-slate-900 dark:text-slate-200 dark:border-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-400/40 animate-pulse" />
              <span className="font-extrabold text-slate-900 dark:text-white">Ground Operations</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 dark:text-slate-400 hidden sm:inline">Station Access Audit</span>
            </span>
          </div>

          {/* Mode Switcher 3D Tabs & Admin Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl bg-slate-300/70 p-1 dark:bg-slate-950/80 border border-slate-400/70 dark:border-slate-700 text-xs sm:text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]">
              <button
                onClick={() => setActiveTab('user')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === 'user'
                    ? 'titanium-btn-3d text-white'
                    : 'text-slate-700 hover:text-slate-900 hover:-translate-y-0.5 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>Staff Verification</span>
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'titanium-btn-3d text-white'
                    : 'text-slate-700 hover:text-slate-900 hover:-translate-y-0.5 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Lock className="h-4 w-4" />
                <span>Admin Portal</span>
              </button>
            </div>

            {/* Admin Logout 3D button if logged in */}
            {activeTab === 'admin' && isAdminAuthenticated && (
              <button
                onClick={onAdminLogout}
                title="Sign out of Admin"
                className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-gradient-to-b from-rose-100 via-rose-200 to-rose-300 px-3 py-1.5 text-xs font-bold text-rose-900 shadow-[0_3px_6px_rgba(225,29,72,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 hover:shadow-[0_6px_12px_rgba(225,29,72,0.25)] active:translate-y-0.5 transition-all duration-200 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-700" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
