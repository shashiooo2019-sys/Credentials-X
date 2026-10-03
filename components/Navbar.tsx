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
      {/* Top Banner: Dark Blue Aviation Finish with Sapphire Trim */}
      <div className="w-full flex justify-center bg-transparent px-2 sm:px-4 lg:px-8">
        <div className="w-full max-w-7xl bg-gradient-to-b from-[#0e1d3e] via-[#09142c] to-[#050b18] text-white rounded-b-2xl border-b-2 border-x border-blue-500/30 shadow-[0_16px_32px_-4px_rgba(2,6,23,0.7),inset_0_1px_0_rgba(147,197,253,0.3),inset_0_-1px_0_rgba(0,0,0,0.8)] px-4 sm:px-6 py-2.5 backdrop-blur-md relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-4px_rgba(37,99,235,0.25)]">
          {/* Subtle sapphire reflection streak */}
          <div className="pointer-events-none absolute -top-12 -left-12 h-32 w-32 rounded-full bg-blue-500/10 blur-xl" />
          <div className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-sky-400/10 blur-xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Brand Identity / Aviation Medallion */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-blue-500 via-blue-600 to-indigo-900 text-white shadow-[0_4px_10px_rgba(37,99,235,0.4),inset_0_1px_0_rgba(255,255,255,0.4)] border border-blue-400/50 ring-2 ring-blue-500/20 font-bold transition-transform duration-200 hover:scale-105 hover:-translate-y-0.5">
                <Plane className="h-5 w-5 transform -rotate-45 text-white drop-shadow-sm" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-tight text-white text-sm sm:text-base leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    LHG Credentials Verification
                  </span>
                  <span className="hidden sm:inline-block rounded-md bg-gradient-to-b from-blue-600 to-indigo-900 px-2 py-0.5 text-[10px] font-extrabold text-sky-100 shadow-sm border border-blue-400/40">
                    DELSM
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3 w-3 text-sky-400 shrink-0" />
                  <span>Audit Cycle: <strong className="text-sky-200 font-bold tracking-wide">{currentFortnightLabel}</strong></span>
                </span>
              </div>
            </div>

            {/* Operations Status Pill */}
            <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-blue-950/80 px-3 py-1.5 border border-blue-800/60 text-[11px] font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Operations &amp; Security</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Bar with Dark Blue Styling */}
      <div className="w-full border-b border-blue-900/40 bg-gradient-to-b from-[#081329]/95 via-[#060e20]/95 to-[#040916]/95 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(59,130,246,0.15)] mt-1">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-wrap min-h-14 py-2 items-center justify-between gap-2.5">
          {/* Left badge indicator */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-b from-blue-950/80 to-slate-950 text-slate-200 border border-blue-900/60 shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse" />
              <span className="font-extrabold text-white">Ground Operations</span>
              <span className="text-blue-900">·</span>
              <span className="text-slate-400 hidden sm:inline">Station Access Audit</span>
            </span>
          </div>

          {/* Mode Switcher Tabs & Admin Logout */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center rounded-xl bg-[#070f22] p-1 border border-blue-900/50 text-xs sm:text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
              <button
                onClick={() => setActiveTab('user')}
                className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 py-1.5 font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  activeTab === 'user'
                    ? 'darkblue-btn-primary text-white'
                    : 'text-slate-400 hover:text-white hover:-translate-y-0.5'
                }`}
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                <span>Staff Verification</span>
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 py-1.5 font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  activeTab === 'admin'
                    ? 'darkblue-btn-primary text-white'
                    : 'text-slate-400 hover:text-white hover:-translate-y-0.5'
                }`}
              >
                <Lock className="h-4 w-4 shrink-0" />
                <span>Admin Portal</span>
              </button>
            </div>

            {/* Admin Logout button if logged in */}
            {activeTab === 'admin' && isAdminAuthenticated && (
              <button
                onClick={onAdminLogout}
                title="Sign out of Admin"
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-gradient-to-b from-rose-900/80 via-rose-950 to-slate-950 px-3 py-1.5 text-xs font-bold text-rose-200 shadow-[0_3px_8px_rgba(225,29,72,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(225,29,72,0.4)] active:translate-y-0.5 transition-all duration-200 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
