'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SubmissionRecord, formatCredentialDisplay } from '@/lib/types';
import {
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  ArrowLeft,
  ShieldCheck,
  Mail,
  Send,
  Check,
  Copy,
  X,
  RefreshCw,
  Sparkles,
  Inbox,
  Lock,
  Shield
} from 'lucide-react';

export const OFFICIAL_REVIEW_EMAIL = 'Log-in Reviews - DELSM Operations and Security <ea8add7c.lufthansagroup.onmicrosoft.com@emea.teams.ms>';

interface PrintableReceiptProps {
  submission: SubmissionRecord;
  onReset: () => void;
  initialEmail?: string;
  autoTriggerEmail?: boolean;
}

export default function PrintableReceipt({
  submission,
  onReset,
  initialEmail,
  autoTriggerEmail
}: PrintableReceiptProps) {
  // Check if submission belongs to an ALS user
  const isAls = submission.verifications.some(
    v => (v.fieldKey === 'tac' && v.currentValue?.toUpperCase().includes('ALS')) ||
         v.fieldKey === 'lhalteaF' ||
         v.fieldKey === 'float'
  ) || Boolean(submission.exNumber && submission.exNumber !== 'N/A' && submission.exNumber.trim() !== '');

  const filteredVerifications = submission.verifications.filter(
    v => v.fieldKey !== 'wtTablet' && v.fieldKey !== 'alteaLxc'
  );

  // Simulated confirmation email state
  const [emailInput, setEmailInput] = useState(
    initialEmail || `${submission.uNumber.toLowerCase()}@lhg.com`
  );
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTimestamp, setSentTimestamp] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Dispatch simulated email
  const triggerSimulatedEmail = useCallback(async (targetEmail: string) => {
    setIsSendingEmail(true);

    try {
      await fetch('/api/credentials/simulate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officialRecipient: OFFICIAL_REVIEW_EMAIL,
          email: targetEmail.trim() || undefined,
          submissionId: submission.id,
          uNumber: submission.uNumber,
          name: submission.name,
          fortnightLabel: submission.fortnightLabel,
          status: submission.status
        })
      });
    } catch {
      // Fallback in case of network issue
    } finally {
      setIsSendingEmail(false);
      setEmailSent(true);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSentTimestamp(nowStr);
      setShowEmailModal(true);
    }
  }, [submission]);

  // Auto trigger simulated email if requested from flow
  useEffect(() => {
    if (autoTriggerEmail && !emailSent) {
      const timer = setTimeout(() => {
        triggerSimulatedEmail(emailInput);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoTriggerEmail, emailSent, emailInput, triggerSimulatedEmail]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyEmailBody = () => {
    let emailText = `FROM: no-reply.compliance@lhg.com\n`;
    emailText += `TO: ${OFFICIAL_REVIEW_EMAIL}\n`;
    if (emailInput && emailInput.trim()) {
      emailText += `CC: ${emailInput.trim()}\n`;
    }
    emailText += `SUBJECT: [CREDENTIALS VERIFICATION] - ${submission.uNumber} (${submission.name}) - ${submission.fortnightLabel}\n`;
    emailText += `DATE: ${new Date(submission.submittedAt).toUTCString()}\n\n`;
    emailText += `Official Review Destination: Log-in Reviews - DELSM Operations and Security\n`;
    emailText += `Staff Submitter: ${submission.name} (${submission.uNumber})\n\n`;
    emailText += `Staff credential verification has been successfully recorded in the audit database.\n\n`;
    emailText += `--- AUDIT SUMMARY ---\n`;
    emailText += `Submission ID   : ${submission.id}\n`;
    emailText += `Staff Name      : ${submission.name}\n`;
    emailText += `U-Number        : ${submission.uNumber}\n`;
    if (isAls) emailText += `EX-Number (ALS) : ${submission.exNumber || 'N/A'}\n`;
    emailText += `Audit Cycle     : ${submission.fortnightLabel}\n`;
    emailText += `Verification Date: ${submission.verificationDate}\n`;
    emailText += `Audit Status    : ${submission.status === 'CONFIRMED' ? '100% CONFIRMED' : 'CHANGE REQUEST(S) SUBMITTED'}\n`;
    emailText += `Confirmed Items : ${submission.confirmedCount} systems\n`;
    emailText += `Change Requests : ${submission.changeRequestCount} systems\n\n`;
    emailText += `--- CREDENTIALS BREAKDOWN ---\n`;
    filteredVerifications.forEach((v, idx) => {
      emailText += `${idx + 1}. ${v.fieldLabel}: ${formatCredentialDisplay(v.fieldKey, v.currentValue)} [${v.status === 'CONFIRMED' ? 'CONFIRMED' : 'CHANGE REQUESTED'}]`;
      if (v.remark) emailText += ` - Remark: ${v.remark}`;
      emailText += `\n`;
    });
    if (submission.overallRemarks) {
      emailText += `\nGeneral Remarks: ${submission.overallRemarks}\n`;
    }
    emailText += `\nDelivered to: Log-in Reviews - DELSM Operations and Security <ea8add7c.lufthansagroup.onmicrosoft.com@emea.teams.ms>\nGround Operations Access Management · Deutsche Lufthansa AG`;

    navigator.clipboard.writeText(emailText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadTxt = () => {
    let content = `=======================================================\n`;
    content += `LHG CREDENTIALS VERIFICATION RECEIPT\n`;
    content += `=======================================================\n`;
    content += `Submission ID   : ${submission.id}\n`;
    content += `Staff Name      : ${submission.name}\n`;
    content += `U-Number        : ${submission.uNumber}\n`;
    if (isAls) {
      content += `EX-Number (ALS) : ${submission.exNumber || 'N/A'}\n`;
    }
    content += `Verification Date: ${submission.verificationDate}\n`;
    content += `Fortnight Period : ${submission.fortnightLabel} (${submission.fortnightPeriod})\n`;
    content += `Timestamp       : ${new Date(submission.submittedAt).toLocaleString()}\n`;
    content += `Status          : ${submission.status === 'CONFIRMED' ? 'ALL CREDENTIALS CONFIRMED' : 'CHANGE REQUEST(S) SUBMITTED'}\n`;
    content += `-------------------------------------------------------\n`;
    content += `CREDENTIALS AUDIT BREAKDOWN:\n`;
    content += `-------------------------------------------------------\n`;

    filteredVerifications.forEach((v, idx) => {
      const displayVal = formatCredentialDisplay(v.fieldKey, v.currentValue);
      content += `${idx + 1}. ${v.fieldLabel}\n`;
      content += `   Assigned Value : ${displayVal}\n`;
      content += `   Status         : ${v.status === 'CONFIRMED' ? '[CONFIRMED WORKING]' : '[CHANGE REQUESTED]'}\n`;
      if (v.remark) {
        content += `   Remark         : ${v.remark}\n`;
      }
      content += `\n`;
    });

    if (submission.overallRemarks) {
      content += `Overall Remarks : ${submission.overallRemarks}\n`;
    }

    content += `=======================================================\n`;
    content += `Retain this copy for your bi-weekly audit records.\n`;
    content += `=======================================================\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LHG_Credential_Verification_${submission.uNumber}_${submission.verificationDate}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-3 sm:px-6 lg:px-8 flex-1 flex flex-col">
      {/* Top action bar (hidden during print) with Dark Blue Card Surface */}
      <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-4 darkblue-card rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-md border border-emerald-400/40 shrink-0">
            <CheckCircle2 className="h-6 w-6 drop-shadow-xs" />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-tight">
              Verification Successfully Submitted &amp; Logged!
            </h2>
            <p className="text-xs font-medium text-slate-300">
              Your bi-weekly credentials review has been recorded in the audit database.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => {
              if (!emailSent) {
                triggerSimulatedEmail(emailInput);
              } else {
                setShowEmailModal(true);
              }
            }}
            disabled={isSendingEmail}
            className="flex items-center justify-center gap-1.5 darkblue-btn-primary px-4 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {isSendingEmail ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Dispatching Email...</span>
              </>
            ) : emailSent ? (
              <>
                <Mail className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                <span>View Email Summary</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 shrink-0" />
                <span>Send Email Summary</span>
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 darkblue-btn-secondary px-3.5 py-2.5 text-xs font-bold text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={handleDownloadTxt}
            className="flex items-center justify-center gap-1.5 darkblue-btn-secondary px-3.5 py-2.5 text-xs font-bold text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 text-teal-400 shrink-0" />
            <span>Download (.TXT)</span>
          </button>
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-800/60 bg-slate-900/80 px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white hover:-translate-y-0.5 transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            <span>New Review</span>
          </button>
        </div>
      </div>

      {/* Email Confirmation Card with Official Recipient & Staff Copy */}
      <div className="print:hidden mb-6 darkblue-card rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-sky-500 to-blue-700 text-white shadow-md border border-sky-400/40 shrink-0 mt-0.5">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Compliance Email Notification
                </h3>
                {emailSent && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    <Check className="h-3 w-3" />
                    Dispatched
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Automatically submitted to <strong className="text-white">Log-in Reviews - DELSM Operations and Security</strong> and your email copy.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-sky-900/60 bg-[#0a152e] px-3 py-2 text-xs text-slate-200 shadow-inner">
              <Lock className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span className="font-mono text-[11px] truncate max-w-[200px] sm:max-w-[240px]" title={OFFICIAL_REVIEW_EMAIL}>
                DELSM Operations and Security
              </span>
            </div>

            <div className="relative">
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="Enter staff email copy..."
                className="w-48 sm:w-56 rounded-xl border border-sky-800/60 bg-[#070e20] px-3 py-2 text-xs font-medium text-white placeholder-slate-500 focus:border-sky-400 focus:outline-hidden shadow-inner"
              />
            </div>

            <button
              type="button"
              onClick={() => triggerSimulatedEmail(emailInput)}
              disabled={isSendingEmail}
              className="darkblue-btn-secondary px-3.5 py-2 text-xs font-bold text-slate-100 cursor-pointer disabled:opacity-50"
            >
              {isSendingEmail ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Dispatching...</span>
                </>
              ) : emailSent ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                  <span>Resend</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 text-sky-400" />
                  <span>Send</span>
                </>
              )}
            </button>

            {emailSent && (
              <button
                type="button"
                onClick={() => setShowEmailModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-950/60 px-3.5 py-2 text-xs font-bold text-sky-300 hover:bg-sky-900/60 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
              >
                <Inbox className="h-3.5 w-3.5 text-sky-400" />
                <span>View Email Preview</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Official Printable Document Container */}
      <div className="darkblue-card rounded-3xl p-6 sm:p-8 shadow-xl print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
        {/* Header */}
        <div className="border-b border-sky-900/60 pb-5 print:border-slate-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-sky-600 to-blue-900 text-white shadow-md border border-sky-400/40 print:bg-none print:text-black">
                <ShieldCheck className="h-7 w-7 text-sky-200" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white print:text-black">
                  LHG Credentials Verification Receipt
                </h1>
                <p className="text-xs font-semibold text-slate-300 print:text-slate-600">
                  Lufthansa Group · DELSM Ground Operations &amp; Security Audit
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-lg bg-[#070f24] border border-sky-700/60 px-3 py-1 text-xs font-mono font-bold text-sky-300 print:text-black print:border-slate-400">
                {submission.id}
              </span>
              <p className="mt-1 text-xs font-semibold text-slate-400 print:text-slate-600">
                Cycle: {submission.fortnightLabel}
              </p>
            </div>
          </div>
        </div>

        {/* User Identity Details Grid */}
        <div className={`my-6 grid grid-cols-2 ${isAls ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4 rounded-2xl bg-[#091530]/80 p-4 border border-sky-900/60 shadow-inner print:bg-slate-50 print:border-slate-300`}>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">Staff Name</span>
            <p className="text-sm font-black text-white print:text-black">{submission.name}</p>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">U-Number</span>
            <p className="text-sm font-mono font-bold text-sky-400 print:text-black">{submission.uNumber}</p>
          </div>
          {isAls && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">EX-Number (ALS)</span>
              <p className="text-sm font-mono font-bold text-slate-200 print:text-black">{submission.exNumber || 'N/A'}</p>
            </div>
          )}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">Verification Date</span>
            <p className="text-sm font-bold text-white print:text-black">{submission.verificationDate}</p>
          </div>
        </div>

        {/* Status Banner */}
        <div
          className={`mb-6 rounded-2xl p-4 text-xs flex items-center justify-between border shadow-sm ${
            submission.hasChangeRequests
              ? 'border-amber-500/60 bg-amber-950/40 text-amber-200 print:border-amber-400 print:bg-amber-50 print:text-amber-900'
              : 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200 print:border-emerald-400 print:bg-emerald-50 print:text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {submission.hasChangeRequests ? (
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            )}
            <span className="font-bold text-sm">
              {submission.hasChangeRequests
                ? `${submission.changeRequestCount} Change Request(s) flagged for IT resolution`
                : 'All Assigned Credentials Confirmed Working as Indicated'}
            </span>
          </div>
          <span className="font-mono text-xs font-bold">
            {submission.confirmedCount} Confirmed · {submission.changeRequestCount} Changes Requested
          </span>
        </div>

        {/* Credentials Breakdown Table */}
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-300 print:text-slate-700">
            System Credentials Audit Breakdown
          </h3>
          <div className="overflow-hidden rounded-2xl border border-sky-900/60 shadow-sm print:border-slate-300">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0b1b3d] text-slate-200 border-b border-sky-900/80 font-bold print:bg-slate-100 print:text-slate-800">
                <tr>
                  <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-[11px]">System / Credential</th>
                  <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-[11px]">Master Value</th>
                  <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-[11px]">Verification Status</th>
                  <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-[11px]">Staff Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-950/80 bg-[#070e20]/80 print:bg-white print:divide-slate-200">
                {submission.verifications.map((item, i) => (
                  <tr key={i} className="hover:bg-sky-950/40 transition-colors print:hover:bg-transparent">
                    <td className="py-3 px-3.5 font-bold text-white print:text-black">
                      {item.fieldLabel}
                    </td>
                    <td className="py-3 px-3.5 font-mono font-medium text-slate-200 print:text-black">
                      <span className="inline-block rounded-md bg-[#0a1633] border border-sky-800/60 px-2 py-0.5 text-xs font-bold text-sky-300 print:border-slate-300 print:text-black print:bg-slate-50">
                        {formatCredentialDisplay(item.fieldKey, item.currentValue)}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      {item.status === 'CONFIRMED' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold print:text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Confirmed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold print:text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Change Requested</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-slate-300 print:text-slate-700">
                      {item.remark ? (
                        <span className="italic font-medium">{item.remark}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overall remarks if provided */}
        {submission.overallRemarks && (
          <div className="mb-6 rounded-2xl bg-[#091530]/80 p-4 border border-sky-900/60 shadow-inner print:bg-slate-50 print:border-slate-300">
            <span className="text-xs font-bold text-slate-300 print:text-slate-700 uppercase tracking-wider">Additional Remarks:</span>
            <p className="mt-1.5 text-xs text-slate-200 print:text-slate-800 italic font-medium">{submission.overallRemarks}</p>
          </div>
        )}

        {/* Footer Audit Signature Block */}
        <div className="border-t border-sky-900/60 pt-5 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-4 print:border-slate-300 print:text-slate-600">
          <div>
            <p className="font-medium">Certified by Staff: <strong className="text-white print:text-black">{submission.name}</strong></p>
            <p className="text-[11px] text-slate-400">Timestamp: {new Date(submission.submittedAt).toUTCString()}</p>
          </div>
          <div className="text-right">
            <div className="inline-block border-b-2 border-dashed border-sky-700 pb-1 text-center min-w-[170px] print:border-slate-400">
              <span className="font-mono text-xs font-bold text-sky-300 print:text-black">System Verified &amp; Logged</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 font-medium">Ground Operations Access Management</p>
          </div>
        </div>
      </div>

      {/* Simulated Email Summary Modal Preview */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl darkblue-card shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col border border-sky-600/40">
            {/* Email Client Window Chrome */}
            <div className="bg-gradient-to-r from-[#070e20] via-[#0b1b3d] to-[#070e20] px-5 py-3.5 text-white flex items-center justify-between border-b border-sky-900/80">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500 shadow-xs" />
                  <div className="h-3 w-3 rounded-full bg-amber-500 shadow-xs" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-xs" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-sky-200 font-mono font-bold">
                  <Mail className="h-3.5 w-3.5 text-sky-400" />
                  <span>Simulated Corporate Email Preview</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-sky-900/50 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Email Envelope Metadata */}
            <div className="border-b border-sky-900/60 bg-[#091530] px-5 py-3.5 text-xs space-y-1.5 shadow-inner">
              <div className="flex items-baseline gap-2">
                <span className="w-16 font-bold text-slate-400">From:</span>
                <span className="font-mono text-slate-200 font-semibold">
                  no-reply.compliance@lhg.com <span className="text-slate-400 text-[11px]">&lt;LHG System Access &amp; Compliance&gt;</span>
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="w-16 font-bold text-slate-400">To:</span>
                <span className="font-mono font-bold text-sky-300">
                  {OFFICIAL_REVIEW_EMAIL}
                </span>
              </div>
              {emailInput && emailInput.trim() && (
                <div className="flex items-baseline gap-2">
                  <span className="w-16 font-bold text-slate-400">Cc:</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {emailInput.trim()} <span className="text-[10px] text-slate-400 font-normal">(Staff Copy)</span>
                  </span>
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <span className="w-16 font-bold text-slate-400">Date:</span>
                <span className="text-slate-300 font-medium">
                  {new Date().toLocaleString()} ({sentTimestamp ? `Dispatched at ${sentTimestamp}` : 'Live'})
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="w-16 font-bold text-slate-400">Subject:</span>
                <span className="font-bold text-white">
                  [CREDENTIALS VERIFICATION] - {submission.uNumber} ({submission.name}) - {submission.fortnightLabel}
                </span>
              </div>
            </div>

            {/* Email Message Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-200 bg-[#060c1c]">
              {/* Compliance Disclaimer Notice */}
              <div className="rounded-2xl border border-amber-500/60 bg-amber-950/40 p-3.5 text-amber-200 text-xs flex items-start gap-2.5 shadow-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <p className="font-bold">Compliance Notice (Simulated Email)</p>
                  <p className="mt-0.5 text-amber-100/90 leading-relaxed font-medium">
                    Due to compliance reasons, this App is presently not transmitting any emails. Please view the Simulated Corporate Email Preview and take a screenshot or copy text for your records.
                  </p>
                </div>
              </div>

              {/* LHG Corporate Email Banner */}
              <div className="rounded-2xl bg-gradient-to-r from-[#0a1633] via-[#0f2452] to-[#0a1633] text-white p-4.5 flex items-center justify-between shadow-md border border-sky-700/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-sky-500 to-blue-700 text-white shadow-sm border border-sky-400/40">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm tracking-wide">
                      Lufthansa Group (LHG)
                    </h4>
                    <p className="text-[11px] text-sky-200 font-medium">
                      Ground Operations · Bi-Weekly System Access Audit
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] font-bold text-sky-300">
                  Cycle: {submission.fortnightLabel}
                </div>
              </div>

              {/* Greeting */}
              <div>
                <p className="text-sm font-bold text-white">
                  Dear {submission.name},
                </p>
                <p className="mt-1 text-slate-300 leading-relaxed font-medium">
                  This confirmation email summarizes your submitted bi-weekly credential verification audit. Your responses have been safely registered with Ground Operations IT and Compliance.
                </p>
              </div>

              {/* Status Badge */}
              <div
                className={`rounded-xl p-3.5 border flex items-center justify-between shadow-xs ${
                  submission.hasChangeRequests
                    ? 'border-amber-500/50 bg-amber-950/30 text-amber-200'
                    : 'border-emerald-500/50 bg-emerald-950/30 text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {submission.hasChangeRequests ? (
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  )}
                  <span className="font-black">
                    {submission.hasChangeRequests
                      ? `${submission.changeRequestCount} Change Request(s) Flagged for Review`
                      : 'All Assigned Credentials Confirmed (100% Compliant)'}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold">
                  {submission.confirmedCount} Confirmed · {submission.changeRequestCount} Changes
                </span>
              </div>

              {/* Reference Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#091530] p-3.5 rounded-xl border border-sky-900/60 font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">U-NUMBER</span>
                  <span className="font-bold text-sky-400">{submission.uNumber}</span>
                </div>
                {isAls && (
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">EX-NUMBER (ALS)</span>
                    <span className="font-medium text-slate-200">{submission.exNumber || 'N/A'}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">VERIFIED DATE</span>
                  <span className="font-medium text-slate-200">{submission.verificationDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">SUBMISSION ID</span>
                  <span className="truncate block font-medium text-slate-200">{submission.id}</span>
                </div>
              </div>

              {/* Systems Breakdown */}
              <div>
                <h5 className="font-black text-white uppercase tracking-wider text-[11px] mb-2">
                  Verified System Access Credentials
                </h5>
                <div className="rounded-xl border border-sky-900/60 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b1b3d] text-slate-200 border-b border-sky-900/80">
                      <tr>
                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">System</th>
                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Assigned Access</th>
                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-950/80 text-[11px] bg-[#070e20]">
                      {filteredVerifications.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-bold text-white">
                            {item.fieldLabel}
                          </td>
                          <td className="py-2 px-3 font-mono font-medium text-slate-200">
                            {formatCredentialDisplay(item.fieldKey, item.currentValue)}
                          </td>
                          <td className="py-2 px-3">
                            {item.status === 'CONFIRMED' ? (
                              <span className="text-emerald-400 font-bold">
                                Confirmed
                              </span>
                            ) : (
                              <span className="text-amber-400 font-bold">
                                Change Requested
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-300 italic">
                            {item.remark || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {submission.overallRemarks && (
                <div className="rounded-xl bg-[#091530] p-3.5 border border-sky-900/60">
                  <span className="font-bold text-slate-300">Staff General Remarks:</span>
                  <p className="mt-1 text-slate-200 italic font-medium">{submission.overallRemarks}</p>
                </div>
              )}

              {/* Next Steps Notice */}
              <div className="rounded-xl bg-sky-950/40 p-3.5 border border-sky-800/50 text-slate-300 leading-relaxed text-[11px]">
                <p className="font-bold text-sky-300 mb-0.5">
                  Notice:
                </p>
                <p>
                  If you flagged any change requests, Ground Operations IT coordinators will review your remarks. You will receive an update once systems access has been reprovisioned.
                </p>
              </div>

              <div className="border-t border-sky-900/60 pt-3 text-[11px] text-slate-400">
                <p className="font-medium">Ground Operations Systems Administration · Deutsche Lufthansa AG</p>
                <p className="mt-0.5 text-[10px]">Confidential corporate transmission. Retain for compliance audit purposes.</p>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="bg-[#091530] px-5 py-3.5 border-t border-sky-900/60 flex flex-wrap items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyEmailBody}
                  className="darkblue-btn-secondary px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  {copiedText ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-sky-400" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => triggerSimulatedEmail(emailInput)}
                  disabled={isSendingEmail}
                  className="darkblue-btn-secondary px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-sky-400 ${isSendingEmail ? 'animate-spin' : ''}`} />
                  <span>Resend Email</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="darkblue-btn-primary px-4 py-1.5 text-xs font-bold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
