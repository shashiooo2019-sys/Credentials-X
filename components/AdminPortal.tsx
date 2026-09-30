'use client';

import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import {
  SubmissionRecord,
  UserCredentialRecord,
  CREDENTIAL_FIELD_CONFIG,
  CredentialFields,
  formatCredentialDisplay,
  isUserAls,
  isUserM365
} from '@/lib/types';
import {
  Lock,
  Calendar,
  Filter,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Users,
  Search,
  RefreshCw,
  Eye,
  X,
  FileText,
  Database,
  PlusCircle,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Check,
  Clock
} from 'lucide-react';

interface AdminPortalProps {
  isAuthenticated: boolean;
  onAuthenticated: () => void;
  onLogout: () => void;
}

export default function AdminPortal({
  isAuthenticated,
  onAuthenticated
}: AdminPortalProps) {
  // Login form state (empty by default for security)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active admin sub-tab: 'audit' (Fortnight Submissions) or 'master' (Master Database & PDF Upload)
  const [adminView, setAdminView] = useState<'audit' | 'master'>('audit');

  // Fortnight Cycle Filter State
  const now = new Date();
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [filterFortnight, setFilterFortnight] = useState<1 | 2>(now.getDate() <= 15 ? 1 : 2);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CHANGE_REQUESTED' | 'CONFIRMED'>('ALL');
  const [submissionSearch, setSubmissionSearch] = useState('');

  // Submissions Data
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditMetrics, setAuditMetrics] = useState({
    totalStaffCount: 0,
    submittedCount: 0,
    missingCount: 0,
    changeRequestCount: 0,
    confirmedCount: 0,
    complianceRate: 0
  });
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [missingStaff, setMissingStaff] = useState<Array<{ uNumber: string; exNumber: string; name: string }>>([]);
  const [fortnightLabel, setFortnightLabel] = useState('');

  // Selected submission modal
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null);

  // Master Database Management State
  const [masterStaffList, setMasterStaffList] = useState<UserCredentialRecord[]>([]);
  const [masterSearch, setMasterSearch] = useState('');
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [masterNotice, setMasterNotice] = useState<string | null>(null);

  // PDF Upload & Extraction State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{ records: UserCredentialRecord[]; count: number } | null>(null);

  // Edit / Add Staff Modal State
  const [editingStaff, setEditingStaff] = useState<UserCredentialRecord | null>(null);
  const [isNewStaffModalOpen, setIsNewStaffModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Filtered submissions based on search input
  const filteredSubmissions = submissions.filter(sub => {
    if (!submissionSearch.trim()) return true;
    const q = submissionSearch.toLowerCase().trim();
    return (
      sub.uNumber.toLowerCase().includes(q) ||
      sub.name.toLowerCase().includes(q) ||
      (sub.exNumber && sub.exNumber.toLowerCase().includes(q)) ||
      (sub.overallRemarks && sub.overallRemarks.toLowerCase().includes(q))
    );
  });

  // Filtered pending/missing staff based on search input
  const filteredMissingStaff = missingStaff.filter(staff => {
    if (!submissionSearch.trim()) return true;
    const q = submissionSearch.toLowerCase().trim();
    return (
      staff.uNumber.toLowerCase().includes(q) ||
      staff.name.toLowerCase().includes(q) ||
      (staff.exNumber && staff.exNumber.toLowerCase().includes(q))
    );
  });

  // Submissions Map by U-Number for fast verification status lookup across Master Registry
  const submissionsByUNumber = useMemo(() => {
    const map = new Map<string, SubmissionRecord>();
    submissions.forEach(sub => {
      map.set(sub.uNumber.trim().toUpperCase(), sub);
    });
    return map;
  }, [submissions]);

  // Helper to render credential value with color-coded status badge:
  // - Confirmed: GREEN background, WHITE font
  // - Change Request: RED background, WHITE font
  // - Not Confirmed / Pending: YELLOW background, BLACK font
  const renderRegistryCredentialBadge = (
    staffUNumber: string,
    fieldKey: keyof CredentialFields,
    rawValue: string | undefined
  ) => {
    const sub = submissionsByUNumber.get(staffUNumber.trim().toUpperCase());
    const displayVal = fieldKey === 'tac' ? formatCredentialDisplay('tac', rawValue) : (rawValue || 'N');

    let status: 'CONFIRMED' | 'CHANGE_REQUESTED' | 'NOT_CONFIRMED' = 'NOT_CONFIRMED';
    let remark = '';

    if (sub) {
      const v = sub.verifications.find(item => item.fieldKey === fieldKey);
      if (v) {
        if (v.status === 'CONFIRMED') {
          status = 'CONFIRMED';
        } else if (v.status === 'CHANGE_REQUESTED') {
          status = 'CHANGE_REQUESTED';
          remark = v.remark || '';
        }
      }
    }

    if (status === 'CONFIRMED') {
      return (
        <span
          title={`CONFIRMED for cycle ${fortnightLabel} by staff`}
          className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded text-[11px] font-bold bg-green-600 text-white shadow-2xs tracking-wide cursor-default"
        >
          {displayVal}
        </span>
      );
    }

    if (status === 'CHANGE_REQUESTED') {
      return (
        <span
          title={`CHANGE REQUESTED for cycle ${fortnightLabel}${remark ? `: "${remark}"` : ''}`}
          className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white shadow-2xs tracking-wide cursor-default"
        >
          {displayVal}
        </span>
      );
    }

    // NOT_CONFIRMED: Yellow background and Black font
    return (
      <span
        title={`NOT CONFIRMED (Awaiting staff verification for cycle ${fortnightLabel})`}
        className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded text-[11px] font-semibold bg-yellow-400 text-black shadow-2xs tracking-wide cursor-default"
      >
        {displayVal}
      </span>
    );
  };

  // Handle Admin Sign In
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Invalid credentials');
        setIsLoggingIn(false);
        return;
      }

      onAuthenticated();
    } catch {
      setLoginError('Authentication network error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Fetch Submissions for selected fortnight
  const fetchFortnightData = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const url = `/api/submissions?year=${filterYear}&month=${filterMonth}&fortnight=${filterFortnight}&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setAuditMetrics(data.metrics);
        setSubmissions(data.submissions || []);
        setMissingStaff(data.missingStaff || []);
        setFortnightLabel(data.label || '');
      }
    } catch (err) {
      console.error('Failed to load fortnight data:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, [filterYear, filterMonth, filterFortnight, statusFilter]);

  // Fetch Master Database
  const fetchMasterData = useCallback(async () => {
    setLoadingMaster(true);
    try {
      const url = `/api/credentials/master?q=${encodeURIComponent(masterSearch)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setMasterStaffList(data.staff || []);
      }
    } catch (err) {
      console.error('Failed to load master staff data:', err);
    } finally {
      setLoadingMaster(false);
    }
  }, [masterSearch]);

  useEffect(() => {
    let ignore = false;

    if (isAuthenticated) {
      const load = async () => {
        try {
          const auditUrl = `/api/submissions?year=${filterYear}&month=${filterMonth}&fortnight=${filterFortnight}&status=${statusFilter}`;
          const auditRes = await fetch(auditUrl);
          const auditData = await auditRes.json();
          if (!ignore && auditData.success) {
            setAuditMetrics(auditData.metrics);
            setSubmissions(auditData.submissions || []);
            setMissingStaff(auditData.missingStaff || []);
            setFortnightLabel(auditData.label || '');
          }

          const masterUrl = `/api/credentials/master?q=${encodeURIComponent(masterSearch)}`;
          const masterRes = await fetch(masterUrl);
          const masterData = await masterRes.json();
          if (!ignore && masterData.success) {
            setMasterStaffList(masterData.staff || []);
          }
        } catch (err) {
          console.error('Error fetching admin data:', err);
        }
      };

      load();
    }

    return () => {
      ignore = true;
    };
  }, [isAuthenticated, filterYear, filterMonth, filterFortnight, statusFilter, masterSearch]);

  // Download CSV Upload Template for Admin
  const downloadCsvTemplate = () => {
    const headers = [
      'UNUMBER',
      'NAMES',
      'EX Number',
      'CUTE Access',
      'Altea LH',
      'LOOK',
      'EBASE',
      'LMS',
      'MesWeb',
      'MesWeb Internet',
      'WorldTracer',
      'SBH',
      'DASGO',
      'M365',
      'LH Altea FM',
      'LX Altea FM',
      'FLOAT',
      'FLOAT Backup',
      'PKI',
      'Turnaround companion App',
      'EMM'
    ];
    const sampleRows = [
      '"U194283","RAKESH PARMAR","EX855733","Y","SUP","Y","Y","Y","Y","Y","Y","N","Y","Y","N","N","N","N","N","[\"MOD\"]","Y"',
      '"U194317","JASPREET MALIK","EX855755","Y","SUP","Y","Y","Y","Y","Y","Y","Y","Y","Y","N","N","N","N","N","[\"MOD\"]","Y"',
      '"U200001","NEW STAFF MEMBER","N/A","Y","Y","Y","N","Y","N","N","N","N","Y","Y","N","N","N","N","N","[\"Y\"]","N"'
    ];
    const content = [headers.join(','), ...sampleRows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'LHG_Master_Credentials_Template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle PDF or CSV Upload to update master database
  const handlePdfUpload = async (action: 'preview' | 'commit') => {
    if (!pdfFile && !parsedPreview) return;

    setIsUploadingPdf(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      if (pdfFile) {
        formData.append('file', pdfFile);
      }
      if (parsedPreview && action === 'commit') {
        formData.append('json', JSON.stringify(parsedPreview.records));
      }
      formData.append('action', action);
      formData.append('mode', 'upsert'); // Overwrite matching U-number credentials (no duplicates), add new U-numbers

      const res = await fetch('/api/credentials/upload-pdf', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setUploadError(data.error || 'File processing failed.');
        setIsUploadingPdf(false);
        return;
      }

      if (action === 'preview') {
        setParsedPreview({ records: data.records, count: data.count });
        setMasterNotice(data.message || `Extracted ${data.count} staff records for preview.`);
      } else {
        setMasterNotice(data.message || `Master database successfully updated with ${data.count} staff records!`);
        setParsedPreview(null);
        setPdfFile(null);
        fetchMasterData();
        fetchFortnightData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setUploadError('Failed processing file: ' + msg);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Reset to original PDF Seed
  const handleResetToBaseline = async () => {
    if (!confirm('Are you sure you want to reset the Master Database back to the original seed data?')) return;

    try {
      const res = await fetch('/api/credentials/master', { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        setMasterNotice('Master database reset to original baseline successfully.');
        fetchMasterData();
        fetchFortnightData();
      }
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  // Export to CSV generator
  const exportToCsv = (type: 'current-view' | 'change-requests' | 'missing-staff' | 'all-details') => {
    let csvRows: string[] = [];

    if (type === 'missing-staff') {
      csvRows.push('U Number,Staff Name,EX Number,Fortnight Period,Status');
      missingStaff.forEach(s => {
        csvRows.push(`"${s.uNumber}","${s.name}","${s.exNumber || 'N/A'}","${fortnightLabel}","MISSING"`);
      });
    } else if (type === 'change-requests') {
      csvRows.push('Submission ID,U Number,Staff Name,Verification Date,Fortnight,Credential Field,Master Value,Staff Remark,Status');
      submissions
        .filter(s => s.hasChangeRequests)
        .forEach(sub => {
          sub.verifications
            .filter(v => v.status === 'CHANGE_REQUESTED')
            .forEach(v => {
              csvRows.push(
                `"${sub.id}","${sub.uNumber}","${sub.name}","${sub.verificationDate}","${sub.fortnightLabel}","${v.fieldLabel}","${v.currentValue}","${(v.remark || '').replace(/"/g, '""')}","CHANGE_REQUESTED"`
              );
            });
        });
    } else if (type === 'all-details') {
      csvRows.push('Submission ID,U Number,Staff Name,Verification Date,Fortnight,Field,Value,Status,Remark,Overall Remarks,Submitted At');
      submissions.forEach(sub => {
        sub.verifications.forEach(v => {
          csvRows.push(
            `"${sub.id}","${sub.uNumber}","${sub.name}","${sub.verificationDate}","${sub.fortnightLabel}","${v.fieldLabel}","${v.currentValue}","${v.status}","${(v.remark || '').replace(/"/g, '""')}","${(sub.overallRemarks || '').replace(/"/g, '""')}","${sub.submittedAt}"`
          );
        });
      });
    } else {
      // Current filtered submissions summary
      csvRows.push('Submission ID,U Number,Staff Name,EX Number,Verification Date,Fortnight,Status,Active Fields,Confirmed Count,Change Requests Count,Remarks,Submitted At');
      submissions.forEach(s => {
        csvRows.push(
          `"${s.id}","${s.uNumber}","${s.name}","${s.exNumber || 'N/A'}","${s.verificationDate}","${s.fortnightLabel}","${s.status}","${s.totalActiveFields}","${s.confirmedCount}","${s.changeRequestCount}","${(s.overallRemarks || '').replace(/"/g, '""')}","${s.submittedAt}"`
        );
      });
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Credential_Report_${type}_${filterYear}_M${filterMonth}_F${filterFortnight}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export all confirmations per log-in type per staff per reporting period
  const exportConfirmationsPerLoginType = () => {
    const headers = [
      'Reporting Period',
      'Cycle Identifier',
      'Staff Name',
      'U-Number',
      'EX-Number',
      'Login Type / System',
      'System Category',
      'Master Stored Value',
      'Confirmation Status',
      'Change Request Remarks',
      'Verification Date',
      'Submission ID',
      'Overall Remarks'
    ];

    const rows: string[] = [headers.join(',')];

    masterStaffList.forEach(staff => {
      const sub = submissionsByUNumber.get(staff.uNumber.trim().toUpperCase());
      const isSubmitted = !!sub;

      CREDENTIAL_FIELD_CONFIG.forEach(cfg => {
        const masterVal = staff.credentials[cfg.key];
        const displayVal = cfg.key === 'tac' ? formatCredentialDisplay('tac', masterVal) : (masterVal || 'N');

        let status = 'NOT_CONFIRMED';
        let remark = '';
        const verDate = isSubmitted ? sub.verificationDate : 'N/A';
        const subId = isSubmitted ? sub.id : 'N/A';
        const overallRem = isSubmitted ? (sub.overallRemarks || '') : '';

        if (sub) {
          const v = sub.verifications.find(item => item.fieldKey === cfg.key);
          if (v) {
            status = v.status === 'CONFIRMED' ? 'CONFIRMED' : v.status === 'CHANGE_REQUESTED' ? 'CHANGE_REQUESTED' : 'NOT_CONFIRMED';
            remark = v.remark || '';
          }
        }

        rows.push(
          [
            `"${fortnightLabel}"`,
            `"${filterYear}-${String(filterMonth).padStart(2, '0')}-F${filterFortnight}"`,
            `"${staff.name}"`,
            `"${staff.uNumber}"`,
            `"${staff.exNumber || 'N/A'}"`,
            `"${cfg.label}"`,
            `"${cfg.category}"`,
            `"${displayVal.replace(/"/g, '""')}"`,
            `"${status}"`,
            `"${remark.replace(/"/g, '""')}"`,
            `"${verDate}"`,
            `"${subId}"`,
            `"${overallRem.replace(/"/g, '""')}"`
          ].join(',')
        );
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LHG_Confirmations_Per_Login_Type_${filterYear}_M${String(filterMonth).padStart(2, '0')}_F${filterFortnight}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export latest master credentials file
  const exportMasterCredentialsFileLatest = () => {
    const headers = [
      'UNUMBER',
      'NAMES',
      'EX Number',
      'CUTE Access',
      'ONE RES',
      'Altea LH',
      'LOOK',
      'EBASE',
      'LMS',
      'MesWeb',
      'MesWeb Internet',
      'WorldTracer',
      'SBH',
      'DASGO',
      'M365',
      'LH Altea FM',
      'LX Altea FM',
      'FLOAT',
      'FLOAT Backup',
      'PKI',
      'Turnaround companion App',
      'EMM',
      'Last Updated'
    ];

    const rows: string[] = [headers.join(',')];

    masterStaffList.forEach(s => {
      const c = s.credentials;
      rows.push(
        [
          `"${s.uNumber}"`,
          `"${s.name}"`,
          `"${s.exNumber || 'N/A'}"`,
          `"${c.cuteAccess || 'Y'}"`,
          `"${c.oneRes || 'N'}"`,
          `"${c.alteaLhc || 'N'}"`,
          `"${c.look || 'N'}"`,
          `"${c.ebase || 'N'}"`,
          `"${c.lms || 'N'}"`,
          `"${c.mesWeb || 'N'}"`,
          `"${c.mesWebIn || 'N'}"`,
          `"${c.worldTracer || 'N'}"`,
          `"${c.sbh || 'N'}"`,
          `"${c.dasgo || 'N'}"`,
          `"${c.ms365 || 'N'}"`,
          `"${c.lhalteaF || 'N'}"`,
          `"${c.lxAlteaF || 'N'}"`,
          `"${c.float || 'N'}"`,
          `"${c.floatBac || 'N'}"`,
          `"${c.pki || 'N'}"`,
          `"${formatCredentialDisplay('tac', c.tac).replace(/"/g, '""')}"`,
          `"${c.emm || 'N'}"`,
          `"${s.updatedAt || new Date().toISOString()}"`
        ].join(',')
      );
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LHG_Master_Credentials_Latest_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Month names helper
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Save new or edited staff record
  const handleSaveStaffRecord = async (record: UserCredentialRecord) => {
    try {
      const res = await fetch('/api/credentials/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      const data = await res.json();
      if (data.success) {
        setMasterNotice('Staff record saved successfully');
        setEditingStaff(null);
        setIsNewStaffModalOpen(false);
        fetchMasterData();
      }
    } catch (err) {
      console.error('Error saving staff:', err);
    }
  };

  // Delete staff record
  const handleDeleteStaffRecord = async (uNum: string) => {
    if (!confirm(`Are you sure you want to delete staff record ${uNum}?`)) return;
    try {
      const res = await fetch(`/api/credentials/master?uNumber=${encodeURIComponent(uNum)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setMasterNotice(`Staff record ${uNum} deleted.`);
        fetchMasterData();
      }
    } catch (err) {
      console.error('Error deleting staff:', err);
    }
  };

  // IF NOT AUTHENTICATED: Show Admin Sign In Form
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md py-16 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Administrator Access
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Bi-weekly audit, fortnight review reports, and PDF master management.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {loginError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors"
            >
              {isLoggingIn ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // AUTHENTICATED ADMIN DASHBOARD
  return (
    <div className="mx-auto max-w-7xl py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Navigation for Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Admin Operations & Audit Portal</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor fortnight feedback (1-15 & 16-31), resolve change requests, and update master database.
          </p>
        </div>

        {/* View Switcher: Audit vs Master Database */}
        <div className="flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => setAdminView('audit')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-all ${
              adminView === 'audit'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span>Fortnight Audit & Submissions</span>
          </button>
          <button
            onClick={() => setAdminView('master')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-all ${
              adminView === 'master'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Database className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span>Master PDF Database ({masterStaffList.length})</span>
          </button>
        </div>
      </div>

      {masterNotice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>{masterNotice}</span>
          </div>
          <button onClick={() => setMasterNotice(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* VIEW 1: FORTNIGHT AUDIT & SUBMISSIONS */}
      {adminView === 'audit' && (
        <div className="space-y-6">
          {/* Fortnight Selector Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Calendar className="h-4 w-4 text-sky-600" />
                  <span>Fortnight Cycle:</span>
                </div>

                {/* Year */}
                <select
                  value={filterYear}
                  onChange={e => setFilterYear(parseInt(e.target.value, 10))}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>

                {/* Month */}
                <select
                  value={filterMonth}
                  onChange={e => setFilterMonth(parseInt(e.target.value, 10))}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {monthNames.map((m, idx) => (
                    <option key={idx} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>

                {/* Fortnight 1 (1-15) vs Fortnight 2 (16-31) */}
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterFortnight(1)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                      filterFortnight === 1
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    1-15 (F1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterFortnight(2)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                      filterFortnight === 2
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    16-31 (F2)
                  </button>
                </div>

                {/* Current Fortnight Button */}
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setFilterYear(today.getFullYear());
                    setFilterMonth(today.getMonth() + 1);
                    setFilterFortnight(today.getDate() <= 15 ? 1 : 2);
                  }}
                  className="text-xs text-sky-600 hover:text-sky-800 font-medium underline"
                >
                  Today&apos;s Cycle
                </button>
              </div>

              {/* Refresh & CSV Export Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchFortnightData}
                  disabled={loadingAudit}
                  title="Reload audit data"
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => exportToCsv('current-view')}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={exportConfirmationsPerLoginType}
                  title="Export all confirmations per log-in type per staff for this reporting period"
                  className="flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Confirmations by Login Type (.CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToCsv('change-requests')}
                  title="Export only flagged change requests"
                  className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <span>Change Requests CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToCsv('missing-staff')}
                  title="Export list of staff who have not verified"
                  className="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span>Missing Staff CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Metric KPI Cards (Click to filter) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Card 1: Total Staff */}
            <div
              onClick={() => {
                setStatusFilter('ALL');
                setSubmissionSearch('');
              }}
              title="Click to view all master staff"
              className={`cursor-pointer rounded-xl border p-4 shadow-2xs transition-all hover:scale-[1.02] ${
                statusFilter === 'ALL' && !submissionSearch
                  ? 'border-sky-500 bg-sky-50/30 dark:border-sky-500 dark:bg-sky-950/20 ring-1 ring-sky-400/40'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-medium text-slate-500">Master Staff</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {auditMetrics.totalStaffCount}
              </p>
              <span className="text-[11px] text-slate-400">Total in baseline</span>
            </div>

            {/* Card 2: Submitted */}
            <div
              onClick={() => setStatusFilter('ALL')}
              title="Click to view all submissions"
              className={`cursor-pointer rounded-xl border p-4 shadow-2xs transition-all hover:scale-[1.02] ${
                statusFilter === 'ALL'
                  ? 'border-sky-500 bg-sky-50/30 dark:border-sky-500 dark:bg-sky-950/20 ring-1 ring-sky-400/40'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-medium text-slate-500">Submissions</span>
              <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">
                {auditMetrics.submittedCount}
              </p>
              <span className="text-[11px] text-slate-400">
                {auditMetrics.complianceRate}% compliance
              </span>
            </div>

            {/* Card 3: Missing / Pending */}
            <div
              onClick={() => setStatusFilter('PENDING')}
              title="Click to view pending submissions"
              className={`cursor-pointer rounded-xl border p-4 shadow-2xs transition-all hover:scale-[1.02] ${
                statusFilter === 'PENDING'
                  ? 'border-rose-500 bg-rose-50/40 dark:border-rose-500 dark:bg-rose-950/30 ring-1 ring-rose-400/40'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-rose-300 dark:hover:border-rose-900'
              }`}
            >
              <span className="text-xs font-medium text-slate-500">Pending Submissions</span>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {auditMetrics.missingCount}
              </p>
              <span className="text-[11px] text-slate-400">Awaiting verification</span>
            </div>

            {/* Card 4: Change Requests */}
            <div
              onClick={() => setStatusFilter('CHANGE_REQUESTED')}
              title="Click to view change requests"
              className={`cursor-pointer rounded-xl border p-4 shadow-2xs transition-all hover:scale-[1.02] ${
                statusFilter === 'CHANGE_REQUESTED'
                  ? 'border-amber-500 bg-amber-50/40 dark:border-amber-500 dark:bg-amber-950/30 ring-1 ring-amber-400/40'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-900'
              }`}
            >
              <span className="text-xs font-medium text-slate-500">Change Requests</span>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {auditMetrics.changeRequestCount}
              </p>
              <span className="text-[11px] text-slate-400">Issue / ticket required</span>
            </div>

            {/* Card 5: Confirmed */}
            <div
              onClick={() => setStatusFilter('CONFIRMED')}
              title="Click to view confirmed submissions"
              className={`cursor-pointer rounded-xl border p-4 shadow-2xs transition-all hover:scale-[1.02] ${
                statusFilter === 'CONFIRMED'
                  ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-500 dark:bg-emerald-950/30 ring-1 ring-emerald-400/40'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-900'
              }`}
            >
              <span className="text-xs font-medium text-slate-500">100% Confirmed</span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {auditMetrics.confirmedCount}
              </p>
              <span className="text-[11px] text-slate-400">All working as indicated</span>
            </div>

            {/* Card 6: Audit Period */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Active Audit Cycle</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-2 truncate">
                {fortnightLabel || 'Loading...'}
              </p>
              <span className="text-[11px] font-mono text-sky-600">
                F{filterFortnight} ({filterFortnight === 1 ? 'Days 1-15' : 'Days 16-31'})
              </span>
            </div>
          </div>

          {/* Submissions Search Bar & Status Filter Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={submissionSearch}
                  onChange={e => setSubmissionSearch(e.target.value)}
                  placeholder="Search by U-Number, Staff Name, or EX-Number..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-50/50 pl-9 pr-9 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500"
                />
                {submissionSearch && (
                  <button
                    type="button"
                    onClick={() => setSubmissionSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Buttons / Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-semibold flex items-center gap-1 mr-1">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Status:</span>
                </span>

                {/* All */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                    statusFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>All Submissions</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    statusFilter === 'ALL' ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {submissions.length}
                  </span>
                </button>

                {/* Pending */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('PENDING')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                    statusFilter === 'PENDING'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Pending</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    statusFilter === 'PENDING' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}>
                    {auditMetrics.missingCount}
                  </span>
                </button>

                {/* Confirmed */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('CONFIRMED')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                    statusFilter === 'CONFIRMED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Confirmed</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    statusFilter === 'CONFIRMED' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}>
                    {auditMetrics.confirmedCount}
                  </span>
                </button>

                {/* Change Requested */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('CHANGE_REQUESTED')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                    statusFilter === 'CHANGE_REQUESTED'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Change Requested</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    statusFilter === 'CHANGE_REQUESTED' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {auditMetrics.changeRequestCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Active search filter feedback pill */}
            {submissionSearch.trim() && (
              <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-1.5 text-xs text-sky-800 dark:bg-sky-950/30 dark:text-sky-300 border border-sky-100 dark:border-sky-900/50">
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-sky-600" />
                  <span>
                    Searching for: <span className="font-semibold">&quot;{submissionSearch}&quot;</span> &mdash; found {filteredSubmissions.length} matching submitted records, {filteredMissingStaff.length} pending staff
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmissionSearch('')}
                  className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>

          {/* Submissions Table */}
          {statusFilter !== 'PENDING' && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Logged Fortnight Submissions ({filteredSubmissions.length})</span>
                    {submissionSearch && (
                      <span className="text-xs font-normal text-slate-400">
                        (filtered from {submissions.length})
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Audit records for cycle: {fortnightLabel}
                  </p>
                </div>

                {filteredSubmissions.length > 0 && (
                  <div className="text-xs text-slate-500 font-medium">
                    Showing {filteredSubmissions.length} record{filteredSubmissions.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>

              {loadingAudit ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-t-transparent mx-auto mb-2" />
                  <span>Loading audit submissions...</span>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-500">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    {submissionSearch ? 'No matching submissions found' : 'No submissions found'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {submissionSearch
                      ? `No staff submissions matched "${submissionSearch}". Try modifying your search or clearing the query.`
                      : `No staff submissions match the selected filter for ${fortnightLabel}.`}
                  </p>
                  {submissionSearch && (
                    <button
                      type="button"
                      onClick={() => setSubmissionSearch('')}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline"
                    >
                      Clear Search Filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="py-3 px-4 font-semibold">U-Number</th>
                        <th className="py-3 px-4 font-semibold">Staff Name</th>
                        <th className="py-3 px-4 font-semibold">Verification Date</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Active Fields</th>
                        <th className="py-3 px-4 font-semibold">Changes Flagged</th>
                        <th className="py-3 px-4 font-semibold">Submitted At</th>
                        <th className="py-3 px-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredSubmissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                            {sub.uNumber}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                            <div>{sub.name}</div>
                            {sub.exNumber && sub.exNumber !== 'N/A' && (
                              <div className="text-[11px] text-slate-400 font-mono">EX: {sub.exNumber}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {sub.verificationDate}
                          </td>
                          <td className="py-3 px-4">
                            {sub.hasChangeRequests ? (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Change Request</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Confirmed</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {sub.totalActiveFields} systems
                          </td>
                          <td className="py-3 px-4">
                            {sub.changeRequestCount > 0 ? (
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                {sub.changeRequestCount} issue(s)
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedSubmission(sub)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Missing / Pending Staff Table (Shown when filter is PENDING or ALL) */}
          {(statusFilter === 'PENDING' || statusFilter === 'ALL') && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/30 dark:bg-rose-950/10">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Pending Submissions for Current Fortnight ({filteredMissingStaff.length} Staff Pending
                    {submissionSearch ? ` of ${missingStaff.length}` : ''})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => exportToCsv('missing-staff')}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-400"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Missing List (.CSV)</span>
                </button>
              </div>

              {filteredMissingStaff.length === 0 ? (
                <div className="py-8 text-center text-xs text-emerald-600 font-semibold">
                  {submissionSearch
                    ? `No pending staff match "${submissionSearch}".`
                    : '100% Complete! All master staff have submitted their verification for this fortnight.'}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">U-Number</th>
                        <th className="py-2.5 px-4 font-semibold">Employee Name</th>
                        <th className="py-2.5 px-4 font-semibold">EX-Number</th>
                        <th className="py-2.5 px-4 font-semibold">Fortnight Due</th>
                        <th className="py-2.5 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredMissingStaff.slice(0, 50).map((staff, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                            {staff.uNumber}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                            {staff.name}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-mono">
                            {staff.exNumber || 'N/A'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                            {fortnightLabel}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="rounded-sm bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                              PENDING SUBMISSION
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredMissingStaff.length > 50 && (
                    <div className="p-2 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 border-t border-slate-100">
                      Showing first 50 of {filteredMissingStaff.length} pending staff members. Export CSV to view all.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MASTER CREDENTIALS & PDF DATABASE REPLACEMENT */}
      {adminView === 'master' && (
        <div className="space-y-6">
          {/* PDF & CSV Upload Box */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-5 dark:border-sky-900/60 dark:bg-sky-950/20 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  <span>Upload Master Credentials (PDF or CSV)</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                  Upload a complete roster or a file with only a few names to add or update. When uploading, credentials for matching U-Numbers are automatically overwritten (no duplicate U-Numbers), and new U-Numbers are appended to the master registry.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:bg-slate-800 dark:text-sky-300 flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download CSV Template</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetToBaseline}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Reset to Original Baseline
                </button>
              </div>
            </div>

            {/* Upload form */}
            <div className="mt-4 pt-4 border-t border-sky-200/50 dark:border-sky-900/40">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,.csv,.txt"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setPdfFile(e.target.files[0]);
                      setParsedPreview(null);
                      setUploadError(null);
                    }
                  }}
                  className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-700"
                />

                {pdfFile && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUploadingPdf}
                      onClick={() => handlePdfUpload('preview')}
                      className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 disabled:opacity-50"
                    >
                      {isUploadingPdf ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Processing file...</span>
                        </>
                      ) : (
                        <>
                          <Search className="h-3.5 w-3.5" />
                          <span>Extract & Preview File</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedPreview && (
                <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 dark:border-emerald-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>
                        Extracted {parsedPreview.count} Staff Records from File
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setParsedPreview(null)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isUploadingPdf}
                        onClick={() => handlePdfUpload('commit')}
                        className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Confirm & Upsert Master Database</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-slate-50 text-slate-600 sticky top-0 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="p-2">U-Number</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Altea LH</th>
                          <th className="p-2">M365</th>
                          <th className="p-2">TAC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsedPreview.records.slice(0, 15).map((r, i) => {
                          const isExisting = masterStaffList.some(
                            s => s.uNumber.trim().toUpperCase() === r.uNumber.trim().toUpperCase()
                          );
                          return (
                            <tr key={i}>
                              <td className="p-2 font-mono font-bold text-sky-600 dark:text-sky-400">{r.uNumber}</td>
                              <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{r.name}</td>
                              <td className="p-2">
                                {isExisting ? (
                                  <span className="rounded-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold dark:bg-amber-950 dark:text-amber-300">
                                    OVERWRITE
                                  </span>
                                ) : (
                                  <span className="rounded-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold dark:bg-emerald-950 dark:text-emerald-300">
                                    NEW U-NUM
                                  </span>
                                )}
                              </td>
                              <td className="p-2 font-mono">{r.credentials.alteaLhc || 'N'}</td>
                              <td className="p-2 font-mono">{r.credentials.ms365 || 'N'}</td>
                              <td className="p-2 font-mono">{formatCredentialDisplay('tac', r.credentials.tac)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {parsedPreview.count > 15 && (
                    <p className="mt-2 text-center text-[11px] text-slate-400">
                      Showing 15 of {parsedPreview.count} extracted staff rows.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Master Staff Database Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Active Master Credentials Registry ({masterStaffList.length} Staff Profiles)
                </h3>
                <p className="text-xs text-slate-500">
                  Data source used for live bi-weekly staff validation
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={masterSearch}
                    onChange={e => {
                      const val = e.target.value;
                      setMasterSearch(val);
                      startTransition(() => {
                        fetchMasterData();
                      });
                    }}
                    placeholder="Search name or U-Number..."
                    className="w-44 sm:w-56 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 pl-8 text-xs text-slate-900 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                </div>

                {/* Export Master File (Latest) Button */}
                <button
                  type="button"
                  onClick={exportMasterCredentialsFileLatest}
                  title="Export complete master credentials roster as latest CSV"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Export Master File (Latest)</span>
                </button>

                {/* Export Confirmations by Login Type */}
                <button
                  type="button"
                  onClick={exportConfirmationsPerLoginType}
                  title="Export all confirmations per log-in type per staff for this reporting period"
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-2xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Confirmations by Login Type (.CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsNewStaffModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition-colors shadow-2xs"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add Staff Record</span>
                </button>
              </div>
            </div>

            {/* Credential Status Color-Coding Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Live Verification Status:</span>
                <span className="font-medium text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                  Cycle: {fortnightLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-600 text-white shadow-2xs">
                    GREEN
                  </span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white shadow-2xs">
                    RED
                  </span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">Change Requested</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-400 text-black shadow-2xs">
                    YELLOW
                  </span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">Not Confirmed</span>
                </div>
              </div>
            </div>

            {loadingMaster ? (
              <div className="py-16 text-center text-sm text-slate-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-t-transparent mx-auto mb-2" />
                <span>Loading master records...</span>
              </div>
            ) : masterStaffList.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">
                No staff records match your search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[620px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">U-Number</th>
                      <th className="py-2.5 px-3 font-semibold">Name</th>
                      <th className="py-2.5 px-3 font-semibold">EX-No (ALS)</th>
                      <th className="py-2.5 px-3 font-semibold text-center">CUTE</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Altea LH</th>
                      <th className="py-2.5 px-3 font-semibold text-center">LOOK</th>
                      <th className="py-2.5 px-3 font-semibold text-center">EBASE</th>
                      <th className="py-2.5 px-3 font-semibold text-center">LMS</th>
                      <th className="py-2.5 px-3 font-semibold text-center">MesWeb</th>
                      <th className="py-2.5 px-3 font-semibold text-center">WorldTrac</th>
                      <th className="py-2.5 px-3 font-semibold text-center">SBH</th>
                      <th className="py-2.5 px-3 font-semibold text-center">DASGO</th>
                      <th className="py-2.5 px-3 font-semibold text-center">M365</th>
                      <th className="py-2.5 px-3 font-semibold text-center" title="Turnaround companion App (Codes: Y, MOD, ALS)">
                        Turnaround App (TAC)
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-center">EMM</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {masterStaffList.map(staff => {
                      const isAls = isUserAls(staff.credentials, staff.exNumber);
                      return (
                        <tr key={staff.id || staff.uNumber} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                            {staff.uNumber}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            {staff.name}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                            {isAls ? (
                              <span className="font-semibold text-purple-700 dark:text-purple-300">{staff.exNumber || 'N/A'}</span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'cuteAccess', staff.credentials.cuteAccess || 'Y')}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'alteaLhc', staff.credentials.alteaLhc)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'look', staff.credentials.look)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'ebase', staff.credentials.ebase)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'lms', staff.credentials.lms)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'mesWeb', staff.credentials.mesWeb)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'worldTracer', staff.credentials.worldTracer)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'sbh', staff.credentials.sbh)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'dasgo', staff.credentials.dasgo)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'ms365', staff.credentials.ms365)}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {renderRegistryCredentialBadge(staff.uNumber, 'tac', staff.credentials.tac)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderRegistryCredentialBadge(staff.uNumber, 'emm', staff.credentials.emm)}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingStaff(staff)}
                                title="Edit credentials"
                                className="p-1 rounded-sm text-slate-500 hover:bg-slate-100 hover:text-sky-600"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaffRecord(staff.uNumber)}
                                title="Delete record"
                                className="p-1 rounded-sm text-slate-500 hover:bg-slate-100 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INSPECTION MODAL: View Full Single Submission Details */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="font-mono text-xs text-sky-600 dark:text-sky-400">
                  {selectedSubmission.id}
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Submission Audit Details: {selectedSubmission.name}
                </h2>
                <p className="text-xs text-slate-500">
                  U-Number: <span className="font-mono font-bold">{selectedSubmission.uNumber}</span>
                  {((selectedSubmission.exNumber && selectedSubmission.exNumber !== 'N/A') ||
                    selectedSubmission.verifications.some(v => v.fieldKey === 'tac' && v.currentValue?.toUpperCase().includes('ALS'))) && (
                    <> · EX-Number (ALS): <span className="font-mono font-semibold">{selectedSubmission.exNumber}</span></>
                  )} · Date: <span>{selectedSubmission.verificationDate}</span> · Cycle: {selectedSubmission.fortnightLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Status Summary Banner */}
            <div
              className={`my-4 rounded-lg p-3 text-xs flex items-center justify-between border ${
                selectedSubmission.hasChangeRequests
                  ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {selectedSubmission.hasChangeRequests ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                <span className="font-bold">
                  {selectedSubmission.hasChangeRequests
                    ? `${selectedSubmission.changeRequestCount} Change Request(s) flagged for IT Action`
                    : 'All Active Credentials Confirmed Working'}
                </span>
              </div>
              <span>
                {selectedSubmission.confirmedCount} Confirmed · {selectedSubmission.changeRequestCount} Changes Requested
              </span>
            </div>

            {/* Credentials breakdown table */}
            <div className="overflow-x-auto max-h-96 rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Credential Field</th>
                    <th className="py-2.5 px-3 font-semibold">Master Value</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Staff Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedSubmission.verifications
                    .filter(v => {
                      if (v.fieldKey === 'wtTablet' || v.fieldKey === 'alteaLxc') return false;
                      const isSubAls = Boolean(
                        (selectedSubmission.exNumber && selectedSubmission.exNumber !== 'N/A') ||
                        selectedSubmission.verifications.some(
                          item => (item.fieldKey === 'tac' && item.currentValue?.toUpperCase().includes('ALS')) ||
                                  item.fieldKey === 'lhalteaF' ||
                                  item.fieldKey === 'float'
                        )
                      );
                      if (['lhalteaF', 'lxAlteaF', 'float', 'floatBac'].includes(v.fieldKey) && !isSubAls) {
                        return false;
                      }
                      const isSubM365 = selectedSubmission.verifications.some(
                        item => item.fieldKey === 'ms365' && item.currentValue && item.currentValue !== 'N' && item.currentValue !== 'N/A'
                      );
                      if (v.fieldKey === 'pki' && !isSubM365) {
                        return false;
                      }
                      return true;
                    })
                    .map((v, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {v.fieldLabel.replace(/ALTEA LHC/gi, 'Altea LH').replace(/MS365/gi, 'M365')}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-sky-700 dark:text-sky-300">
                        {formatCredentialDisplay(v.fieldKey, v.currentValue)}
                      </td>
                      <td className="py-2.5 px-3">
                        {v.status === 'CONFIRMED' ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Change Requested
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {v.remark ? (
                          <span className="italic">{v.remark}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedSubmission.overallRemarks && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Overall Remark:</span>
                <p className="mt-1 text-slate-600 dark:text-slate-300 italic">{selectedSubmission.overallRemarks}</p>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit or Add Staff Record */}
      {(editingStaff || isNewStaffModalOpen) && (
        <StaffEditorModal
          initialRecord={
            editingStaff || {
              id: '',
              uNumber: '',
              exNumber: 'N/A',
              name: '',
              credentials: {
                cuteAccess: 'Y',
                oneRes: 'N', alteaLhc: 'N', look: 'N', ebase: 'N', lms: 'N',
                mesWeb: 'N', mesWebIn: 'N', worldTracer: 'N', sbh: 'N', dasgo: 'N',
                ms365: 'N', lhalteaF: 'N', lxAlteaF: 'N', float: 'N', floatBac: 'N', pki: 'N',
                tac: '["N"]', emm: 'N'
              }
            }
          }
          isNew={isNewStaffModalOpen}
          onClose={() => {
            setEditingStaff(null);
            setIsNewStaffModalOpen(false);
          }}
          onSave={handleSaveStaffRecord}
        />
      )}
    </div>
  );
}

// Sub-component for editing or adding staff master credentials
function StaffEditorModal({
  initialRecord,
  isNew,
  onClose,
  onSave
}: {
  initialRecord: UserCredentialRecord;
  isNew: boolean;
  onClose: () => void;
  onSave: (record: UserCredentialRecord) => void;
}) {
  const [uNumber, setUNumber] = useState(initialRecord.uNumber);
  const [name, setName] = useState(initialRecord.name);
  const [exNumber, setExNumber] = useState(initialRecord.exNumber || 'N/A');
  const [credentials, setCredentials] = useState<CredentialFields>({ ...initialRecord.credentials });

  const handleCredChange = (fieldKey: keyof CredentialFields, val: string) => {
    setCredentials(prev => ({
      ...prev,
      [fieldKey]: val
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uNumber.trim() || !name.trim()) return;

    onSave({
      id: uNumber.trim(),
      uNumber: uNumber.trim(),
      name: name.trim(),
      exNumber: exNumber.trim(),
      credentials
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isNew ? 'Add New Staff Record' : `Edit Master Record: ${initialRecord.uNumber}`}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                U-Number *
              </label>
              <input
                type="text"
                required
                value={uNumber}
                onChange={e => setUNumber(e.target.value.toUpperCase())}
                placeholder="e.g. U194283"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Staff Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value.toUpperCase())}
                placeholder="e.g. RAKESH PARMAR"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                EX-Number
              </label>
              <input
                type="text"
                value={exNumber}
                onChange={e => setExNumber(e.target.value)}
                placeholder="e.g. EX855733 or N/A"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              System Credential Values
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto p-1">
              {CREDENTIAL_FIELD_CONFIG.map(cfg => (
                <div key={cfg.key} className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700">
                  <span className="block font-semibold text-slate-700 dark:text-slate-300 truncate" title={cfg.label}>
                    {cfg.label}
                  </span>
                  {cfg.key === 'tac' ? (
                    <div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {['Y', 'MOD', 'ALS', 'Y, MOD, ALS', 'N'].map((code, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleCredChange('tac', code === 'N' ? '["N"]' : code === 'Y, MOD, ALS' ? '["MOD","ALS","Y"]' : `["${code}"]`)}
                            className="rounded-xs bg-purple-50 px-1 py-0.5 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 border border-purple-200 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300"
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={credentials[cfg.key] || ''}
                        onChange={e => handleCredChange(cfg.key, e.target.value)}
                        placeholder='Codes: Y, MOD, ALS'
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={credentials[cfg.key] || ''}
                      onChange={e => handleCredChange(cfg.key, e.target.value)}
                      placeholder="e.g. Y, N, SUP"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-700"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
