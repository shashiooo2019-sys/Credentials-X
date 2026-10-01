'use client';

import React, { useState } from 'react';
import {
  UserCredentialRecord,
  SubmissionRecord,
  FieldVerification,
  CREDENTIAL_FIELD_CONFIG,
  CredentialFields,
  formatCredentialDisplay,
  isUserAls,
  isUserM365
} from '@/lib/types';
import PrintableReceipt from './PrintableReceipt';
import {
  Search,
  UserCheck,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Send,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Clock,
  Check,
  ListChecks,
  UserPlus,
  Mail,
  Lock,
  Shield
} from 'lucide-react';

export const OFFICIAL_REVIEW_EMAIL = 'Log-in Reviews - DELSM Operations and Security <ea8add7c.lufthansagroup.onmicrosoft.com@emea.teams.ms>';

export default function UserVerificationFlow() {
  // Wizard steps: 1 = Enter U-Num, 2 = Confirm ID & Date, 3 = Review Fields, 4 = Success/Receipt
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 states
  const [uNumberInput, setUNumberInput] = useState('');
  const [isLoadingLookup, setIsLoadingLookup] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ uNumber: string; name: string }>>([]);

  // Unlisted user prompt state (for users whose names do not appear in database)
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [inputtedName, setInputtedName] = useState('');
  const [inputtedExNumber, setInputtedExNumber] = useState('');
  const [isAlsRole, setIsAlsRole] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(null);

  // Step 2 states
  const [staffData, setStaffData] = useState<UserCredentialRecord | null>(null);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [verificationDate, setVerificationDate] = useState(() => {
    // Default to today's date YYYY-MM-DD
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Step 3 states: Field verifications dictionary
  const [fieldVerifications, setFieldVerifications] = useState<Record<string, { status: 'PENDING' | 'CONFIRMED' | 'CHANGE_REQUESTED' | 'NOT_APPLICABLE'; remark: string }>>({});
  const [overallRemarks, setOverallRemarks] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [autoSendEmail, setAutoSendEmail] = useState(true);

  // Step 4 state
  const [completedSubmission, setCompletedSubmission] = useState<SubmissionRecord | null>(null);

  // Helper: check if a field is visible for the current user
  const isFieldVisible = (cfg: (typeof CREDENTIAL_FIELD_CONFIG)[number]) => {
    if (!staffData) return false;
    // Omit fields WT Tablet and Altea LXCM
    if (cfg.key === 'wtTablet' || cfg.key === 'alteaLxc') return false;
    // For FLOAT, Backup FLOAT, LH Altea FM and LX Altea FM show only for ALS
    if (cfg.alsOnly && !isUserAls(staffData.credentials, staffData.exNumber)) {
      return false;
    }
    // For PKI show only for M365 users
    if (cfg.m365Only && !isUserM365(staffData.credentials)) {
      return false;
    }
    return true;
  };

  // Helper: check if a credential value requires verification (not 'N' and not empty)
  const isFieldActive = (value: string | undefined | null) => {
    if (!value) return false;
    const clean = String(value).trim().toUpperCase();
    if (clean === '' || clean === 'N' || clean === 'N/A' || clean === '["N"]') return false;
    return true;
  };

  // Lookup staff by U-number
  const handleLookup = async (uNumToSearch?: string) => {
    const query = (uNumToSearch || uNumberInput).trim();
    if (!query) {
      setLookupError('Please enter your U Number to continue.');
      return;
    }

    setIsLoadingLookup(true);
    setLookupError(null);
    setSuggestions([]);
    setShowNamePrompt(false);

    try {
      const res = await fetch(`/api/credentials/lookup?uNumber=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok || !data.found) {
        // User not in master database: Prompt user to input their name against U number!
        setShowNamePrompt(true);
        setUNumberInput(query.toUpperCase());
        setLookupError(null);
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
        return;
      }

      const staff: UserCredentialRecord = data.staff;
      // Ensure CUTE Access default is 'Y'
      if (!staff.credentials.cuteAccess) {
        staff.credentials.cuteAccess = 'Y';
      }

      setStaffData(staff);
      setUNumberInput(staff.uNumber);
      setRegistrationNotice(null);
      setConfirmationEmail(`${staff.uNumber.toLowerCase()}@lhg.com`);

      // Pre-initialize verification states for visible fields
      const initialVerifications: Record<string, { status: 'PENDING' | 'CONFIRMED' | 'CHANGE_REQUESTED' | 'NOT_APPLICABLE'; remark: string }> = {};

      CREDENTIAL_FIELD_CONFIG.forEach(cfg => {
        const val = staff.credentials[cfg.key];
        const isActive = isFieldActive(val);
        initialVerifications[cfg.key] = {
          status: isActive ? 'PENDING' : 'NOT_APPLICABLE',
          remark: ''
        };
      });

      setFieldVerifications(initialVerifications);
      setCurrentStep(2);
    } catch {
      setLookupError('Network error while looking up credentials. Please try again.');
    } finally {
      setIsLoadingLookup(false);
    }
  };

  // Register unlisted staff whose name does not appear in database
  const handleRegisterUnlistedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputtedName.trim()) {
      setLookupError('Please enter your full name to proceed.');
      return;
    }

    setIsRegistering(true);
    setLookupError(null);

    try {
      const cleanUNum = uNumberInput.trim().toUpperCase();
      const res = await fetch('/api/credentials/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uNumber: cleanUNum,
          name: inputtedName.trim().toUpperCase(),
          exNumber: isAlsRole && inputtedExNumber.trim() ? inputtedExNumber.trim().toUpperCase() : 'N/A'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLookupError(data.error || 'Failed to register your name. Please try again.');
        setIsRegistering(false);
        return;
      }

      const staff: UserCredentialRecord = data.staff;
      // Ensure CUTE Access default is 'Y'
      if (!staff.credentials.cuteAccess) {
        staff.credentials.cuteAccess = 'Y';
      }

      setStaffData(staff);
      setUNumberInput(staff.uNumber);
      setShowNamePrompt(false);
      setRegistrationNotice(
        'Profile registered with default CUTE Access as "Y". Please inform your credential status for any required systems through "Request Change / Request Access".'
      );

      // Pre-initialize verification states
      const initialVerifications: Record<string, { status: 'PENDING' | 'CONFIRMED' | 'CHANGE_REQUESTED' | 'NOT_APPLICABLE'; remark: string }> = {};

      CREDENTIAL_FIELD_CONFIG.forEach(cfg => {
        const val = staff.credentials[cfg.key];
        const isActive = isFieldActive(val);
        initialVerifications[cfg.key] = {
          status: isActive ? 'PENDING' : 'NOT_APPLICABLE',
          remark: ''
        };
      });

      setFieldVerifications(initialVerifications);
      setIdentityConfirmed(true);
      setCurrentStep(2);
    } catch {
      setLookupError('Network error while registering. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Calculate active visible fields
  const activeFields = CREDENTIAL_FIELD_CONFIG.filter(cfg => {
    if (!staffData) return false;
    if (!isFieldVisible(cfg)) return false;
    return isFieldActive(staffData.credentials[cfg.key]);
  });

  // Calculate unassigned visible fields
  const unassignedFields = CREDENTIAL_FIELD_CONFIG.filter(cfg => {
    if (!staffData) return false;
    if (!isFieldVisible(cfg)) return false;
    return !isFieldActive(staffData.credentials[cfg.key]);
  });

  // Calculate live confirmation progress metrics
  const totalActive = activeFields.length;
  const confirmedCount = activeFields.filter(cfg => fieldVerifications[cfg.key]?.status === 'CONFIRMED').length;
  const changeRequestedCount = activeFields.filter(cfg => fieldVerifications[cfg.key]?.status === 'CHANGE_REQUESTED').length;
  const reviewedCount = confirmedCount + changeRequestedCount;
  const remainingCount = Math.max(0, totalActive - reviewedCount);
  const progressPercent = totalActive > 0 ? Math.round((reviewedCount / totalActive) * 100) : 100;

  // Bulk confirm remaining active fields with one click
  const handleConfirmAllRemaining = () => {
    setFieldVerifications(prev => {
      const updated = { ...prev };
      activeFields.forEach(cfg => {
        if (!updated[cfg.key] || updated[cfg.key].status === 'PENDING') {
          updated[cfg.key] = {
            status: 'CONFIRMED',
            remark: updated[cfg.key]?.remark || ''
          };
        }
      });
      return updated;
    });
    setSubmitError(null);
  };

  // Calculate fortnight label for the chosen verification date
  const getFortnightDescription = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear();
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    return day <= 15 ? `1-15 ${month} ${year}` : `16-${lastDay} ${month} ${year}`;
  };

  // Handle setting status for a field
  const handleStatusChange = (fieldKey: string, status: 'CONFIRMED' | 'CHANGE_REQUESTED') => {
    setFieldVerifications(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        status
      }
    }));
    setSubmitError(null);
  };

  // Handle remark change with max 255 chars enforcement
  const handleRemarkChange = (fieldKey: string, text: string) => {
    if (text.length > 255) return;
    setFieldVerifications(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        remark: text
      }
    }));
  };

  // Handle submission
  const handleSubmitVerification = async () => {
    if (!staffData) return;

    // Check if any active field remains pending confirmation
    if (remainingCount > 0) {
      setSubmitError(
        `Please confirm or request a change for all credentials. There are ${remainingCount} field${
          remainingCount === 1 ? '' : 's'
        } remaining to be confirmed.`
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const verificationsPayload: FieldVerification[] = [];

      // Collect all active fields
      activeFields.forEach(cfg => {
        const val = staffData.credentials[cfg.key];
        const state = fieldVerifications[cfg.key] || { status: 'CONFIRMED', remark: '' };
        verificationsPayload.push({
          fieldKey: cfg.key,
          fieldLabel: cfg.label,
          currentValue: val || 'N',
          status: state.status,
          remark: state.remark || ''
        });
      });

      // Also collect unassigned fields if user explicitly requested a change/new access on them
      unassignedFields.forEach(cfg => {
        const state = fieldVerifications[cfg.key];
        if (state && state.status === 'CHANGE_REQUESTED') {
          verificationsPayload.push({
            fieldKey: cfg.key,
            fieldLabel: cfg.label,
            currentValue: staffData.credentials[cfg.key] || 'N',
            status: 'CHANGE_REQUESTED',
            remark: state.remark || 'Requesting new credential assignment'
          });
        }
      });

      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uNumber: staffData.uNumber,
          exNumber: staffData.exNumber,
          name: staffData.name,
          verificationDate,
          verifications: verificationsPayload,
          overallRemarks
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setSubmitError(data.error || 'Failed to submit verification.');
        setSubmitting(false);
        return;
      }

      // Automatically dispatch email notification to official Operations & Security mailbox and user copy
      try {
        await fetch('/api/credentials/simulate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            officialRecipient: OFFICIAL_REVIEW_EMAIL,
            email: confirmationEmail.trim() || undefined,
            submissionId: data.submission.id,
            uNumber: data.submission.uNumber,
            name: data.submission.name,
            fortnightLabel: data.submission.fortnightLabel,
            status: data.submission.status
          })
        });
      } catch (mailErr) {
        console.warn("Notice during email notification dispatch:", mailErr);
      }

      setCompletedSubmission(data.submission);
      setCurrentStep(4);
    } catch {
      setSubmitError('Network failure occurred. Please try submitting again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setStaffData(null);
    setIdentityConfirmed(false);
    setCompletedSubmission(null);
    setUNumberInput('');
  };

  // If step 4, render the receipt view
  if (currentStep === 4 && completedSubmission) {
    return (
      <PrintableReceipt
        submission={completedSubmission}
        onReset={handleReset}
        initialEmail={confirmationEmail || `${completedSubmission.uNumber.toLowerCase()}@lhg.com`}
        autoTriggerEmail={autoSendEmail}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8 px-4 sm:px-6">
      {/* Wizard Progress Stepper with Rich Color Milestones */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/80 pb-4 dark:border-indigo-950/80">
          <div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Verification Wizard · Step {currentStep} of 3</span>
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {currentStep === 1 && 'Step 1: Enter U-Number Identification'}
              {currentStep === 2 && 'Step 2: Confirm Employee Identity & Audit Date'}
              {currentStep === 3 && `Step 3: Review Credentials (${reviewedCount}/${totalActive} Confirmed)`}
            </h2>
          </div>

          {currentStep === 3 && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-3 py-1 rounded-full font-bold border shadow-2xs ${
                remainingCount === 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
              }`}>
                {remainingCount === 0 ? '✔ All Fields Verified' : `⏳ ${remainingCount} Remaining to Confirm`}
              </span>
              <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                {progressPercent}%
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Multi-Color Step Milestones */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-xs transition-all ${
                currentStep >= 1
                  ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white ring-2 ring-blue-400/40 shadow-blue-500/20'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              1
            </span>
            <span className={`text-xs font-bold ${currentStep === 1 ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500'}`}>
              Enter U-Number
            </span>
          </div>

          <div className="h-1 flex-1 mx-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
              style={{ width: currentStep >= 2 ? '100%' : '0%' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-xs transition-all ${
                currentStep >= 2
                  ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white ring-2 ring-indigo-400/40 shadow-indigo-500/20'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              2
            </span>
            <span className={`text-xs font-bold ${currentStep === 2 ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-500'}`}>
              Identity & Date
            </span>
          </div>

          <div className="h-1 flex-1 mx-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300"
              style={{ width: currentStep >= 3 ? '100%' : '0%' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-xs transition-all ${
                currentStep >= 3
                  ? 'bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 text-white ring-2 ring-purple-400/40 shadow-purple-500/20'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              3
            </span>
            <span className={`text-xs font-bold ${currentStep === 3 ? 'text-purple-700 dark:text-purple-400' : 'text-slate-500'}`}>
              Verify Credentials {currentStep === 3 && `(${reviewedCount}/${totalActive})`}
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: Enter U Number */}
      {currentStep === 1 && (
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 sm:p-10 shadow-lg shadow-indigo-500/5 dark:border-indigo-950/80 dark:bg-slate-900 relative overflow-hidden">
          {/* Subtle colorful glow in corner */}
          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-2xl" />

          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/30 ring-4 ring-indigo-50 dark:ring-indigo-950/50">
              <Search className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Initiate Credential Verification
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
              Please enter your unique U-Number as registered in the master aviation credentials database.
            </p>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              handleLookup();
            }}
            className="max-w-md mx-auto"
          >
            <div className="relative">
              <input
                type="text"
                value={uNumberInput}
                onChange={e => setUNumberInput(e.target.value.toUpperCase())}
                placeholder="Enter U-Number (e.g. U194283)"
                className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-4 py-3.5 pl-11 text-base font-mono font-bold uppercase tracking-wider text-slate-900 placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-indigo-400 shadow-inner"
                autoFocus
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-indigo-500">
                <Search className="h-5 w-5" />
              </div>
            </div>

            {lookupError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-3.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 flex items-start gap-2.5 shadow-2xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="font-semibold">{lookupError}</p>
                  {suggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Did you mean?</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setUNumberInput(s.uNumber);
                              handleLookup(s.uNumber);
                            }}
                            className="rounded-md bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 shadow-2xs transition-colors"
                          >
                            {s.uNumber} ({s.name})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!showNamePrompt && (
              <button
                type="submit"
                disabled={isLoadingLookup || !uNumberInput.trim()}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-500/25 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoadingLookup ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Looking up credentials in Firestore...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-5 w-5" />
                    <span>Verify Identity & Proceed</span>
                  </>
                )}
              </button>
            )}

            {!showNamePrompt && (
              <div className="mt-3.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowNamePrompt(true);
                    setLookupError(null);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-semibold underline inline-flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Name not in database? Click here to input your name and report credential status</span>
                </button>
              </div>
            )}
          </form>

          {/* Form to prompt user to input their name against U number if not found */}
          {showNamePrompt && (
            <div className="mt-6 max-w-md mx-auto rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50/90 via-yellow-50/50 to-amber-50/80 p-5 text-left dark:border-amber-700 dark:bg-amber-950/30 shadow-md">
              <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 font-extrabold text-sm sm:text-base mb-1">
                <UserPlus className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Input Name for U-Number: {uNumberInput || 'New Profile'}</span>
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-300 mb-4">
                Your name was not found in the master database. Please input your name against U-Number{' '}
                <strong className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-amber-300">{uNumberInput || 'provided'}</strong>. You can then inform your credentials status through &ldquo;Request Change / Request Access&rdquo;.
              </p>

              <form onSubmit={handleRegisterUnlistedUser} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={inputtedName}
                    onChange={e => setInputtedName(e.target.value)}
                    placeholder="Enter your official full name"
                    required
                    autoFocus
                    className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-sm font-bold uppercase text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-xs"
                  />
                </div>

                <div className="rounded-xl border border-amber-300/80 bg-white/90 p-3.5 dark:border-amber-900/60 dark:bg-slate-800/80 shadow-2xs">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-900 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={isAlsRole}
                      onChange={e => setIsAlsRole(e.target.checked)}
                      className="h-4 w-4 rounded-sm border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>I am an ALS (Turnaround Coordinator / Airside Lead)</span>
                  </label>
                  {isAlsRole && (
                    <div className="mt-2.5 pl-6">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        EX-Number (ALS only)
                      </label>
                      <input
                        type="text"
                        value={inputtedExNumber}
                        onChange={e => setInputtedExNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. EX855733"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-bold uppercase text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        Shows ALS-specific systems (FLOAT, FLOAT Backup, LH Altea FM, LX Altea FM).
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNamePrompt(false);
                      setLookupError(null);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering || !inputtedName.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {isRegistering ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Registering in Firestore...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        <span>Continue & Inform Credentials Status</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Identity Confirmation & Date Picker */}
      {currentStep === 2 && staffData && (
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 sm:p-10 shadow-lg shadow-indigo-500/5 dark:border-indigo-950/80 dark:bg-slate-900">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Step 2 of 3</span>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
              Confirm Identity & Verification Date
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Please verify that this credential record matches your official employee profile.
            </p>
          </div>

          {/* Identity Card: Boarding-Pass styling with airline accents */}
          <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 p-5 sm:p-6 dark:border-blue-900/60 dark:bg-slate-900 mb-6 shadow-sm">
            <div className={`grid grid-cols-1 ${isUserAls(staffData.credentials, staffData.exNumber) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Employee Name</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white">{staffData.name}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">U-Number</span>
                <p className="text-lg font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/50 px-2 py-0.5 rounded-md inline-block border border-blue-200 dark:border-blue-800">
                  {staffData.uNumber}
                </p>
              </div>
              {isUserAls(staffData.credentials, staffData.exNumber) && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">EX-Number (ALS Lead)</span>
                  <p className="text-lg font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/50 px-2 py-0.5 rounded-md inline-block border border-purple-200 dark:border-purple-800">
                    {staffData.exNumber || 'N/A'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-blue-200/80 pt-4 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-950 dark:text-blue-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Found in current Master Credentials database (Firestore synchronized)</span>
              </span>
              <span className="font-mono text-xs font-bold bg-white/90 dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-200">
                {activeFields.length} active system credentials registered
              </span>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 p-4 rounded-xl border border-indigo-200 hover:bg-indigo-50/40 dark:border-indigo-900/60 dark:hover:bg-slate-800/50 cursor-pointer transition-colors mb-6 shadow-2xs">
            <input
              type="checkbox"
              checked={identityConfirmed}
              onChange={e => setIdentityConfirmed(e.target.checked)}
              className="h-5 w-5 mt-0.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
            />
            <div className="text-sm">
              <span className="font-bold text-slate-900 dark:text-white">
                I confirm that I am {staffData.name} ({staffData.uNumber})
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                By ticking this box, you certify that you are the legitimate credential holder submitting this bi-weekly verification.
              </p>
            </div>
          </label>

          {/* Verification Date Input */}
          <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800 mb-8 bg-slate-50/50 dark:bg-slate-900/50">
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-1.5">
              Verification Date
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="relative">
                <input
                  type="date"
                  value={verificationDate}
                  onChange={e => setVerificationDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-2xs"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900 shadow-2xs">
                <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">Fortnight Cycle:</span>{' '}
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono">{getFortnightDescription(verificationDate)}</span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Defaults to today&apos;s date. Submissions are categorized into 1-15 or 16-31 fortnight audit cycles.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!identityConfirmed}
              onClick={() => setCurrentStep(3)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-700 hover:to-purple-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span>Continue to Credentials Review</span>
              <UserCheck className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Verify Credentials Fields */}
      {currentStep === 3 && staffData && (
        <div className="space-y-6">
          {/* Header Card with Rich Airline Gradient Header */}
          <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg shadow-indigo-500/5 dark:border-indigo-950/80 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Step 3 of 3 · Final Verification</span>
                </span>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
                  Verify Credentials &amp; Request Changes
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">Staff:</span>
                  <strong className="text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold">
                    {staffData.name}
                  </strong>
                  <span>·</span>
                  <span className="font-semibold text-slate-900 dark:text-white">U-Number:</span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                    {staffData.uNumber}
                  </span>
                  {isUserAls(staffData.credentials, staffData.exNumber) && (
                    <>
                      <span>·</span>
                      <span className="font-semibold text-purple-700 dark:text-purple-300">EX-Number:</span>
                      <span className="font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                        {staffData.exNumber}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Date:</span>
                  <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                    {verificationDate}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-3 text-white shadow-sm text-right">
                  <span className="text-[11px] font-medium text-blue-100 block">Active Systems</span>
                  <p className="text-xl font-extrabold leading-tight">
                    {activeFields.length}
                  </p>
                </div>
              </div>
            </div>

            {registrationNotice && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 shadow-2xs">
                <Sparkles className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-bold">Newly Registered Staff Profile:</p>
                  <p className="mt-0.5">{registrationNotice}</p>
                  <p className="mt-1 font-semibold text-amber-900 dark:text-amber-300">
                    Scroll down to &ldquo;Unassigned Systems&rdquo; to click &ldquo;Request Access&rdquo; and report which operational systems you need active credentials for.
                  </p>
                </div>
              </div>
            )}

            {/* Instruction banner */}
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-sky-50/60 to-indigo-50/80 p-3.5 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200 shadow-2xs">
              <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-bold">Operational Verification Instructions:</p>
                <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                  For all field values except <strong>N</strong> or blank, please confirm if your credentials are
                  working as indicated. Otherwise, select <strong>Request Change</strong> and add a remark describing
                  the issue (e.g., password expired, station access code needed).
                </p>
              </div>
            </div>
          </div>

          {/* Visual Progress Indicator Card */}
          <div className="rounded-2xl border border-indigo-200/80 bg-white p-5 sm:p-6 shadow-md shadow-indigo-500/5 dark:border-indigo-900/60 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-2xs">
                    3
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ListChecks className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <span>Confirmation Progress: {reviewedCount} of {totalActive} Credentials Reviewed</span>
                  </h3>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Station Compliance Audit</span>
                  <span>·</span>
                  {remainingCount === 0 ? (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      All credentials confirmed (Ready to submit)
                    </span>
                  ) : (
                    <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock className="h-4 w-4 text-amber-600" />
                      {remainingCount} field{remainingCount === 1 ? '' : 's'} remaining to confirm
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                {remainingCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleConfirmAllRemaining}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 transition-all"
                  >
                    <Check className="h-4 w-4" />
                    <span>Confirm All Remaining ({remainingCount}) as Working</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-xl bg-emerald-100/90 px-3.5 py-2 text-xs font-bold text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>100% Verified</span>
                  </div>
                )}
              </div>
            </div>

            {/* Visual Multi-Segment Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-600 dark:text-slate-400">Live Confirmation Status</span>
                <span className="font-mono text-indigo-700 dark:text-indigo-300 font-extrabold bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  {progressPercent}% Completed
                </span>
              </div>
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner">
                <div className="flex h-full transition-all duration-300">
                  <div
                    style={{ width: `${totalActive > 0 ? (confirmedCount / totalActive) * 100 : 0}%` }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 shadow-xs"
                    title={`${confirmedCount} Confirmed Working`}
                  />
                  <div
                    style={{ width: `${totalActive > 0 ? (changeRequestedCount / totalActive) * 100 : 0}%` }}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500 shadow-xs"
                    title={`${changeRequestedCount} Change Requests`}
                  />
                </div>
              </div>
            </div>

            {/* Stat Counters & Legend */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <span className="text-slate-500 block text-[11px] font-semibold">Total Active</span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 text-base">{totalActive} Fields</span>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/60 p-3 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-900/60 shadow-2xs">
                <span className="text-emerald-800 dark:text-emerald-300 block text-[11px] font-bold">Confirmed</span>
                <span className="font-extrabold text-emerald-900 dark:text-emerald-100 text-base flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {confirmedCount} Working
                </span>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50/60 p-3 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900/60 shadow-2xs">
                <span className="text-amber-800 dark:text-amber-300 block text-[11px] font-bold">Change Requests</span>
                <span className="font-extrabold text-amber-900 dark:text-amber-100 text-base flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  {changeRequestedCount} Flagged
                </span>
              </div>
              <div className={`rounded-xl p-3 border shadow-2xs transition-colors ${
                remainingCount > 0
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 text-blue-950 dark:from-blue-950/40 dark:to-indigo-950/30 dark:border-blue-800 dark:text-blue-100'
                  : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/40 dark:border-slate-700'
              }`}>
                <span className="block text-[11px] font-bold">Remaining to Confirm</span>
                <span className="font-extrabold text-base flex items-center gap-1">
                  {remainingCount > 0 ? (
                    <>
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span>{remainingCount} Pending</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>0 Remaining</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Active Credentials Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                <span>Assigned Credentials ({activeFields.length})</span>
              </h3>
              <span className="text-xs text-slate-500 font-semibold">
                {remainingCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    {remainingCount} field{remainingCount === 1 ? '' : 's'} remaining
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    All {totalActive} fields confirmed
                  </span>
                )}
              </span>
            </div>

            {activeFields.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                No active credentials currently assigned to this profile in the master database.
              </div>
            ) : (
              <div className="space-y-3">
                {activeFields.map(cfg => {
                  const currentValue = staffData.credentials[cfg.key] || 'Y';
                  const verification = fieldVerifications[cfg.key] || { status: 'PENDING', remark: '' };
                  const isConfirmed = verification.status === 'CONFIRMED';
                  const isChangeRequested = verification.status === 'CHANGE_REQUESTED';
                  const isPending = verification.status === 'PENDING';

                  return (
                    <div
                      key={cfg.key}
                      className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                        isConfirmed
                          ? 'border-emerald-300 border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50/40 via-white to-white dark:border-emerald-800 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 shadow-xs'
                          : isChangeRequested
                          ? 'border-amber-300 border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/50 via-white to-white dark:border-amber-800 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 shadow-xs'
                          : 'border-blue-200 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/30 via-white to-white dark:border-blue-900/60 dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm sm:text-base dark:text-white">
                              {cfg.label}
                            </span>
                            <span className="rounded-md bg-blue-100/80 px-2 py-0.5 font-mono text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {cfg.key === 'tac' ? `Access Code(s): ${formatCredentialDisplay('tac', currentValue)}` : `Value: ${currentValue}`}
                            </span>
                            {cfg.key === 'tac' && (
                              <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                Access Codes: Y · MOD · ALS
                              </span>
                            )}
                            {/* Live field confirmation state tag */}
                            {isConfirmed && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Confirmed Working</span>
                              </span>
                            )}
                            {isChangeRequested && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                <span>Change Requested</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                <Clock className="h-3.5 w-3.5 text-blue-600" />
                                <span>Pending Confirmation</span>
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {cfg.description}
                          </p>
                        </div>

                        {/* Confirmation Toggle Buttons */}
                        <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shrink-0 shadow-inner">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(cfg.key, 'CONFIRMED')}
                            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-bold transition-all ${
                              isConfirmed
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Confirmed</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(cfg.key, 'CHANGE_REQUESTED')}
                            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-bold transition-all ${
                              isChangeRequested
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Request Change</span>
                          </button>
                        </div>
                      </div>

                      {/* Remark input field */}
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                          <label className="font-bold">
                            {isChangeRequested ? (
                              <span className="text-amber-800 dark:text-amber-400 font-bold flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                Specify change or issue details:
                              </span>
                            ) : (
                              <span>Remarks / Notes (optional):</span>
                            )}
                          </label>
                          <span
                            className={`font-mono text-[11px] font-semibold ${
                              (verification.remark?.length || 0) >= 240 ? 'text-red-600 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {verification.remark?.length || 0}/255
                          </span>
                        </div>
                        {cfg.key === 'tac' && isChangeRequested && (
                          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="font-bold text-purple-900 dark:text-purple-300">Quick Access Code Request:</span>
                            {['Request code: Y (Standard)', 'Request code: MOD (Lead)', 'Request code: ALS (Supervisor)', 'Request codes: Y, MOD', 'Request codes: Y, MOD, ALS'].map((chip, chipIdx) => (
                              <button
                                key={chipIdx}
                                type="button"
                                onClick={() => handleRemarkChange(cfg.key, chip)}
                                className="rounded-md border border-purple-300 bg-purple-100/70 px-2.5 py-0.5 font-bold text-purple-800 hover:bg-purple-200 dark:border-purple-700 dark:bg-purple-950/60 dark:text-purple-300 transition-colors shadow-2xs"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        )}
                        <input
                          type="text"
                          maxLength={255}
                          value={verification.remark || ''}
                          onChange={e => handleRemarkChange(cfg.key, e.target.value)}
                          placeholder={
                            isChangeRequested
                              ? cfg.key === 'tac'
                                ? 'e.g. Request access code MOD, password reset, or device activation...'
                                : 'e.g. Password expired, supervisor role missing, cannot login to station terminal...'
                              : 'Optional remark for this credential...'
                          }
                          className={`w-full rounded-xl border px-3.5 py-2 text-xs transition-colors focus:outline-hidden focus:ring-2 ${
                            isChangeRequested
                              ? 'border-amber-400 bg-white text-amber-950 focus:border-amber-500 focus:ring-amber-500/30 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-100 shadow-2xs'
                              : 'border-slate-200 bg-slate-50/70 text-slate-800 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unassigned Systems Accordion */}
          {unassignedFields.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
              <button
                type="button"
                onClick={() => setShowUnassigned(!showUnassigned)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Unassigned Systems ({unassignedFields.length})
                  </h4>
                  <p className="text-xs text-slate-500">
                    These systems are marked as &ldquo;N&rdquo; or unassigned in your master profile. No confirmation required unless you need new access.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <span>{showUnassigned ? 'Hide' : 'View or Request Access'}</span>
                  {showUnassigned ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {showUnassigned && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800 space-y-3">
                  {unassignedFields.map(cfg => {
                    const isRequestingAccess = fieldVerifications[cfg.key]?.status === 'CHANGE_REQUESTED';
                    const remarkVal = fieldVerifications[cfg.key]?.remark || '';

                    return (
                      <div
                        key={cfg.key}
                        className={`rounded-xl border p-3.5 text-xs transition-colors ${
                          isRequestingAccess
                            ? 'border-amber-400 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20'
                            : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{cfg.label}</span>
                            <span className="ml-2 font-mono text-slate-400">(Current: N)</span>
                            <p className="text-[11px] text-slate-500">{cfg.description}</p>
                          </div>
                          <div>
                            {isRequestingAccess ? (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(cfg.key, 'CONFIRMED')}
                                className="text-xs text-slate-500 hover:text-slate-700 underline font-semibold"
                              >
                                Cancel Request
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(cfg.key, 'CHANGE_REQUESTED')}
                                className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-800 dark:text-indigo-300 shadow-2xs"
                              >
                                <PlusCircle className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Request Access</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {isRequestingAccess && (
                          <div className="mt-2.5">
                            <input
                              type="text"
                              maxLength={255}
                              value={remarkVal}
                              onChange={e => handleRemarkChange(cfg.key, e.target.value)}
                              placeholder="Reason for requesting new access to this system (max 255 chars)..."
                              className="w-full rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden dark:border-amber-700 dark:bg-slate-800 dark:text-white"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Overall remarks */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              <label className="font-bold">General Remarks / Operational Feedback (Optional)</label>
              <span className="font-mono text-slate-400 text-[11px] font-semibold">{overallRemarks.length}/255</span>
            </div>
            <textarea
              maxLength={255}
              rows={2}
              value={overallRemarks}
              onChange={e => setOverallRemarks(e.target.value)}
              placeholder="Any additional feedback regarding your shift stations, hardware, or access credentials..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Official Email Notification & Staff Email Prompt */}
          <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/50 p-5 dark:border-indigo-900 dark:bg-slate-900 shadow-md space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shrink-0 mt-0.5">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Email Submission &amp; Compliance Notification
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-950 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                    <Shield className="h-3 w-3 text-indigo-600" />
                    Automated Audit Dispatch
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Upon submitting your verification, an official summary report is automatically dispatched to Operations &amp; Security and your personal inbox.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Official Non-Editable Email Recipient */}
              <div className="rounded-xl border border-slate-200 bg-slate-100/95 p-3.5 dark:border-slate-800 dark:bg-slate-800/80 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Official Submission Recipient</span>
                  </label>
                  <span className="rounded-md bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    Non-Editable
                  </span>
                </div>
                <div className="relative mt-1">
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={OFFICIAL_REVIEW_EMAIL}
                    className="w-full rounded-lg border border-slate-300 bg-slate-200/80 dark:border-slate-700 dark:bg-slate-900/90 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-200 cursor-not-allowed select-all truncate"
                    title={OFFICIAL_REVIEW_EMAIL}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Fixed compliance mailbox for Operations and Security review.
                </p>
              </div>

              {/* Prompt to add user email address */}
              <div className="rounded-xl border border-blue-200 bg-white p-3.5 dark:border-blue-900/60 dark:bg-slate-800/90 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Your Email Address (Add for Confirmation Copy)</span>
                  </label>
                  <span className="rounded-md bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-extrabold text-blue-800 dark:text-blue-300">
                    Staff Copy
                  </span>
                </div>
                <div className="relative mt-1">
                  <input
                    type="email"
                    value={confirmationEmail}
                    onChange={e => setConfirmationEmail(e.target.value)}
                    placeholder="Enter your email (e.g. name@lhg.com or personal email)"
                    className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-blue-700 dark:text-blue-300 font-bold">
                  Add your email address to receive an official copy of this verification receipt.
                </p>
              </div>
            </div>
          </div>

          {/* Readiness and Remaining Status Alert */}
          {remainingCount > 0 ? (
            <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="font-extrabold text-sm text-amber-950 dark:text-amber-100">
                    {remainingCount} Field{remainingCount === 1 ? '' : 's'} Remaining to Confirm
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    Please review and confirm each assigned credential, or click the quick action to confirm all remaining as working.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConfirmAllRemaining}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-amber-600 hover:to-amber-700 transition-colors shrink-0"
              >
                <Check className="h-4 w-4" />
                <span>Confirm All Remaining ({remainingCount})</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-extrabold text-sm text-emerald-950 dark:text-emerald-100">
                    All {totalActive} Active Credentials Verified (100%)
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {confirmedCount} confirmed working · {changeRequestedCount} change request{changeRequestedCount === 1 ? '' : 's'} flagged. Ready to submit bi-weekly audit.
                  </p>
                </div>
              </div>
              <span className="font-mono font-extrabold text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-xl shadow-xs">
                Ready to Submit
              </span>
            </div>
          )}

          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span className="font-semibold">{submitError}</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors shadow-2xs"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting || remainingCount > 0}
              onClick={handleSubmitVerification}
              className={`flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-sm font-extrabold text-white shadow-md transition-all ${
                remainingCount > 0
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-indigo-500/30 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
              }`}
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting to Firestore &amp; Dispatching Review Email...</span>
                </>
              ) : remainingCount > 0 ? (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Confirm Remaining ({remainingCount} Left)</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit Bi-Weekly Verification</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
