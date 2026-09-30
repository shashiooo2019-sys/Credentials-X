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
  Mail
} from 'lucide-react';

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

  // Quick pick samples from PDF
  const sampleUsers = [
    { uNum: 'U194283', name: 'Rakesh Parmar', role: 'SUP Altea' },
    { uNum: 'U194317', name: 'Jaspreet Malik', role: 'SUP + SBH' },
    { uNum: 'U148030', name: 'Simarpreet Kaur', role: 'DASGO Edit' },
    { uNum: 'U152261', name: 'Ronak Singh', role: 'Multi-TAC' },
    { uNum: 'U148685', name: 'Ankit Mishra', role: 'Full Ops' },
    { uNum: 'U142649', name: 'Sona Gauri', role: 'EMM Active' }
  ];

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
      {/* Wizard Progress Stepper */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              Verification Wizard · Step {currentStep} of 3
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {currentStep === 1 && 'Step 1: Enter U-Number Identification'}
              {currentStep === 2 && 'Step 2: Confirm Employee Identity & Audit Date'}
              {currentStep === 3 && `Step 3: Review Credentials (${reviewedCount}/${totalActive} Confirmed)`}
            </h2>
          </div>

          {currentStep === 3 && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2.5 py-1 rounded-full font-semibold border ${
                remainingCount === 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
              }`}>
                {remainingCount === 0 ? '✔ All Fields Verified' : `⏳ ${remainingCount} Remaining to Confirm`}
              </span>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-300">
                {progressPercent}%
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                currentStep >= 1
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              1
            </span>
            <span className={`text-xs font-medium ${currentStep === 1 ? 'text-sky-600 font-bold dark:text-sky-400' : 'text-slate-500'}`}>
              Enter U-Number
            </span>
          </div>

          <div className="h-0.5 flex-1 mx-3 bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full bg-sky-600 transition-all duration-300"
              style={{ width: currentStep >= 2 ? '100%' : '0%' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                currentStep >= 2
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              2
            </span>
            <span className={`text-xs font-medium ${currentStep === 2 ? 'text-sky-600 font-bold dark:text-sky-400' : 'text-slate-500'}`}>
              Identity & Date
            </span>
          </div>

          <div className="h-0.5 flex-1 mx-3 bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full bg-sky-600 transition-all duration-300"
              style={{ width: currentStep >= 3 ? '100%' : '0%' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                currentStep >= 3
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              3
            </span>
            <span className={`text-xs font-medium ${currentStep === 3 ? 'text-sky-600 font-bold dark:text-sky-400' : 'text-slate-500'}`}>
              Verify Credentials {currentStep === 3 && `(${reviewedCount}/${totalActive})`}
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: Enter U Number */}
      {currentStep === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Initiate Credential Verification
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
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
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3.5 pl-11 text-base font-mono uppercase tracking-wider text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-400"
                autoFocus
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Search className="h-5 w-5" />
              </div>
            </div>

            {lookupError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p>{lookupError}</p>
                  {suggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Did you mean?</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setUNumberInput(s.uNumber);
                              handleLookup(s.uNumber);
                            }}
                            className="rounded-sm bg-white dark:bg-slate-800 px-2 py-0.5 text-xs font-mono text-sky-700 dark:text-sky-300 border border-slate-200 dark:border-slate-700 hover:bg-sky-50"
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
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoadingLookup ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Looking up credentials...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" />
                    <span>Verify Identity & Proceed</span>
                  </>
                )}
              </button>
            )}

            {!showNamePrompt && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowNamePrompt(true);
                    setLookupError(null);
                  }}
                  className="text-xs text-sky-600 hover:text-sky-800 dark:text-sky-400 font-medium underline inline-flex items-center gap-1"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Name not in database? Click here to input your name and report credential status</span>
                </button>
              </div>
            )}
          </form>

          {/* Form to prompt user to input their name against U number if not found */}
          {showNamePrompt && (
            <div className="mt-6 max-w-md mx-auto rounded-2xl border border-amber-300 bg-amber-50/70 p-5 text-left dark:border-amber-800/80 dark:bg-amber-950/20 shadow-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm sm:text-base mb-1">
                <UserPlus className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Input Name for U-Number: {uNumberInput || 'New Profile'}</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mb-4">
                Your name was not found in the master database. Please input your name against U-Number{' '}
                <strong className="font-mono">{uNumberInput || 'provided'}</strong>. You can then inform your credentials status through &ldquo;Request Change / Request Access&rdquo;.
              </p>

              <form onSubmit={handleRegisterUnlistedUser} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={inputtedName}
                    onChange={e => setInputtedName(e.target.value)}
                    placeholder="Enter your official full name"
                    required
                    autoFocus
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-900/60 dark:bg-slate-800/60">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
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
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        EX-Number (ALS only)
                      </label>
                      <input
                        type="text"
                        value={inputtedExNumber}
                        onChange={e => setInputtedExNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. EX855733"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono uppercase text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
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
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering || !inputtedName.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {isRegistering ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Registering...</span>
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

          {/* Quick-test helpers from the actual PDF */}
          <div className="mt-10 border-t border-slate-100 pt-6 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 justify-center">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Quick Test Profiles from Master PDF</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-xl mx-auto">
              {sampleUsers.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setUNumberInput(item.uNum);
                    setShowNamePrompt(false);
                    handleLookup(item.uNum);
                  }}
                  className="flex flex-col text-left rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-sky-700 transition-all text-xs"
                >
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{item.uNum}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</span>
                  <span className="text-[10px] text-slate-500 truncate">{item.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Identity Confirmation & Date Picker */}
      {currentStep === 2 && staffData && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Step 2 of 3</span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              Confirm Identity & Verification Date
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Please verify that this credential record matches your official employee profile.
            </p>
          </div>

          {/* Identity Card: EX Number shown ONLY for ALS */}
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-5 dark:border-sky-950 dark:bg-sky-950/20 mb-6">
            <div className={`grid grid-cols-1 ${isUserAls(staffData.credentials, staffData.exNumber) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Employee Name</span>
                <p className="text-base font-bold text-slate-900 dark:text-white">{staffData.name}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">U-Number</span>
                <p className="text-base font-mono font-bold text-sky-700 dark:text-sky-300">{staffData.uNumber}</p>
              </div>
              {isUserAls(staffData.credentials, staffData.exNumber) && (
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">EX-Number (ALS)</span>
                  <p className="text-base font-mono font-medium text-slate-700 dark:text-slate-300">{staffData.exNumber || 'N/A'}</p>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-sky-200/60 pt-4 dark:border-sky-900/50 flex items-center justify-between text-xs text-sky-800 dark:text-sky-300">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Found in current Master Credentials database</span>
              </span>
              <span className="font-mono text-xs">
                {activeFields.length} active system credentials registered
              </span>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 cursor-pointer transition-colors mb-6">
            <input
              type="checkbox"
              checked={identityConfirmed}
              onChange={e => setIdentityConfirmed(e.target.checked)}
              className="h-5 w-5 mt-0.5 rounded-sm border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
            />
            <div className="text-sm">
              <span className="font-semibold text-slate-900 dark:text-white">
                I confirm that I am {staffData.name} ({staffData.uNumber})
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                By ticking this box, you certify that you are the legitimate credential holder submitting this bi-weekly verification.
              </p>
            </div>
          </label>

          {/* Verification Date Input (defaults to today's date) */}
          <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800 mb-8">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
              Verification Date
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="relative">
                <input
                  type="date"
                  value={verificationDate}
                  onChange={e => setVerificationDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Fortnight Cycle:</span>{' '}
                  <span className="font-medium text-sky-700 dark:text-sky-300">{getFortnightDescription(verificationDate)}</span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Defaults to today&apos;s date. Submissions are categorized into 1-15 or 16-31 fortnight audit cycles.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!identityConfirmed}
              onClick={() => setCurrentStep(3)}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
          {/* Header Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Step 3 of 3</span>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                  Verify Credentials & Request Changes
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Staff: <strong className="text-slate-800 dark:text-slate-200">{staffData.name}</strong> · U-Number:{' '}
                  <span className="font-mono text-sky-600 dark:text-sky-400">{staffData.uNumber}</span>
                  {isUserAls(staffData.credentials, staffData.exNumber) && (
                    <> · EX-Number: <span className="font-mono font-semibold">{staffData.exNumber}</span></>
                  )} · Date: <span>{verificationDate}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-medium text-slate-500">Active Credentials</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {activeFields.length} Systems
                  </p>
                </div>
              </div>
            </div>

            {registrationNotice && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <Sparkles className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-bold">Newly Registered Staff Profile:</p>
                  <p className="mt-0.5">{registrationNotice}</p>
                  <p className="mt-1 font-semibold text-amber-800 dark:text-amber-300">
                    Scroll down to &ldquo;Unassigned Systems&rdquo; to click &ldquo;Request Access&rdquo; and report which operational systems you need active credentials for.
                  </p>
                </div>
              </div>
            )}

            {/* Instruction banner */}
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-sky-100 bg-sky-50/70 p-3.5 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200">
              <Info className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
              <div>
                <p className="font-semibold">Verification Requirement:</p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                  For all field values except <strong>N</strong> or blank, please confirm if your credentials are
                  working as indicated. Otherwise, select <strong>Request Change</strong> and add a remark describing
                  the issue (up to 255 characters).
                </p>
              </div>
            </div>
          </div>

          {/* Visual Progress Indicator Card */}
          <div className="rounded-2xl border border-sky-200 bg-white p-5 sm:p-6 shadow-xs dark:border-sky-900/60 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 text-xs font-bold">
                    3
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ListChecks className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    <span>Confirmation Progress: {reviewedCount} of {totalActive} Credentials Reviewed</span>
                  </h3>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>Step 3 of 3: System Access Audit</span>
                  <span>·</span>
                  {remainingCount === 0 ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      All credentials confirmed (Ready to submit)
                    </span>
                  ) : (
                    <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
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
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirm All Remaining ({remainingCount}) as Working</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>100% Verified</span>
                  </div>
                )}
              </div>
            </div>

            {/* Visual Multi-Segment Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-500">Live Confirmation Status</span>
                <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{progressPercent}% Completed</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                <div className="flex h-full transition-all duration-300">
                  <div
                    style={{ width: `${totalActive > 0 ? (confirmedCount / totalActive) * 100 : 0}%` }}
                    className="bg-emerald-500 transition-all duration-500"
                    title={`${confirmedCount} Confirmed Working`}
                  />
                  <div
                    style={{ width: `${totalActive > 0 ? (changeRequestedCount / totalActive) * 100 : 0}%` }}
                    className="bg-amber-500 transition-all duration-500"
                    title={`${changeRequestedCount} Change Requests`}
                  />
                </div>
              </div>
            </div>

            {/* Stat Counters & Legend */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                <span className="text-slate-400 block text-[11px]">Total Active</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{totalActive} Fields</span>
              </div>
              <div className="rounded-lg bg-emerald-50/60 p-2.5 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                <span className="text-emerald-700 dark:text-emerald-300 block text-[11px] font-medium">Confirmed</span>
                <span className="font-bold text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {confirmedCount} Working
                </span>
              </div>
              <div className="rounded-lg bg-amber-50/60 p-2.5 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                <span className="text-amber-700 dark:text-amber-300 block text-[11px] font-medium">Change Requests</span>
                <span className="font-bold text-amber-800 dark:text-amber-200 text-sm flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  {changeRequestedCount} Flagged
                </span>
              </div>
              <div className={`rounded-lg p-2.5 border transition-colors ${
                remainingCount > 0
                  ? 'bg-sky-50/70 border-sky-200 text-sky-900 dark:bg-sky-950/20 dark:border-sky-800 dark:text-sky-200'
                  : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/40 dark:border-slate-700'
              }`}>
                <span className="block text-[11px] font-medium">Remaining to Confirm</span>
                <span className="font-bold text-sm flex items-center gap-1">
                  {remainingCount > 0 ? (
                    <>
                      <Clock className="h-3.5 w-3.5 text-sky-600" />
                      <span>{remainingCount} Pending</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
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
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-600" />
                <span>Assigned Credentials ({activeFields.length})</span>
              </h3>
              <span className="text-xs text-slate-500">
                {remainingCount > 0 ? (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {remainingCount} field{remainingCount === 1 ? '' : 's'} remaining
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
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
                      className={`rounded-xl border p-4 sm:p-5 transition-all ${
                        isConfirmed
                          ? 'border-emerald-300 border-l-4 border-l-emerald-500 bg-white dark:border-emerald-800/80 dark:bg-slate-900 shadow-2xs'
                          : isChangeRequested
                          ? 'border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/30 dark:border-amber-800/60 dark:bg-amber-950/10'
                          : 'border-slate-300 border-l-4 border-l-sky-500 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm sm:text-base dark:text-white">
                              {cfg.label}
                            </span>
                            <span className="rounded-sm bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-sky-700 dark:bg-slate-800 dark:text-sky-300 border border-slate-200 dark:border-slate-700">
                              {cfg.key === 'tac' ? `Access Code(s): ${formatCredentialDisplay('tac', currentValue)}` : `Value: ${currentValue}`}
                            </span>
                            {cfg.key === 'tac' && (
                              <span className="rounded-sm bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                Access Codes: Y · MOD · ALS
                              </span>
                            )}
                            {/* Live field confirmation state tag */}
                            {isConfirmed && (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Confirmed Working</span>
                              </span>
                            )}
                            {isChangeRequested && (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Change Requested</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                <Clock className="h-3 w-3 text-sky-600" />
                                <span>Pending Confirmation</span>
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {cfg.description}
                          </p>
                        </div>

                        {/* Confirmation Toggle Buttons */}
                        <div className="flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(cfg.key, 'CONFIRMED')}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                              isConfirmed
                                ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Confirmed</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(cfg.key, 'CHANGE_REQUESTED')}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                              isChangeRequested
                                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Request Change</span>
                          </button>
                        </div>
                      </div>

                      {/* Remark input field (up to 255 chars) */}
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <label className="font-medium">
                            {isChangeRequested ? (
                              <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Specify change or issue details:
                              </span>
                            ) : (
                              <span>Remarks / Notes (optional):</span>
                            )}
                          </label>
                          <span
                            className={`font-mono text-[11px] ${
                              (verification.remark?.length || 0) >= 240 ? 'text-red-600 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {verification.remark?.length || 0}/255
                          </span>
                        </div>
                        {cfg.key === 'tac' && isChangeRequested && (
                          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="font-semibold text-slate-500">Quick Access Code Request:</span>
                            {['Request code: Y (Standard)', 'Request code: MOD (Lead)', 'Request code: ALS (Supervisor)', 'Request codes: Y, MOD', 'Request codes: Y, MOD, ALS'].map((chip, chipIdx) => (
                              <button
                                key={chipIdx}
                                type="button"
                                onClick={() => handleRemarkChange(cfg.key, chip)}
                                className="rounded-md border border-purple-200 bg-purple-50/80 px-2 py-0.5 font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 transition-colors"
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
                          className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-hidden focus:ring-1 ${
                            isChangeRequested
                              ? 'border-amber-300 bg-white text-amber-950 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-100'
                              : 'border-slate-200 bg-slate-50/50 text-slate-800 focus:border-sky-500 focus:bg-white focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unassigned Systems Accordion (values are N or empty) */}
          {unassignedFields.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <button
                type="button"
                onClick={() => setShowUnassigned(!showUnassigned)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Unassigned Systems ({unassignedFields.length})
                  </h4>
                  <p className="text-xs text-slate-400">
                    These systems are marked as &ldquo;N&rdquo; or unassigned in your master profile. No confirmation required unless you need new access.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-sky-600 font-medium">
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
                        className={`rounded-lg border p-3 text-xs transition-colors ${
                          isRequestingAccess
                            ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20'
                            : 'border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{cfg.label}</span>
                            <span className="ml-2 font-mono text-slate-400">(Current: N)</span>
                            <p className="text-[11px] text-slate-500">{cfg.description}</p>
                          </div>
                          <div>
                            {isRequestingAccess ? (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(cfg.key, 'CONFIRMED')}
                                className="text-xs text-slate-500 hover:text-slate-700 underline"
                              >
                                Cancel Request
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(cfg.key, 'CHANGE_REQUESTED')}
                                className="flex items-center gap-1 rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                <PlusCircle className="h-3 w-3 text-sky-600" />
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
                              className="w-full rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden dark:border-amber-700 dark:bg-slate-800 dark:text-white"
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
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              <label className="font-semibold">General Remarks / Operational Feedback (Optional)</label>
              <span className="font-mono text-slate-400 text-[11px]">{overallRemarks.length}/255</span>
            </div>
            <textarea
              maxLength={255}
              rows={2}
              value={overallRemarks}
              onChange={e => setOverallRemarks(e.target.value)}
              placeholder="Any additional feedback regarding your shift stations, hardware, or access credentials..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Simulated Confirmation Email Opt-In */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/60 dark:bg-sky-950/20 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={autoSendEmail}
                  onChange={e => setAutoSendEmail(e.target.checked)}
                  className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-slate-700"
                />
                <div className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <span>Send simulated confirmation email summary after submission</span>
                </div>
              </label>

              {autoSendEmail && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Recipient:</span>
                  <input
                    type="email"
                    value={confirmationEmail}
                    onChange={e => setConfirmationEmail(e.target.value)}
                    placeholder="staff.email@lhg.com"
                    className="w-52 sm:w-60 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 pl-6">
              An official LHG audit receipt summary will be automatically generated and simulated to this email upon completing your verification.
            </p>
          </div>

          {/* Readiness and Remaining Status Alert */}
          {remainingCount > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="font-bold text-sm text-amber-900 dark:text-amber-100">
                    {remainingCount} Field{remainingCount === 1 ? '' : 's'} Remaining to Confirm
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Please review and confirm each assigned credential, or click the quick action to confirm all remaining as working.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConfirmAllRemaining}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-colors shrink-0"
              >
                <Check className="h-4 w-4" />
                <span>Confirm All Remaining ({remainingCount})</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                    All {totalActive} Active Credentials Verified (100%)
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {confirmedCount} confirmed working · {changeRequestedCount} change request{changeRequestedCount === 1 ? '' : 's'} flagged. Ready to submit bi-weekly audit.
                  </p>
                </div>
              </div>
              <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-md">
                Ready to Submit
              </span>
            </div>
          )}

          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting || remainingCount > 0}
              onClick={handleSubmitVerification}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition-all ${
                remainingCount > 0
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-sky-600 hover:bg-sky-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:ring-offset-2'
              }`}
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting Verification...</span>
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
