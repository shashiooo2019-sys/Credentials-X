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
  Inbox
} from 'lucide-react';

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
    if (!targetEmail.trim()) return;
    setIsSendingEmail(true);

    try {
      await fetch('/api/credentials/simulate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail.trim(),
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
    emailText += `TO: ${emailInput}\n`;
    emailText += `SUBJECT: [CONFIRMATION] LHG Credentials Verification - ${submission.uNumber} (${submission.name})\n`;
    emailText += `DATE: ${new Date(submission.submittedAt).toUTCString()}\n\n`;
    emailText += `Dear ${submission.name},\n\n`;
    emailText += `Your bi-weekly staff credential verification has been successfully recorded in the LHG audit database.\n\n`;
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
    emailText += `\nPlease retain this simulated summary for your compliance records.\nGround Operations Access Management · Deutsche Lufthansa AG`;

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
    <div className="mx-auto max-w-4xl py-6 px-4 sm:px-6">
      {/* Top action bar (hidden during print) */}
      <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
              Verification Successfully Submitted!
            </h2>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Your bi-weekly credentials review has been recorded in the audit database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!emailSent) {
                triggerSimulatedEmail(emailInput);
              } else {
                setShowEmailModal(true);
              }
            }}
            disabled={isSendingEmail}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-colors disabled:opacity-60"
          >
            {isSendingEmail ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Dispatching Email...</span>
              </>
            ) : emailSent ? (
              <>
                <Mail className="h-4 w-4" />
                <span>View Email Summary</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Send Email Summary</span>
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Printer className="h-4 w-4" />
            <span>Print / Save PDF</span>
          </button>
          <button
            onClick={handleDownloadTxt}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download (.TXT)</span>
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>New Verification</span>
          </button>
        </div>
      </div>

      {/* Simulated Email Confirmation Card (Hidden during print) */}
      <div className="print:hidden mb-6 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50/50 p-4.5 dark:border-sky-900/60 dark:bg-gradient-to-r dark:from-sky-950/30 dark:via-slate-900 dark:to-sky-950/20 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs shrink-0 mt-0.5">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Simulated Confirmation Email Summary
                </h3>
                {emailSent && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <Check className="h-3 w-3" />
                    Sent
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {emailSent
                  ? `Confirmation email summary was simulated and dispatched to ${emailInput} at ${sentTimestamp}.`
                  : 'Receive a simulated executive confirmation email summary of this audit verification in your corporate inbox.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="staff.email@lhg.com"
                className="w-56 sm:w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={() => triggerSimulatedEmail(emailInput)}
              disabled={isSendingEmail || !emailInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition-colors disabled:opacity-50"
            >
              {isSendingEmail ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Dispatching...</span>
                </>
              ) : emailSent ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Resend Email</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Email Summary</span>
                </>
              )}
            </button>

            {emailSent && (
              <button
                type="button"
                onClick={() => setShowEmailModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 transition-colors"
              >
                <Inbox className="h-3.5 w-3.5" />
                <span>View Email Preview</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Official Printable Document Container */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  LHG Credentials Verification Receipt
                </h1>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {submission.id}
              </span>
              <p className="mt-1 text-xs text-slate-500">
                Cycle: {submission.fortnightLabel}
              </p>
            </div>
          </div>
        </div>

        {/* User Identity Details Grid */}
        <div className={`my-6 grid grid-cols-2 ${isAls ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800`}>
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Staff Name</span>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{submission.name}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">U-Number</span>
            <p className="text-sm font-mono font-bold text-sky-600 dark:text-sky-400">{submission.uNumber}</p>
          </div>
          {isAls && (
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">EX-Number (ALS)</span>
              <p className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">{submission.exNumber || 'N/A'}</p>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Verification Date</span>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{submission.verificationDate}</p>
          </div>
        </div>

        {/* Status Banner */}
        <div
          className={`mb-6 rounded-lg p-3 text-xs flex items-center justify-between border ${
            submission.hasChangeRequests
              ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200'
              : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/20 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {submission.hasChangeRequests ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span className="font-semibold">
              {submission.hasChangeRequests
                ? `${submission.changeRequestCount} Change Request(s) flagged for IT resolution`
                : 'All Assigned Credentials Confirmed Working as Indicated'}
            </span>
          </div>
          <span className="font-mono text-xs">
            {submission.confirmedCount} Confirmed · {submission.changeRequestCount} Changes Requested
          </span>
        </div>

        {/* Credentials Breakdown Table */}
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            System Credentials Audit Breakdown
          </h3>
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">System / Credential</th>
                  <th className="py-2.5 px-3 font-semibold">Master Value</th>
                  <th className="py-2.5 px-3 font-semibold">Verification Status</th>
                  <th className="py-2.5 px-3 font-semibold">Staff Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {submission.verifications.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                      {item.fieldLabel}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                      <span className="inline-block rounded-xs bg-slate-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-800">
                        {formatCredentialDisplay(item.fieldKey, item.currentValue)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {item.status === 'CONFIRMED' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Confirmed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Change Requested</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {item.remark ? (
                        <span className="italic">{item.remark}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
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
          <div className="mb-6 rounded-lg bg-slate-50 p-3.5 border border-slate-200 dark:bg-slate-800/40 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Additional Remarks:</span>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 italic">{submission.overallRemarks}</p>
          </div>
        )}

        {/* Footer Audit Signature Block */}
        <div className="border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p>Certified by Staff: <strong className="text-slate-800 dark:text-slate-200">{submission.name}</strong></p>
            <p className="text-[11px] text-slate-400">Timestamp: {new Date(submission.submittedAt).toUTCString()}</p>
          </div>
          <div className="text-right">
            <div className="inline-block border-b border-dashed border-slate-400 pb-1 text-center min-w-[160px]">
              <span className="font-mono text-xs text-slate-700 dark:text-slate-300">System Verified & Logged</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Ground Operations Access Management</p>
          </div>
        </div>
      </div>

      {/* Simulated Email Summary Modal Preview */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[90vh] flex flex-col">
            {/* Email Client Window Chrome */}
            <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500" />
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                  <Mail className="h-3.5 w-3.5 text-sky-400" />
                  <span>Simulated Corporate Email Preview</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Email Envelope Metadata */}
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-800/50 space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="w-16 font-semibold text-slate-500 dark:text-slate-400">From:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  no-reply.compliance@lhg.com <span className="text-slate-400 text-[11px]">&lt;LHG System Access & Compliance&gt;</span>
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="w-16 font-semibold text-slate-500 dark:text-slate-400">To:</span>
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                  {emailInput}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="w-16 font-semibold text-slate-500 dark:text-slate-400">Date:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date().toLocaleString()} ({sentTimestamp ? `Simulated at ${sentTimestamp}` : 'Live'})
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="w-16 font-semibold text-slate-500 dark:text-slate-400">Subject:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  [AUDIT CONFIRMATION] LHG Credentials Verification - {submission.uNumber} ({submission.name})
                </span>
              </div>
            </div>

            {/* Email Message Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-800 dark:text-slate-200">
              {/* LHG Corporate Email Banner */}
              <div className="rounded-xl bg-gradient-to-r from-sky-950 via-slate-900 to-sky-950 text-white p-4.5 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white shadow-xs">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm tracking-wide">
                      Lufthansa Group (LHG)
                    </h4>
                    <p className="text-[11px] text-sky-200">
                      Ground Operations · Bi-Weekly System Access Audit
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] text-sky-300">
                  Cycle: {submission.fortnightLabel}
                </div>
              </div>

              {/* Greeting */}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Dear {submission.name},
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                  This confirmation email summarizes your submitted bi-weekly credential verification audit. Your responses have been safely registered with Ground Operations IT and Compliance.
                </p>
              </div>

              {/* Status Badge */}
              <div
                className={`rounded-lg p-3 border flex items-center justify-between ${
                  submission.hasChangeRequests
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {submission.hasChangeRequests ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className="font-bold">
                    {submission.hasChangeRequests
                      ? `${submission.changeRequestCount} Change Request(s) Flagged for Review`
                      : 'All Assigned Credentials Confirmed (100% Compliant)'}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-semibold">
                  {submission.confirmedCount} Confirmed · {submission.changeRequestCount} Changes
                </span>
              </div>

              {/* Reference Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">U-NUMBER</span>
                  <span className="font-bold text-sky-600">{submission.uNumber}</span>
                </div>
                {isAls && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">EX-NUMBER (ALS)</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{submission.exNumber || 'N/A'}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[10px]">VERIFIED DATE</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{submission.verificationDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SUBMISSION ID</span>
                  <span className="truncate block font-medium text-slate-700 dark:text-slate-200">{submission.id}</span>
                </div>
              </div>

              {/* Systems Breakdown */}
              <div>
                <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
                  Verified System Access Credentials
                </h5>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-3 font-semibold">System</th>
                        <th className="py-2 px-3 font-semibold">Assigned Access</th>
                        <th className="py-2 px-3 font-semibold">Status</th>
                        <th className="py-2 px-3 font-semibold">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {filteredVerifications.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                            {item.fieldLabel}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {formatCredentialDisplay(item.fieldKey, item.currentValue)}
                          </td>
                          <td className="py-2 px-3">
                            {item.status === 'CONFIRMED' ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                Confirmed
                              </span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                Change Requested
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300 italic">
                            {item.remark || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {submission.overallRemarks && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-3 border border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Staff General Remarks:</span>
                  <p className="mt-1 text-slate-600 dark:text-slate-300 italic">{submission.overallRemarks}</p>
                </div>
              )}

              {/* Next Steps Notice */}
              <div className="rounded-lg bg-sky-50 dark:bg-sky-950/20 p-3 border border-sky-100 dark:border-sky-900/50 text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                <p className="font-semibold text-sky-900 dark:text-sky-200 mb-0.5">
                  Notice:
                </p>
                <p>
                  If you flagged any change requests, Ground Operations IT coordinators will review your remarks. You will receive an update once systems access has been reprovisioned.
                </p>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 text-[11px] text-slate-400">
                <p>Ground Operations Systems Administration · Deutsche Lufthansa AG</p>
                <p className="mt-0.5 text-[10px]">Confidential corporate transmission. Retain for compliance audit purposes.</p>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="bg-slate-50 dark:bg-slate-800/80 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyEmailBody}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
                >
                  {copiedText ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Email Text</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => triggerSimulatedEmail(emailInput)}
                  disabled={isSendingEmail}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
                  <span>Resend Email</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors"
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
