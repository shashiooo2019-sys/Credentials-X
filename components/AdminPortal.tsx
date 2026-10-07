'use client';

import React, { useState, useEffect, useTransition, useCallback, useMemo, useRef } from 'react';
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
  Clock,
  ChevronLeft,
  ChevronRight
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
  const [masterSearchUNum, setMasterSearchUNum] = useState('');
  const [masterSearchName, setMasterSearchName] = useState('');
  const [credentialFieldFilters, setCredentialFieldFilters] = useState<Record<string, string>>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [masterNotice, setMasterNotice] = useState<string | null>(null);

  // Filtered master staff list strictly maintaining original CSV import order
  const filteredMasterStaff = useMemo(() => {
    return masterStaffList.filter(staff => {
      // 1. Filter by U-Number
      if (masterSearchUNum.trim()) {
        const uQuery = masterSearchUNum.trim().toUpperCase();
        if (!staff.uNumber.toUpperCase().includes(uQuery)) return false;
      }

      // 2. Filter by Name
      if (masterSearchName.trim()) {
        const nameQuery = masterSearchName.trim().toUpperCase();
        if (!staff.name.toUpperCase().includes(nameQuery)) return false;
      }

      // 3. Filter by individual Credential Field values (e.g. LOOK: Y/N, TAC: MOD/ALS/Y/N, etc.)
      for (const [key, filterVal] of Object.entries(credentialFieldFilters)) {
        if (!filterVal || filterVal === 'ALL') continue;

        const val = staff.credentials[key as keyof CredentialFields] || '';
        const normVal = String(val).toUpperCase();

        if (key === 'tac') {
          if (filterVal === 'N') {
            if (normVal !== 'N' && normVal !== '["N"]' && normVal !== '') return false;
          } else if (filterVal === 'Y') {
            if (!normVal.includes('Y')) return false;
          } else if (filterVal === 'MOD') {
            if (!normVal.includes('MOD')) return false;
          } else if (filterVal === 'ALS') {
            if (!normVal.includes('ALS')) return false;
          } else if (filterVal === 'ALL_CODES') {
            if (!normVal.includes('MOD') && !normVal.includes('ALS') && !normVal.includes('Y')) return false;
          } else {
            if (!normVal.includes(filterVal.toUpperCase())) return false;
          }
        } else {
          const target = filterVal.toUpperCase();
          if (target === 'Y') {
            if (normVal !== 'Y' && !normVal.includes('Y')) return false;
          } else if (target === 'N') {
            if (normVal !== 'N' && normVal !== '' && normVal !== '["N"]') return false;
          } else if (target === 'SUP') {
            if (!normVal.includes('SUP')) return false;
          } else if (target === 'EDIT') {
            if (!normVal.includes('EDIT')) return false;
          } else if (target === 'VIEW ONLY') {
            if (!normVal.includes('VIEW') && !normVal.includes('ONLY')) return false;
          } else {
            if (!normVal.includes(target)) return false;
          }
        }
      }

      return true;
    });
  }, [masterStaffList, masterSearchUNum, masterSearchName, credentialFieldFilters]);

  const activeCredentialFilterCount = Object.values(credentialFieldFilters).filter(v => v && v !== 'ALL').length +
    (masterSearchUNum.trim() ? 1 : 0) +
    (masterSearchName.trim() ? 1 : 0);

  const clearAllMasterFilters = () => {
    setMasterSearchUNum('');
    setMasterSearchName('');
    setCredentialFieldFilters({});
  };

  // PDF Upload & Extraction State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{ records: UserCredentialRecord[]; count: number } | null>(null);

  // Edit / Add Staff Modal State
  const [editingStaff, setEditingStaff] = useState<UserCredentialRecord | null>(null);
  const [isNewStaffModalOpen, setIsNewStaffModalOpen] = useState(false);
  const [isDeleteDbModalOpen, setIsDeleteDbModalOpen] = useState(false);
  const [isDeletingAllDb, setIsDeletingAllDb] = useState(false);
  const [, startTransition] = useTransition();

  // Horizontal Scroll Reference for Master Staff Table
  const masterTableScrollRef = useRef<HTMLDivElement>(null);

  const scrollMasterTable = (direction: 'left' | 'right') => {
    if (masterTableScrollRef.current) {
      const scrollDistance = 320;
      masterTableScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollDistance : scrollDistance,
        behavior: 'smooth'
      });
    }
  };

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
      const url = `/api/credentials/master`;
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
  }, []);

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

          const masterUrl = `/api/credentials/master`;
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
  }, [isAuthenticated, filterYear, filterMonth, filterFortnight, statusFilter]);

  // Download CSV Upload Template for Admin
  const downloadCsvTemplate = () => {
    const headers = [
      'UNUMBER',
      'EX Number',
      'NAMES',
      'ONE RES',
      'ALTEA LHCM',
      'Altea LXCM',
      'LOOK',
      'EBASE',
      'LMS',
      'MesWeb',
      'MesWeb Internet',
      'WorldTracer',
      'WT Tablet',
      'SBH',
      'DASGO',
      'MS365',
      'LHALTEA FM',
      'LX ALTEA FM',
      'FLOAT',
      'FLOAT Backup',
      'PKI',
      'TAC',
      'EMM'
    ];
    const sampleRows = [
      '"U194283","EX855733","RAKESH PARMAR","N","SUP","N","Y","Y","Y","Y","N","Y","N","N","Y","Y","N","N","N","N","Y","[\"MOD\"]","N"',
      '"U194317","EX855755","JASPREET MALIK","N","SUP","N","Y","Y","Y","Y","N","Y","N","Y","Y","Y","N","N","N","N","Y","[\"MOD\"]","N"',
      '"U200001","N/A","NEW STAFF MEMBER","Y","Y","N","Y","Y","N","Y","N","Y","N","N","Y","Y","N","N","N","N","N","[\"Y\"]","N"'
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

  // Handle PDF or CSV Upload / Direct Paste to update master database
  const handlePdfUpload = async (action: 'preview' | 'commit') => {
    if (!pdfFile && !pastedText.trim() && !parsedPreview) return;

    setIsUploadingPdf(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      if (pastedText.trim() && !pdfFile) {
        const textBlob = new Blob([pastedText.trim()], { type: 'text/csv' });
        const textFile = new File([textBlob], 'pasted_master_records.csv', { type: 'text/csv' });
        formData.append('file', textFile);
      } else if (pdfFile) {
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

      let data: {
        success?: boolean;
        error?: string;
        records?: UserCredentialRecord[];
        count?: number;
        message?: string;
      } | null = null;

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        const titleMatch = rawText.match(/<title>([^<]*)<\/title>/i);
        const errHeadline = titleMatch ? titleMatch[1] : (res.statusText || 'Server Error');
        throw new Error(`Server returned ${res.status} (${errHeadline}). If the file is very large, try a smaller file or CSV format.`);
      }

      if (!res.ok || !data || !data.success) {
        setUploadError(data?.error || 'File processing failed.');
        setIsUploadingPdf(false);
        return;
      }

      if (action === 'preview') {
        setParsedPreview({ records: data.records || [], count: data.count || (data.records ? data.records.length : 0) });
        setMasterNotice(data.message || `Extracted ${data.count} staff records for preview.`);
      } else {
        setMasterNotice(data.message || `Master database successfully updated with ${data.count} staff records!`);
        setParsedPreview(null);
        setPdfFile(null);
        setPastedText('');
        fetchMasterData();
        fetchFortnightData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setUploadError(msg);
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
      'EX Number',
      'NAMES',
      'ONE RES',
      'ALTEA LHCM',
      'Altea LXCM',
      'LOOK',
      'EBASE',
      'LMS',
      'MesWeb',
      'MesWeb Internet',
      'WorldTracer',
      'WT Tablet',
      'SBH',
      'DASGO',
      'MS365',
      'LHALTEA FM',
      'LX ALTEA FM',
      'FLOAT',
      'FLOAT Backup',
      'PKI',
      'TAC',
      'EMM',
      'Last Updated'
    ];

    const rows: string[] = [headers.join(',')];

    masterStaffList.forEach(s => {
      const c = s.credentials;
      rows.push(
        [
          `"${s.uNumber}"`,
          `"${s.exNumber || 'N/A'}"`,
          `"${s.name}"`,
          `"${c.oneRes || 'N'}"`,
          `"${c.alteaLhc || 'N'}"`,
          `"N/A"`, // Altea LXCM ignored field
          `"${c.look || 'N'}"`,
          `"${c.ebase || 'N'}"`,
          `"${c.lms || 'N'}"`,
          `"${c.mesWeb || 'N'}"`,
          `"${c.mesWebIn || 'N'}"`,
          `"${c.worldTracer || 'N'}"`,
          `"N/A"`, // WT Tablet ignored field
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

  // Delete entire Master Credentials Registry
  const handleDeleteEntireDatabase = async () => {
    setIsDeletingAllDb(true);
    try {
      const res = await fetch('/api/credentials/master?all=true', {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setMasterNotice('Entire Master Credentials Database has been deleted successfully.');
        setMasterStaffList([]);
        setIsDeleteDbModalOpen(false);
        fetchMasterData();
        fetchFortnightData();
      } else {
        setUploadError(data.error || 'Failed to delete database');
      }
    } catch (err) {
      console.error('Error deleting entire database:', err);
      setUploadError('Network error while attempting to clear database.');
    } finally {
      setIsDeletingAllDb(false);
    }
  };

  // IF NOT AUTHENTICATED: Show Admin Sign In Form
  if (!isAuthenticated) {
    return (
      <div className="w-full flex-1 flex items-center justify-center py-12 px-3 sm:px-6">
        <div className="darkblue-card rounded-3xl p-8 sm:p-10 max-w-md w-full relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />

          <div className="text-center mb-6">
            <div className="mx-auto mb-3.5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-blue-600 via-blue-700 to-indigo-950 text-white shadow-[0_8px_20px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] border border-blue-400/40 ring-4 ring-blue-500/20 hover:-translate-y-1 transition-transform duration-200">
              <Lock className="h-7 w-7 text-sky-200 drop-shadow-sm" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-xs">
              Administrator Access
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              Bi-weekly audit, fortnight review reports, and PDF master management.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-200 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                className="w-full rounded-xl border-2 border-blue-900/60 bg-[#071024] px-3.5 py-2.5 text-sm font-bold text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-200 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full rounded-xl border-2 border-blue-900/60 bg-[#071024] px-3.5 py-2.5 text-sm font-bold text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-inner"
              />
            </div>

            {loginError && (
              <div className="rounded-2xl border-2 border-red-500/50 bg-red-950/50 p-3.5 text-xs text-red-200 flex items-center gap-2 font-bold shadow-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full darkblue-btn-primary flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-sky-200" />
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
    <div className="w-full max-w-7xl mx-auto py-6 px-3 sm:px-6 lg:px-8 space-y-6 flex-1 flex flex-col">
      {/* Top Navigation for Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-900/60 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Admin Operations &amp; Audit Portal</span>
          </h1>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Monitor fortnight feedback (1-15 &amp; 16-31), resolve change requests, and update master database with live Firestore persistence.
          </p>
        </div>

        {/* View Switcher: Audit vs Master Database */}
        <div className="flex flex-wrap items-center rounded-2xl bg-[#070f22] p-1 border border-blue-900/60 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] gap-1">
          <button
            onClick={() => setAdminView('audit')}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3.5 sm:px-4 py-2 font-black transition-all cursor-pointer whitespace-nowrap ${
              adminView === 'audit'
                ? 'darkblue-btn-primary text-white'
                : 'text-slate-400 hover:text-white hover:-translate-y-0.5'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0" />
            <span>Fortnight Audit &amp; Submissions</span>
          </button>
          <button
            onClick={() => setAdminView('master')}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3.5 sm:px-4 py-2 font-black transition-all cursor-pointer whitespace-nowrap ${
              adminView === 'master'
                ? 'darkblue-btn-primary text-white'
                : 'text-slate-400 hover:text-white hover:-translate-y-0.5'
            }`}
          >
            <Database className="h-4 w-4 shrink-0" />
            <span>Master PDF Database ({masterStaffList.length})</span>
          </button>
        </div>
      </div>

      {masterNotice && (
        <div className="flex items-center justify-between rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-950/80 to-[#070f22] px-4 py-3 text-xs text-emerald-200 shadow-sm">
          <div className="flex items-center gap-2 font-black">
            <Check className="h-4 w-4 text-emerald-400" />
            <span>{masterNotice}</span>
          </div>
          <button onClick={() => setMasterNotice(null)} className="text-emerald-300 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* VIEW 1: FORTNIGHT AUDIT & SUBMISSIONS */}
      {adminView === 'audit' && (
        <div className="space-y-6">
          {/* Fortnight Selector Bar */}
          <div className="darkblue-card rounded-3xl p-4 sm:p-5 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-black text-white">
                  <Calendar className="h-4 w-4 text-sky-400" />
                  <span>Fortnight Cycle:</span>
                </div>

                {/* Year */}
                <select
                  value={filterYear}
                  onChange={e => setFilterYear(parseInt(e.target.value, 10))}
                  className="rounded-xl border-2 border-blue-900/60 bg-[#071024] px-3 py-1.5 text-xs font-black text-white shadow-inner focus:border-blue-500"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>

                {/* Month */}
                <select
                  value={filterMonth}
                  onChange={e => setFilterMonth(parseInt(e.target.value, 10))}
                  className="rounded-xl border-2 border-blue-900/60 bg-[#071024] px-3 py-1.5 text-xs font-black text-white shadow-inner focus:border-blue-500"
                >
                  {monthNames.map((m, idx) => (
                    <option key={idx} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>

                {/* Fortnight 1 (1-15) vs Fortnight 2 (16-31) */}
                <div className="flex items-center rounded-xl bg-[#060e20] p-0.5 border border-blue-900/60 text-xs shadow-inner">
                  <button
                    type="button"
                    onClick={() => setFilterFortnight(1)}
                    className={`rounded-lg px-3 py-1 font-black transition-all cursor-pointer ${
                      filterFortnight === 1
                        ? 'darkblue-btn-primary text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1-15 (F1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterFortnight(2)}
                    className={`rounded-lg px-3 py-1 font-black transition-all cursor-pointer ${
                      filterFortnight === 2
                        ? 'darkblue-btn-primary text-white'
                        : 'text-slate-400 hover:text-white'
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
                  className="text-xs text-sky-400 hover:text-sky-300 font-extrabold underline ml-1 cursor-pointer"
                >
                  Today&apos;s Cycle
                </button>
              </div>

              {/* Refresh & CSV Export Actions */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={fetchFortnightData}
                  disabled={loadingAudit}
                  title="Reload audit data"
                  className="darkblue-btn-secondary flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToCsv('current-view')}
                  className="emerald-btn-3d flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black cursor-pointer shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={exportConfirmationsPerLoginType}
                  title="Export all confirmations per log-in type per staff for this reporting period"
                  className="darkblue-btn-primary flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black cursor-pointer shrink-0"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-sky-200" />
                  <span>Confirmations by Login Type (.CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToCsv('change-requests')}
                  title="Export only flagged change requests"
                  className="amber-btn-3d flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0"
                >
                  <span>Change Requests CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToCsv('missing-staff')}
                  title="Export list of staff who have not verified"
                  className="darkblue-btn-secondary flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-rose-300 border-rose-500/40 cursor-pointer shrink-0"
                >
                  <span>Missing Staff CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Metric KPI Cards (Click to filter) - with Dark Blue Depth and Hover Lift */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Card 1: Total Staff */}
            <div
              onClick={() => {
                setStatusFilter('ALL');
                setSubmissionSearch('');
              }}
              title="Click to view all master staff"
              className={`cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] ${
                statusFilter === 'ALL' && !submissionSearch
                  ? 'border-blue-400 bg-gradient-to-b from-[#162c5b] to-[#0a152e] ring-2 ring-blue-500/40'
                  : 'border-blue-900/50 bg-gradient-to-b from-[#0e1c3b] to-[#070f22] hover:border-blue-500'
              }`}
            >
              <span className="text-xs font-black text-sky-300 uppercase tracking-wider">Master Staff</span>
              <p className="text-2xl font-black text-white mt-1">
                {auditMetrics.totalStaffCount}
              </p>
              <span className="text-[11px] text-slate-400 font-bold">Total in baseline</span>
            </div>

            {/* Card 2: Submitted */}
            <div
              onClick={() => setStatusFilter('ALL')}
              title="Click to view all submissions"
              className={`cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] ${
                statusFilter === 'ALL'
                  ? 'border-blue-400 bg-gradient-to-b from-[#162c5b] to-[#0a152e] ring-2 ring-blue-500/40'
                  : 'border-blue-900/50 bg-gradient-to-b from-[#0e1c3b] to-[#070f22] hover:border-blue-500'
              }`}
            >
              <span className="text-xs font-black text-sky-300 uppercase tracking-wider">Submissions</span>
              <p className="text-2xl font-black text-white mt-1">
                {auditMetrics.submittedCount}
              </p>
              <span className="text-[11px] text-sky-200 font-black">
                {auditMetrics.complianceRate}% compliance
              </span>
            </div>

            {/* Card 3: Missing / Pending */}
            <div
              onClick={() => setStatusFilter('PENDING')}
              title="Click to view pending submissions"
              className={`cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] ${
                statusFilter === 'PENDING'
                  ? 'border-rose-500 bg-gradient-to-b from-rose-950/80 to-[#070f22] ring-2 ring-rose-400'
                  : 'border-blue-900/50 bg-gradient-to-b from-[#0e1c3b] to-[#070f22] hover:border-rose-400'
              }`}
            >
              <span className="text-xs font-black text-rose-300 uppercase tracking-wider">Pending</span>
              <p className="text-2xl font-black text-rose-400 mt-1">
                {auditMetrics.missingCount}
              </p>
              <span className="text-[11px] text-rose-300 font-bold">Awaiting review</span>
            </div>

            {/* Card 4: Change Requests */}
            <div
              onClick={() => setStatusFilter('CHANGE_REQUESTED')}
              title="Click to view change requests"
              className={`cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] ${
                statusFilter === 'CHANGE_REQUESTED'
                  ? 'border-amber-500 bg-gradient-to-b from-amber-950/80 to-[#070f22] ring-2 ring-amber-400'
                  : 'border-blue-900/50 bg-gradient-to-b from-[#0e1c3b] to-[#070f22] hover:border-amber-400'
              }`}
            >
              <span className="text-xs font-black text-amber-300 uppercase tracking-wider">Changes</span>
              <p className="text-2xl font-black text-amber-400 mt-1">
                {auditMetrics.changeRequestCount}
              </p>
              <span className="text-[11px] text-amber-300 font-bold">Ticket required</span>
            </div>

            {/* Card 5: Confirmed */}
            <div
              onClick={() => setStatusFilter('CONFIRMED')}
              title="Click to view confirmed submissions"
              className={`cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 hover:-translate-y-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] ${
                statusFilter === 'CONFIRMED'
                  ? 'border-emerald-500 bg-gradient-to-b from-emerald-950/80 to-[#070f22] ring-2 ring-emerald-400'
                  : 'border-blue-900/50 bg-gradient-to-b from-[#0e1c3b] to-[#070f22] hover:border-emerald-400'
              }`}
            >
              <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">100% Confirmed</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {auditMetrics.confirmedCount}
              </p>
              <span className="text-[11px] text-emerald-300 font-bold">Compliant records</span>
            </div>

            {/* Card 6: Audit Period */}
            <div className="rounded-2xl border-2 border-blue-900/50 bg-gradient-to-b from-[#0e1c3b] to-[#070f22] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:-translate-y-1.5 transition-all duration-200">
              <span className="text-xs font-black text-sky-300 uppercase tracking-wider">Audit Cycle</span>
              <p className="text-sm font-black text-white mt-1.5 truncate">
                {fortnightLabel || 'Loading...'}
              </p>
              <span className="text-[11px] font-mono font-extrabold text-sky-200">
                F{filterFortnight} ({filterFortnight === 1 ? 'Days 1-15' : 'Days 16-31'})
              </span>
            </div>
          </div>

          {/* Submissions Search Bar & Status Filter Bar */}
          <div className="darkblue-card rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400" />
                <input
                  type="text"
                  value={submissionSearch}
                  onChange={e => setSubmissionSearch(e.target.value)}
                  placeholder="Search by U-Number, Staff Name, or EX-Number..."
                  className="w-full rounded-xl border-2 border-blue-900/60 bg-[#071024] pl-9 pr-9 py-2 text-xs font-bold text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none shadow-inner"
                />
                {submissionSearch && (
                  <button
                    type="button"
                    onClick={() => setSubmissionSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Buttons / Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-300 font-extrabold flex items-center gap-1 mr-1">
                  <Filter className="h-3.5 w-3.5 text-sky-400" />
                  <span>Status:</span>
                </span>

                {/* All */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-extrabold transition-all cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'darkblue-btn-primary text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-blue-950/60'
                  }`}
                >
                  <span>All Submissions</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    statusFilter === 'ALL' ? 'bg-blue-950 text-white border border-blue-400/40' : 'bg-blue-950/80 text-sky-200'
                  }`}>
                    {submissions.length}
                  </span>
                </button>

                {/* Pending */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('PENDING')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-extrabold transition-all cursor-pointer ${
                    statusFilter === 'PENDING'
                      ? 'bg-gradient-to-b from-rose-600 to-rose-800 text-white shadow-xs border border-rose-400/40'
                      : 'text-slate-300 hover:text-white hover:bg-rose-950/40'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Pending</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    statusFilter === 'PENDING' ? 'bg-rose-950 text-white' : 'bg-rose-950/80 text-rose-300'
                  }`}>
                    {auditMetrics.missingCount}
                  </span>
                </button>

                {/* Confirmed */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('CONFIRMED')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-extrabold transition-all cursor-pointer ${
                    statusFilter === 'CONFIRMED'
                      ? 'emerald-btn-3d text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-emerald-950/40'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Confirmed</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    statusFilter === 'CONFIRMED' ? 'bg-emerald-950 text-white' : 'bg-emerald-950/80 text-emerald-300'
                  }`}>
                    {auditMetrics.confirmedCount}
                  </span>
                </button>

                {/* Change Requested */}
                <button
                  type="button"
                  onClick={() => setStatusFilter('CHANGE_REQUESTED')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-extrabold transition-all cursor-pointer ${
                    statusFilter === 'CHANGE_REQUESTED'
                      ? 'amber-btn-3d text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-amber-950/40'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Change Requested</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    statusFilter === 'CHANGE_REQUESTED' ? 'bg-amber-950 text-white' : 'bg-amber-950/80 text-amber-300'
                  }`}>
                    {auditMetrics.changeRequestCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Active search filter feedback pill */}
            {submissionSearch.trim() && (
              <div className="flex items-center justify-between rounded-xl bg-blue-950/80 px-3 py-2 text-xs text-sky-200 border border-blue-800">
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-sky-400" />
                  <span>
                    Searching for: <span className="font-black text-white">&quot;{submissionSearch}&quot;</span> &mdash; found {filteredSubmissions.length} matching submitted records, {filteredMissingStaff.length} pending staff
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmissionSearch('')}
                  className="font-bold text-sky-400 hover:text-white underline cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>

          {/* Submissions Table */}
          {statusFilter !== 'PENDING' && (
            <div className="darkblue-card rounded-2xl overflow-hidden shadow-md">
              <div className="p-4 border-b border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Logged Fortnight Submissions ({filteredSubmissions.length})</span>
                    {submissionSearch && (
                      <span className="text-xs font-bold text-slate-400">
                        (filtered from {submissions.length})
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    Audit records for cycle: {fortnightLabel}
                  </p>
                </div>

                {filteredSubmissions.length > 0 && (
                  <div className="text-xs text-sky-300 font-bold">
                    Showing {filteredSubmissions.length} record{filteredSubmissions.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>

              {loadingAudit ? (
                <div className="py-16 text-center text-sm text-slate-300">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent mx-auto mb-2" />
                  <span>Loading audit submissions...</span>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-300">
                  <FileText className="h-8 w-8 text-sky-400 mx-auto mb-2" />
                  <p className="font-black text-white">
                    {submissionSearch ? 'No matching submissions found' : 'No submissions found'}
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    {submissionSearch
                      ? `No staff submissions matched "${submissionSearch}". Try modifying your search or clearing the query.`
                      : `No staff submissions match the selected filter for ${fortnightLabel}.`}
                  </p>
                  {submissionSearch && (
                    <button
                      type="button"
                      onClick={() => setSubmissionSearch('')}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:underline cursor-pointer"
                    >
                      Clear Search Filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b1b3d] text-white border-b border-blue-900/80 font-black">
                      <tr>
                        <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px]">U-Number</th>
                        <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px]">Staff Name</th>
                        <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px]">Verification Date</th>
                        <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px]">Status</th>
                        <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px]">Active Fields</th>
                        <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px]">Changes Flagged</th>
                        <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px]">Submitted At</th>
                        <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px] text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-950/80 bg-[#070e20]">
                      {filteredSubmissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-blue-950/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-black text-sky-300">
                            {sub.uNumber}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            <div>{sub.name}</div>
                            {sub.exNumber && sub.exNumber !== 'N/A' && (
                              <div className="text-[11px] text-slate-300 font-mono">EX: {sub.exNumber}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-200">
                            {sub.verificationDate}
                          </td>
                          <td className="py-3 px-4">
                            {sub.hasChangeRequests ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/80 px-2.5 py-1 text-xs font-black text-amber-200 border border-amber-600/60">
                                <AlertTriangle className="h-3 w-3 text-amber-400" />
                                <span>Change Request</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/80 px-2.5 py-1 text-xs font-black text-emerald-200 border border-emerald-600/60">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                <span>Confirmed</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-200">
                            {sub.totalActiveFields} systems
                          </td>
                          <td className="py-3 px-4">
                            {sub.changeRequestCount > 0 ? (
                              <span className="font-black text-amber-400">
                                {sub.changeRequestCount} issue(s)
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                            {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedSubmission(sub)}
                              className="darkblue-btn-secondary inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 text-sky-400" />
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
            <div className="darkblue-card rounded-2xl overflow-hidden shadow-md">
              <div className="p-4 border-b border-rose-900/60 flex items-center justify-between bg-rose-950/30">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-400/40 animate-pulse" />
                  <h3 className="text-sm font-black text-white">
                    Pending Submissions for Current Fortnight ({filteredMissingStaff.length} Staff Pending
                    {submissionSearch ? ` of ${missingStaff.length}` : ''})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => exportToCsv('missing-staff')}
                  className="flex items-center gap-1 text-xs font-black text-rose-300 hover:text-white cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-rose-400" />
                  <span>Export Missing List (.CSV)</span>
                </button>
              </div>

              {filteredMissingStaff.length === 0 ? (
                <div className="py-8 text-center text-xs text-emerald-300 font-black">
                  {submissionSearch
                    ? `No pending staff match "${submissionSearch}".`
                    : '100% Complete! All master staff have submitted their verification for this fortnight.'}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b1b3d] text-white border-b border-blue-900/80 sticky top-0 font-black">
                      <tr>
                        <th className="py-2.5 px-4 font-black">U-Number</th>
                        <th className="py-2.5 px-4 font-black">Employee Name</th>
                        <th className="py-2.5 px-4 font-black">EX-Number</th>
                        <th className="py-2.5 px-4 font-black">Fortnight Due</th>
                        <th className="py-2.5 px-4 font-black">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-950/80 bg-[#070e20]">
                      {filteredMissingStaff.slice(0, 50).map((staff, idx) => (
                        <tr key={idx} className="hover:bg-blue-950/40">
                          <td className="py-2.5 px-4 font-mono font-black text-sky-300">
                            {staff.uNumber}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-white">
                            {staff.name}
                          </td>
                          <td className="py-2.5 px-4 text-slate-300 font-mono">
                            {staff.exNumber || 'N/A'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-200 font-medium">
                            {fortnightLabel}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="rounded-md bg-rose-950/80 px-2 py-0.5 text-[11px] font-black text-rose-200 border border-rose-600/60">
                              PENDING SUBMISSION
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredMissingStaff.length > 50 && (
                    <div className="p-2 text-center text-xs text-slate-300 bg-[#081329] border-t border-blue-900/60">
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
          <div className="darkblue-card rounded-3xl p-5 sm:p-6 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Upload className="h-5 w-5 text-sky-400" />
                  <span>Upload Master Credentials (PDF or CSV)</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Upload a complete roster or a file with only a few names to add or update. When uploading, credentials for matching U-Numbers are automatically overwritten (no duplicate U-Numbers), and new U-Numbers are appended to the master registry.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="darkblue-btn-secondary flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-sky-400" />
                  <span>Download CSV Template</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetToBaseline}
                  className="darkblue-btn-secondary rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer"
                >
                  Reset to Original Baseline
                </button>
              </div>
            </div>

            {/* Upload form / Direct Paste Switcher */}
            <div className="mt-4 pt-4 border-t border-blue-900/60 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setPasteMode(false); setUploadError(null); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    !pasteMode ? 'bg-blue-600 text-white shadow-sm' : 'darkblue-btn-secondary text-slate-300'
                  }`}
                >
                  File Upload (.PDF / .CSV / .TXT)
                </button>
                <button
                  type="button"
                  onClick={() => { setPasteMode(true); setUploadError(null); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    pasteMode ? 'bg-blue-600 text-white shadow-sm' : 'darkblue-btn-secondary text-slate-300'
                  }`}
                >
                  Direct CSV / Text Paste
                </button>
              </div>

              {!pasteMode ? (
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
                    className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                  />

                  {pdfFile && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isUploadingPdf}
                        onClick={() => handlePdfUpload('preview')}
                        className="darkblue-btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingPdf ? (
                          <>
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Processing file...</span>
                          </>
                        ) : (
                          <>
                            <Search className="h-3.5 w-3.5" />
                            <span>Extract &amp; Preview File</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={4}
                    value={pastedText}
                    onChange={e => {
                      setPastedText(e.target.value);
                      setParsedPreview(null);
                      setUploadError(null);
                    }}
                    placeholder={`Paste CSV rows or tab-separated table rows here...\nExample:\nUNUMBER,EX Number,NAMES,ONE RES,ALTEA LHCM,Altea LXCM,LOOK,EBASE,LMS,MesWeb,MesWeb Internet,WorldTracer,WT Tablet,SBH,DASGO,MS365,LHALTEA FM,LX ALTEA FM,FLOAT,FLOAT Backup,PKI,TAC,EMM\nU194283,EX855733,RAKESH PARMAR,Y,SUP,N/A,Y,Y,Y,Y,Y,Y,N/A,Y,Y,Y,Y,Y,Y,N,Y,["MOD"],Y\nU289110,EX992014,SARAH CONNOR,Y,Y,N/A,N,Y,Y,N,N,Y,N/A,N,N,Y,N,N,N,N,Y,["Y"],N`}
                    className="w-full rounded-xl border border-blue-900/80 bg-[#070e20] p-3 text-xs font-mono text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                  {pastedText.trim() && (
                    <button
                      type="button"
                      disabled={isUploadingPdf}
                      onClick={() => handlePdfUpload('preview')}
                      className="darkblue-btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingPdf ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Processing text...</span>
                        </>
                      ) : (
                        <>
                          <Search className="h-3.5 w-3.5" />
                          <span>Parse &amp; Preview Pasted Data</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="mt-3 rounded-2xl border-2 border-red-500/50 bg-red-950/60 p-3 text-xs text-red-200 flex items-center gap-2 shadow-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="font-bold">{uploadError}</span>
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedPreview && (
                <div className="mt-4 rounded-2xl border-2 border-emerald-500/50 bg-[#070e20] p-4 shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-black">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>
                        Extracted {parsedPreview.count} Staff Records from File
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setParsedPreview(null)}
                        className="darkblue-btn-secondary rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isUploadingPdf}
                        onClick={() => handlePdfUpload('commit')}
                        className="emerald-btn-3d flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-black cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Confirm &amp; Upsert Master Database</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-56 rounded-xl border border-blue-900/60">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-[#0b1b3d] text-white sticky top-0 font-bold">
                        <tr>
                          <th className="p-2">U-Number</th>
                          <th className="p-2">EX-Number</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">ONE RES</th>
                          <th className="p-2">Altea LH</th>
                          <th className="p-2">MS365</th>
                          <th className="p-2">TAC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-950 bg-[#070e20]">
                        {parsedPreview.records.slice(0, 15).map((r, i) => {
                          const isExisting = masterStaffList.some(
                            s => s.uNumber.trim().toUpperCase() === r.uNumber.trim().toUpperCase()
                          );
                          return (
                            <tr key={i}>
                              <td className="p-2 font-mono font-extrabold text-sky-300">{r.uNumber}</td>
                              <td className="p-2 font-mono text-slate-300">{r.exNumber || 'N/A'}</td>
                              <td className="p-2 font-bold text-white">{r.name}</td>
                              <td className="p-2">
                                {isExisting ? (
                                  <span className="rounded-md bg-amber-950 text-amber-200 px-1.5 py-0.5 text-[10px] font-black border border-amber-500">
                                    OVERWRITE
                                  </span>
                                ) : (
                                  <span className="rounded-md bg-emerald-950 text-emerald-200 px-1.5 py-0.5 text-[10px] font-black border border-emerald-500">
                                    NEW U-NUM
                                  </span>
                                )}
                              </td>
                              <td className="p-2 font-mono text-slate-200">{r.credentials.oneRes || 'N'}</td>
                              <td className="p-2 font-mono text-slate-200">{r.credentials.alteaLhc || 'N'}</td>
                              <td className="p-2 font-mono text-slate-200">{r.credentials.ms365 || 'N'}</td>
                              <td className="p-2 font-mono text-slate-200">{formatCredentialDisplay('tac', r.credentials.tac)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {parsedPreview.count > 15 && (
                    <p className="mt-2 text-center text-[11px] text-slate-400 font-medium">
                      Showing 15 of {parsedPreview.count} extracted staff rows.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Master Staff Database Table */}
          <div className="darkblue-card rounded-3xl overflow-hidden shadow-md w-full">
            {/* Top Toolbar Header */}
            <div className="p-4 border-b border-blue-900/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Active Master Credentials Registry</span>
                  <span className="rounded-full bg-sky-950 px-2.5 py-0.5 text-xs font-bold text-sky-300 border border-sky-600/40">
                    {filteredMasterStaff.length} {filteredMasterStaff.length === masterStaffList.length ? 'Staff Profiles' : `of ${masterStaffList.length} Staff Profiles`}
                  </span>
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Maintains exact imported CSV sequence · Live bi-weekly validation data source
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                {/* Export Master File (Latest) Button */}
                <button
                  type="button"
                  onClick={exportMasterCredentialsFileLatest}
                  title="Export complete master credentials roster as latest CSV"
                  className="darkblue-btn-secondary flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0"
                >
                  <Download className="h-3.5 w-3.5 text-sky-400" />
                  <span>Export Master File</span>
                </button>

                {/* Export Confirmations by Login Type */}
                <button
                  type="button"
                  onClick={exportConfirmationsPerLoginType}
                  title="Export all confirmations per log-in type per staff for this reporting period"
                  className="emerald-btn-3d flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black cursor-pointer shrink-0"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Export Confirmations (.CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsNewStaffModalOpen(true)}
                  className="darkblue-btn-primary flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black cursor-pointer shrink-0"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add Staff Record</span>
                </button>

                {/* Delete Entire Database Button */}
                <button
                  type="button"
                  onClick={() => setIsDeleteDbModalOpen(true)}
                  title="Delete entire Active Master Credentials Registry to re-import"
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/60 bg-red-950/70 hover:bg-red-900/90 text-red-200 px-3.5 py-1.5 text-xs font-black cursor-pointer shrink-0 transition-all hover:border-red-400 shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  <span>Delete Entire Database</span>
                </button>
              </div>
            </div>

            {/* Comprehensive Search & Credential Field Filter Bar */}
            <div className="p-3.5 sm:p-4 bg-[#08132b] border-b border-blue-900/60 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center gap-2.5">
                {/* Search by U-Number */}
                <div className="relative flex-1 min-w-[170px]">
                  <input
                    type="text"
                    value={masterSearchUNum}
                    onChange={e => setMasterSearchUNum(e.target.value)}
                    placeholder="Search by U-Number (e.g. U194283)..."
                    className="w-full rounded-xl border-2 border-blue-900/60 bg-[#060e20] px-3 py-1.5 pl-8 text-xs font-bold text-white placeholder-slate-400 focus:border-sky-400 focus:outline-none shadow-inner"
                  />
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-sky-400" />
                  {masterSearchUNum && (
                    <button
                      type="button"
                      onClick={() => setMasterSearchUNum('')}
                      className="absolute right-2 top-1.5 p-0.5 text-slate-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Search by Name */}
                <div className="relative flex-1 min-w-[170px]">
                  <input
                    type="text"
                    value={masterSearchName}
                    onChange={e => setMasterSearchName(e.target.value)}
                    placeholder="Search by Staff Name (e.g. RAKESH)..."
                    className="w-full rounded-xl border-2 border-blue-900/60 bg-[#060e20] px-3 py-1.5 pl-8 text-xs font-bold text-white placeholder-slate-400 focus:border-sky-400 focus:outline-none shadow-inner"
                  />
                  <Users className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-indigo-400" />
                  {masterSearchName && (
                    <button
                      type="button"
                      onClick={() => setMasterSearchName('')}
                      className="absolute right-2 top-1.5 p-0.5 text-slate-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Toggle Field Filters Button */}
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                    showAdvancedFilters || activeCredentialFilterCount > 0
                      ? 'border-sky-400 bg-sky-950/80 text-sky-200'
                      : 'border-blue-900/60 bg-[#060e20] text-slate-300 hover:text-white hover:border-blue-700'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5 text-sky-400" />
                  <span>Credential Filters</span>
                  {activeCredentialFilterCount > 0 && (
                    <span className="rounded-full bg-sky-500 text-slate-950 px-1.5 py-0.2 text-[10px] font-black">
                      {activeCredentialFilterCount}
                    </span>
                  )}
                </button>

                {activeCredentialFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllMasterFilters}
                    className="flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Clear Filters</span>
                  </button>
                )}
              </div>

              {/* Collapsible / Expandable Credential Field Filters Panel */}
              {showAdvancedFilters && (
                <div className="pt-3 border-t border-blue-900/50">
                  <div className="text-[11px] font-black text-sky-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Filter Staff by System Credential Value:</span>
                    <span className="text-slate-400 normal-case font-normal text-[11px]">
                      Matches exact or partial credential code
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {/* LOOK Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">LOOK</label>
                      <select
                        value={credentialFieldFilters.look || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, look: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">LOOK: Y (Active)</option>
                        <option value="N">LOOK: N (None)</option>
                      </select>
                    </div>

                    {/* TAC Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">TAC (Turnaround)</label>
                      <select
                        value={credentialFieldFilters.tac || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, tac: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All TAC</option>
                        <option value="MOD">TAC: MOD</option>
                        <option value="ALS">TAC: ALS</option>
                        <option value="Y">TAC: Y</option>
                        <option value="ALL_CODES">TAC: Any (MOD, ALS, Y)</option>
                        <option value="N">TAC: N (None)</option>
                      </select>
                    </div>

                    {/* Altea LH Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">Altea LH</label>
                      <select
                        value={credentialFieldFilters.alteaLhc || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, alteaLhc: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Altea LH</option>
                        <option value="SUP">Altea LH: SUP</option>
                        <option value="Y">Altea LH: Y</option>
                        <option value="N">Altea LH: N</option>
                      </select>
                    </div>

                    {/* ONE RES Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">ONE RES</label>
                      <select
                        value={credentialFieldFilters.oneRes || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, oneRes: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">ONE RES: Y</option>
                        <option value="N">ONE RES: N</option>
                      </select>
                    </div>

                    {/* MesWeb Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">MesWeb</label>
                      <select
                        value={credentialFieldFilters.mesWeb || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, mesWeb: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">MesWeb: Y</option>
                        <option value="N">MesWeb: N</option>
                      </select>
                    </div>

                    {/* MesWeb Internet Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">MesWeb Internet</label>
                      <select
                        value={credentialFieldFilters.mesWebIn || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, mesWebIn: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">MesWeb In: Y</option>
                        <option value="N">MesWeb In: N</option>
                      </select>
                    </div>

                    {/* WorldTracer Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">WorldTracer</label>
                      <select
                        value={credentialFieldFilters.worldTracer || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, worldTracer: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">WorldTracer: Y</option>
                        <option value="N">WorldTracer: N</option>
                      </select>
                    </div>

                    {/* DASGO Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">DASGO</label>
                      <select
                        value={credentialFieldFilters.dasgo || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, dasgo: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">DASGO: Y</option>
                        <option value="Edit">DASGO: Edit</option>
                        <option value="View only">DASGO: View only</option>
                        <option value="N">DASGO: N</option>
                      </select>
                    </div>

                    {/* MS365 Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">MS365</label>
                      <select
                        value={credentialFieldFilters.ms365 || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, ms365: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">MS365: Y</option>
                        <option value="N">MS365: N</option>
                      </select>
                    </div>

                    {/* EBASE Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">EBASE</label>
                      <select
                        value={credentialFieldFilters.ebase || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, ebase: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">EBASE: Y</option>
                        <option value="N">EBASE: N</option>
                      </select>
                    </div>

                    {/* LMS Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">LMS</label>
                      <select
                        value={credentialFieldFilters.lms || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, lms: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">LMS: Y</option>
                        <option value="N">LMS: N</option>
                      </select>
                    </div>

                    {/* SBH Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">SBH</label>
                      <select
                        value={credentialFieldFilters.sbh || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, sbh: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">SBH: Y</option>
                        <option value="N">SBH: N</option>
                      </select>
                    </div>

                    {/* PKI Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">PKI Certificate</label>
                      <select
                        value={credentialFieldFilters.pki || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, pki: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">PKI: Y</option>
                        <option value="N">PKI: N</option>
                      </select>
                    </div>

                    {/* EMM Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">EMM Profile</label>
                      <select
                        value={credentialFieldFilters.emm || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, emm: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">EMM: Y</option>
                        <option value="N">EMM: N</option>
                      </select>
                    </div>

                    {/* FLOAT Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">FLOAT</label>
                      <select
                        value={credentialFieldFilters.float || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, float: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">FLOAT: Y</option>
                        <option value="N">FLOAT: N</option>
                      </select>
                    </div>

                    {/* LH Altea FM Filter */}
                    <div className="rounded-xl border border-blue-900/70 bg-[#060e20] p-2 text-xs">
                      <label className="block text-[10px] font-extrabold text-sky-200 uppercase mb-1">LH Altea FM</label>
                      <select
                        value={credentialFieldFilters.lhalteaF || 'ALL'}
                        onChange={e => setCredentialFieldFilters(prev => ({ ...prev, lhalteaF: e.target.value }))}
                        className="w-full rounded-lg bg-[#0a1532] border border-blue-800/80 px-2 py-1 text-xs text-white font-bold focus:border-sky-400"
                      >
                        <option value="ALL">All Values</option>
                        <option value="Y">LH FM: Y</option>
                        <option value="N">LH FM: N</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Filter Badges */}
              {activeCredentialFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-400 mr-1">Active Filters:</span>
                  {masterSearchUNum && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-950 px-2 py-0.5 text-[11px] font-bold text-sky-300 border border-blue-800">
                      <span>U-No: &quot;{masterSearchUNum}&quot;</span>
                      <button type="button" onClick={() => setMasterSearchUNum('')} className="hover:text-white cursor-pointer"><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {masterSearchName && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-950 px-2 py-0.5 text-[11px] font-bold text-indigo-300 border border-indigo-800">
                      <span>Name: &quot;{masterSearchName}&quot;</span>
                      <button type="button" onClick={() => setMasterSearchName('')} className="hover:text-white cursor-pointer"><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {Object.entries(credentialFieldFilters).map(([k, v]) => {
                    if (!v || v === 'ALL') return null;
                    const label = CREDENTIAL_FIELD_CONFIG.find(c => c.key === k)?.shortCode || k;
                    return (
                      <span key={k} className="inline-flex items-center gap-1 rounded-md bg-sky-950 px-2 py-0.5 text-[11px] font-bold text-sky-200 border border-sky-700">
                        <span>{label}: {v}</span>
                        <button type="button" onClick={() => setCredentialFieldFilters(prev => ({ ...prev, [k]: 'ALL' }))} className="hover:text-white cursor-pointer"><X className="h-3 w-3" /></button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Credential Status Color-Coding Legend & Horizontal Scroll Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#091530] border-b border-blue-900/60 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white">Live Verification Status:</span>
                  <span className="font-bold text-sky-300 bg-blue-950 px-2.5 py-0.5 rounded border border-blue-800">
                    Cycle: {fortnightLabel}
                  </span>
                </div>

                {/* Direct Horizontal Table Navigation Buttons for Non-Touch Screens */}
                <div className="flex items-center gap-1 bg-[#060e20] px-2 py-0.5 rounded-xl border border-sky-800/70 shadow-inner">
                  <span className="text-[10px] font-black text-sky-300 uppercase tracking-wider hidden sm:inline mr-0.5">Scroll:</span>
                  <button
                    type="button"
                    onClick={() => scrollMasterTable('left')}
                    title="Scroll table left across columns"
                    className="flex items-center gap-0.5 rounded-lg bg-sky-950 hover:bg-sky-500 hover:text-slate-950 text-sky-200 px-2 py-0.5 text-[11px] font-black cursor-pointer border border-sky-700/80 transition-all active:scale-95 shadow-2xs"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    <span>Left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollMasterTable('right')}
                    title="Scroll table right across columns"
                    className="flex items-center gap-0.5 rounded-lg bg-sky-950 hover:bg-sky-500 hover:text-slate-950 text-sky-200 px-2 py-0.5 text-[11px] font-black cursor-pointer border border-sky-700/80 transition-all active:scale-95 shadow-2xs"
                  >
                    <span>Right</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-600 text-white shadow-2xs">
                    GREEN
                  </span>
                  <span className="text-slate-200 font-bold">Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white shadow-2xs">
                    RED
                  </span>
                  <span className="text-slate-200 font-bold">Change Requested</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-yellow-400 text-black shadow-2xs">
                    YELLOW
                  </span>
                  <span className="text-slate-200 font-bold">Not Confirmed</span>
                </div>
              </div>
            </div>

            {loadingMaster ? (
              <div className="py-16 text-center text-sm text-slate-300">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent mx-auto mb-2" />
                <span>Loading master records in CSV import order...</span>
              </div>
            ) : filteredMasterStaff.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-300 space-y-3">
                <Database className="h-8 w-8 text-slate-500 mx-auto" />
                <p className="font-bold text-white">
                  {masterStaffList.length === 0
                    ? 'Master database is currently empty. Upload a CSV / PDF file above to import staff credentials.'
                    : 'No staff records match your search and filter criteria.'}
                </p>
                {activeCredentialFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllMasterFilters}
                    className="darkblue-btn-secondary text-xs px-3.5 py-1.5 rounded-xl cursor-pointer"
                  >
                    Reset All Filters ({masterStaffList.length} Total Records)
                  </button>
                )}
              </div>
            ) : (
              <div ref={masterTableScrollRef} className="overflow-x-auto max-h-[620px] w-full border-t border-blue-900/60 scroll-smooth">
                <table className="w-full text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-[#0b1b3d] text-white sticky top-0 border-b border-blue-900/80 z-20 font-black">
                    <tr>
                      {/* Frozen Pane Column 1: Staff Name (30% less wide: ~130px on desktop, ~85px on mobile, with Freeze Pane & Scroll Controls) */}
                      <th className="py-2 px-1.5 sm:py-2.5 sm:px-2.5 font-black sticky left-0 top-0 z-30 bg-[#0d2047] w-[85px] min-w-[85px] max-w-[105px] sm:w-[130px] sm:min-w-[130px] sm:max-w-[145px] border-b border-r border-blue-900/80 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.5)] text-[11px] sm:text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">Name</span>
                          {/* Scroll Left & Scroll Right Quick Controls on top of Name */}
                          <div className="flex items-center gap-0.5 shrink-0" title="Scroll columns horizontally">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                scrollMasterTable('left');
                              }}
                              title="Scroll Table Left"
                              className="p-1 rounded bg-[#07122a] hover:bg-sky-400 hover:text-slate-950 text-sky-300 border border-sky-800/80 cursor-pointer transition-colors shadow-2xs"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                scrollMasterTable('right');
                              }}
                              title="Scroll Table Right"
                              className="p-1 rounded bg-[#07122a] hover:bg-sky-400 hover:text-slate-950 text-sky-300 border border-sky-800/80 cursor-pointer transition-colors shadow-2xs"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </th>

                      {/* Column 2: U-Number */}
                      <th className="py-2 px-1.5 sm:py-2.5 sm:px-3 font-black text-center sm:text-left sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs w-[68px] min-w-[68px] sm:w-24 sm:min-w-[95px]">
                        <span className="sm:hidden">U-No</span>
                        <span className="hidden sm:inline">U-Number</span>
                      </th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">EX-No (ALS)</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">CUTE</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">ONE RES</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">Altea LH</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">LOOK</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">EBASE</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">LMS</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">MesWeb</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">MesWeb Internet</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">WorldTrac</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">SBH</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">DASGO</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">M365</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">LH Altea FM</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">LX Altea FM</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">FLOAT</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">FLOAT Bac</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">PKI</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs" title="Turnaround companion App (Codes: Y, MOD, ALS)">
                        Turnaround App (TAC)
                      </th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-center sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">EMM</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-black text-right sticky top-0 z-10 bg-[#0b1b3d] border-b border-blue-900/80 whitespace-nowrap text-[11px] sm:text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-950/80 bg-[#070e20]">
                    {filteredMasterStaff.map(staff => {
                      const isAls = isUserAls(staff.credentials, staff.exNumber);
                      return (
                        <tr key={staff.id || staff.uNumber} className="group hover:bg-blue-950/40 transition-colors">
                          {/* Frozen Pane Column 1: Staff Name (30% less wide) */}
                          <td className="py-2 px-1.5 sm:px-2.5 font-bold text-white sticky left-0 z-10 bg-[#091530] group-hover:bg-[#0c1c42] w-[85px] min-w-[85px] max-w-[105px] sm:w-[130px] sm:min-w-[130px] sm:max-w-[145px] border-b border-r border-blue-900/80 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.5)]">
                            <span className="truncate block text-[11px] sm:text-xs font-bold" title={staff.name}>
                              {staff.name}
                            </span>
                          </td>
                          {/* Column 2: U-Number */}
                          <td className="py-2 px-1.5 sm:px-3 font-mono font-black text-sky-300 whitespace-nowrap text-center sm:text-left border-b border-blue-950/80 text-[11px] sm:text-xs tracking-tight">
                            {staff.uNumber}
                          </td>
                          <td className="py-2 px-2 sm:px-3 font-mono text-slate-300 whitespace-nowrap text-center border-b border-blue-950/80 text-[11px] sm:text-xs">
                            {isAls ? (
                              <span className="font-bold text-purple-300">{staff.exNumber || 'N/A'}</span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'cuteAccess', staff.credentials.cuteAccess || 'Y')}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'oneRes', staff.credentials.oneRes)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'alteaLhc', staff.credentials.alteaLhc)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'look', staff.credentials.look)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'ebase', staff.credentials.ebase)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'lms', staff.credentials.lms)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'mesWeb', staff.credentials.mesWeb)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'mesWebIn', staff.credentials.mesWebIn)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'worldTracer', staff.credentials.worldTracer)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'sbh', staff.credentials.sbh)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'dasgo', staff.credentials.dasgo)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'ms365', staff.credentials.ms365)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'lhalteaF', staff.credentials.lhalteaF)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'lxAlteaF', staff.credentials.lxAlteaF)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'float', staff.credentials.float)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'floatBac', staff.credentials.floatBac)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'pki', staff.credentials.pki)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center whitespace-nowrap border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'tac', staff.credentials.tac)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-center border-b border-blue-950/80">
                            {renderRegistryCredentialBadge(staff.uNumber, 'emm', staff.credentials.emm)}
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-right whitespace-nowrap border-b border-blue-950/80">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingStaff(staff)}
                                title="Edit credentials"
                                className="p-1.5 rounded-lg text-sky-400 hover:bg-blue-900/50 hover:text-white cursor-pointer"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaffRecord(staff.uNumber)}
                                title="Delete record"
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/50 hover:text-rose-200 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl darkblue-card p-6 shadow-2xl my-8 border border-blue-500/40">
            <div className="flex items-start justify-between border-b border-blue-900/60 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-sky-300">
                  {selectedSubmission.id}
                </span>
                <h2 className="text-xl font-black text-white">
                  Submission Audit Details: {selectedSubmission.name}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  U-Number: <span className="font-mono font-black text-white">{selectedSubmission.uNumber}</span>
                  {((selectedSubmission.exNumber && selectedSubmission.exNumber !== 'N/A') ||
                    selectedSubmission.verifications.some(v => v.fieldKey === 'tac' && v.currentValue?.toUpperCase().includes('ALS'))) && (
                    <> · EX-Number (ALS): <span className="font-mono font-bold text-white">{selectedSubmission.exNumber}</span></>
                  )} · Date: <span className="text-white font-bold">{selectedSubmission.verificationDate}</span> · Cycle: <span className="text-sky-200 font-bold">{selectedSubmission.fortnightLabel}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-900/50 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Status Summary Banner */}
            <div
              className={`my-4 rounded-xl p-3.5 text-xs flex items-center justify-between border ${
                selectedSubmission.hasChangeRequests
                  ? 'border-amber-500/50 bg-amber-950/40 text-amber-200'
                  : 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {selectedSubmission.hasChangeRequests ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                <span className="font-black">
                  {selectedSubmission.hasChangeRequests
                    ? `${selectedSubmission.changeRequestCount} Change Request(s) flagged for IT Action`
                    : 'All Active Credentials Confirmed Working'}
                </span>
              </div>
              <span className="font-bold">
                {selectedSubmission.confirmedCount} Confirmed · {selectedSubmission.changeRequestCount} Changes Requested
              </span>
            </div>

            {/* Credentials breakdown table */}
            <div className="overflow-x-auto max-h-96 rounded-2xl border border-blue-900/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0b1b3d] text-white border-b border-blue-900/80 font-black">
                  <tr>
                    <th className="py-2.5 px-3 font-black">Credential Field</th>
                    <th className="py-2.5 px-3 font-black">Master Value</th>
                    <th className="py-2.5 px-3 font-black">Status</th>
                    <th className="py-2.5 px-3 font-black">Staff Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-950/80 bg-[#070e20]">
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
                    <tr key={i} className="hover:bg-blue-950/40">
                      <td className="py-2.5 px-3 font-bold text-white">
                        {v.fieldLabel.replace(/ALTEA LHC/gi, 'Altea LH').replace(/MS365/gi, 'M365')}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-sky-300">
                        {formatCredentialDisplay(v.fieldKey, v.currentValue)}
                      </td>
                      <td className="py-2.5 px-3">
                        {v.status === 'CONFIRMED' ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="text-amber-400 font-black flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                            Change Requested
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">
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
              <div className="mt-4 rounded-xl bg-[#08142c] p-3.5 text-xs border border-blue-900/60">
                <span className="font-extrabold text-white">Overall Remark:</span>
                <p className="mt-1 text-slate-200 italic">{selectedSubmission.overallRemarks}</p>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="darkblue-btn-primary px-5 py-2 text-xs font-black cursor-pointer"
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

      {/* CONFIRMATION POPUP: Delete Entire Master Database Modal */}
      {isDeleteDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-red-500/80 bg-[#0a1226] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-red-600/20 blur-3xl" />
            
            <div className="flex items-center gap-3.5 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/90 border border-red-500/60 shadow-inner shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Delete Entire Database</h3>
                <p className="text-xs text-red-300 font-bold">Master Credentials Registry Purge</p>
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/40 bg-red-950/60 p-4 sm:p-5 mb-5 shadow-inner">
              <p className="text-sm font-black text-white leading-relaxed text-center">
                Are you sure you want to delete entire Database? All existing data will be lost!
              </p>
              <p className="mt-2.5 text-xs text-red-200 text-center font-medium">
                This will delete all {masterStaffList.length} active staff credential profiles currently stored in the database so you can perform a clean re-import from PDF / CSV.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-blue-900/60">
              <button
                type="button"
                disabled={isDeletingAllDb}
                onClick={() => setIsDeleteDbModalOpen(false)}
                className="darkblue-btn-secondary px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAllDb}
                onClick={handleDeleteEntireDatabase}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 px-5 py-2.5 text-xs font-black text-white active:scale-95 transition-all shadow-[0_4px_14px_rgba(239,68,68,0.4)] cursor-pointer disabled:opacity-50"
              >
                {isDeletingAllDb ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Purging Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 text-white" />
                    <span>Yes, Delete Entire Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl darkblue-card p-6 sm:p-8 shadow-2xl border border-blue-500/40 my-8">
        <div className="flex items-center justify-between border-b border-blue-900/60 pb-3">
          <h2 className="text-lg font-black text-white">
            {isNew ? 'Add New Staff Record' : `Edit Master Record: ${initialRecord.uNumber}`}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-black text-white mb-1">
                U-Number *
              </label>
              <input
                type="text"
                required
                value={uNumber}
                onChange={e => setUNumber(e.target.value.toUpperCase())}
                placeholder="e.g. U194283"
                className="w-full rounded-xl border-2 border-blue-900/60 bg-[#071024] px-3 py-2 text-xs font-mono font-bold uppercase text-white shadow-inner focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-white mb-1">
                Staff Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value.toUpperCase())}
                placeholder="e.g. RAKESH PARMAR"
                className="w-full rounded-xl border-2 border-blue-900/60 bg-[#071024] px-3 py-2 text-xs font-bold uppercase text-white shadow-inner focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-white mb-1">
                EX-Number
              </label>
              <input
                type="text"
                value={exNumber}
                onChange={e => setExNumber(e.target.value)}
                placeholder="e.g. EX855733 or N/A"
                className="w-full rounded-xl border-2 border-blue-900/60 bg-[#071024] px-3 py-2 text-xs font-bold text-white shadow-inner focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-sky-300 mb-2">
              System Credential Values
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto p-1">
              {CREDENTIAL_FIELD_CONFIG.map(cfg => (
                <div key={cfg.key} className="rounded-xl border border-blue-900/60 bg-[#071024] p-2.5 text-xs">
                  <span className="block font-black text-white truncate" title={cfg.label}>
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
                            className="rounded-md bg-blue-950 px-1.5 py-0.5 text-[10px] font-bold text-sky-200 hover:bg-blue-900 border border-blue-800"
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
                        className="mt-1 w-full rounded-lg border border-blue-900/60 bg-[#050b18] px-2 py-1 text-xs font-mono font-bold text-white focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={credentials[cfg.key] || ''}
                      onChange={e => handleCredChange(cfg.key, e.target.value)}
                      placeholder="e.g. Y, N, SUP"
                      className="mt-1 w-full rounded-lg border border-blue-900/60 bg-[#050b18] px-2 py-1 text-xs font-mono font-bold text-white focus:border-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-blue-900/60">
            <button
              type="button"
              onClick={onClose}
              className="darkblue-btn-secondary px-4 py-2 text-xs font-bold cursor-pointer rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="darkblue-btn-primary px-5 py-2 text-xs font-black cursor-pointer rounded-xl"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
