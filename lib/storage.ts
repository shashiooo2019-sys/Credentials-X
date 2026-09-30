import fs from 'fs';
import path from 'path';
import { INITIAL_MASTER_CREDENTIALS } from './initial-data';
import { UserCredentialRecord, SubmissionRecord, FortnightFilter } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const MASTER_FILE = path.join(DATA_DIR, 'master_credentials.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

// In-memory cache fallback
let memoryMasterCredentials: UserCredentialRecord[] = [...INITIAL_MASTER_CREDENTIALS];
let memorySubmissions: SubmissionRecord[] = [];

// Seed sample past submissions so admin can immediately test the fortnight filters and audits!
function createSeedSubmissions(): SubmissionRecord[] {
  return [
    {
      id: "SUB-20260928-U194283-001",
      uNumber: "U194283",
      exNumber: "EX855733",
      name: "RAKESH PARMAR",
      verificationDate: "2026-09-28",
      submittedAt: "2026-09-28T09:15:22.000Z",
      fortnightPeriod: "2026-09-F2",
      fortnightLabel: "16-30 Sep 2026",
      status: "CONFIRMED",
      hasChangeRequests: false,
      changeRequestCount: 0,
      confirmedCount: 10,
      totalActiveFields: 10,
      verifications: [
        { fieldKey: "cuteAccess", fieldLabel: "CUTE Access", currentValue: "Y", status: "CONFIRMED", remark: "Workstation terminal active" },
        { fieldKey: "alteaLhc", fieldLabel: "Altea LH", currentValue: "SUP", status: "CONFIRMED", remark: "Supervisor profile working as expected" },
        { fieldKey: "look", fieldLabel: "LOOK", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "ebase", fieldLabel: "EBASE", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "lms", fieldLabel: "LMS", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "mesWeb", fieldLabel: "MesWeb", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "worldTracer", fieldLabel: "WorldTracer", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "dasgo", fieldLabel: "DASGO", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "ms365", fieldLabel: "M365", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "tac", fieldLabel: "Turnaround companion App", currentValue: '["MOD"]', status: "CONFIRMED", remark: "" }
      ]
    },
    {
      id: "SUB-20260929-U194317-002",
      uNumber: "U194317",
      exNumber: "EX855755",
      name: "JASPREET MALIK",
      verificationDate: "2026-09-29",
      submittedAt: "2026-09-29T10:42:10.000Z",
      fortnightPeriod: "2026-09-F2",
      fortnightLabel: "16-30 Sep 2026",
      status: "CHANGE_REQUESTED",
      hasChangeRequests: true,
      changeRequestCount: 1,
      confirmedCount: 10,
      totalActiveFields: 11,
      verifications: [
        { fieldKey: "cuteAccess", fieldLabel: "CUTE Access", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "alteaLhc", fieldLabel: "Altea LH", currentValue: "SUP", status: "CONFIRMED", remark: "" },
        { fieldKey: "look", fieldLabel: "LOOK", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "ebase", fieldLabel: "EBASE", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "lms", fieldLabel: "LMS", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "mesWeb", fieldLabel: "MesWeb", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "worldTracer", fieldLabel: "WorldTracer", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "sbh", fieldLabel: "SBH", currentValue: "Y", status: "CHANGE_REQUESTED", remark: "Access expired on Sep 25, cannot login to handle special baggage" },
        { fieldKey: "dasgo", fieldLabel: "DASGO", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "ms365", fieldLabel: "M365", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "tac", fieldLabel: "Turnaround companion App", currentValue: '["MOD"]', status: "CONFIRMED", remark: "" }
      ]
    },
    {
      id: "SUB-20260910-U137790-003",
      uNumber: "U137790",
      exNumber: "EX855737",
      name: "DANISH MANZOOR",
      verificationDate: "2026-09-10",
      submittedAt: "2026-09-10T14:20:00.000Z",
      fortnightPeriod: "2026-09-F1",
      fortnightLabel: "1-15 Sep 2026",
      status: "CONFIRMED",
      hasChangeRequests: false,
      changeRequestCount: 0,
      confirmedCount: 11,
      totalActiveFields: 11,
      verifications: [
        { fieldKey: "cuteAccess", fieldLabel: "CUTE Access", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "oneRes", fieldLabel: "ONE RES", currentValue: "Y", status: "CONFIRMED", remark: "All operational" },
        { fieldKey: "alteaLhc", fieldLabel: "Altea LH", currentValue: "SUP", status: "CONFIRMED", remark: "" },
        { fieldKey: "look", fieldLabel: "LOOK", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "ebase", fieldLabel: "EBASE", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "lms", fieldLabel: "LMS", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "mesWeb", fieldLabel: "MesWeb", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "worldTracer", fieldLabel: "WorldTracer", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "sbh", fieldLabel: "SBH", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "dasgo", fieldLabel: "DASGO", currentValue: "Y", status: "CONFIRMED", remark: "" },
        { fieldKey: "ms365", fieldLabel: "M365", currentValue: "Y", status: "CONFIRMED", remark: "" }
      ]
    }
  ];
}

memorySubmissions = createSeedSubmissions();

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(MASTER_FILE)) {
      fs.writeFileSync(MASTER_FILE, JSON.stringify(INITIAL_MASTER_CREDENTIALS, null, 2), 'utf-8');
    }
    if (!fs.existsSync(SUBMISSIONS_FILE)) {
      fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(memorySubmissions, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn("Storage notice: Directory or file system initialization used memory fallback:", err);
  }
}

ensureDataDir();

export function getMasterCredentials(): UserCredentialRecord[] {
  try {
    if (fs.existsSync(MASTER_FILE)) {
      const content = fs.readFileSync(MASTER_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let modified = false;
        // Ensure default CUTE Access is 'Y' for everyone
        parsed.forEach(r => {
          if (!r.credentials.cuteAccess) {
            r.credentials.cuteAccess = 'Y';
            modified = true;
          }
        });
        if (modified) {
          try {
            fs.writeFileSync(MASTER_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
          } catch {}
        }
        memoryMasterCredentials = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed reading master credentials file, using memory:", err);
  }
  memoryMasterCredentials.forEach(r => {
    if (!r.credentials.cuteAccess) {
      r.credentials.cuteAccess = 'Y';
    }
  });
  return memoryMasterCredentials;
}

export function saveMasterCredentials(data: UserCredentialRecord[]): boolean {
  // Ensure default CUTE Access is 'Y' for everyone
  data.forEach(r => {
    if (!r.credentials.cuteAccess) {
      r.credentials.cuteAccess = 'Y';
    }
  });
  memoryMasterCredentials = data;
  try {
    ensureDataDir();
    fs.writeFileSync(MASTER_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn("Failed writing master credentials to disk, preserved in memory:", err);
    return true;
  }
}

// Upsert records: overwrites existing credentials for matching U-number (no duplicates), and adds new U-numbers
export function upsertMasterCredentials(incomingRecords: UserCredentialRecord[]): { updatedCount: number; addedCount: number; totalCount: number } {
  const current = getMasterCredentials();
  let updatedCount = 0;
  let addedCount = 0;

  incomingRecords.forEach(newRec => {
    if (!newRec.uNumber) return;
    const normUNum = newRec.uNumber.trim().toUpperCase();
    const existingIndex = current.findIndex(s => s.uNumber.trim().toUpperCase() === normUNum);

    const safeCreds = {
      ...newRec.credentials,
      cuteAccess: newRec.credentials?.cuteAccess || 'Y'
    };

    if (existingIndex >= 0) {
      // OVERWRITE existing credentials data for the same U number
      current[existingIndex] = {
        ...current[existingIndex],
        name: newRec.name || current[existingIndex].name,
        exNumber: newRec.exNumber && newRec.exNumber !== 'N/A' ? newRec.exNumber : current[existingIndex].exNumber,
        credentials: {
          ...current[existingIndex].credentials,
          ...safeCreds
        },
        updatedAt: new Date().toISOString()
      };
      updatedCount++;
    } else {
      // ADD new U number record
      current.push({
        id: normUNum,
        uNumber: normUNum,
        exNumber: newRec.exNumber || 'N/A',
        name: newRec.name || 'UNKNOWN',
        credentials: safeCreds,
        updatedAt: new Date().toISOString()
      });
      addedCount++;
    }
  });

  saveMasterCredentials(current);
  return { updatedCount, addedCount, totalCount: current.length };
}

// Register a new staff member dynamically if name does not appear in database
export function registerNewStaff(uNumber: string, name: string, exNumber: string = 'N/A'): UserCredentialRecord {
  const current = getMasterCredentials();
  const normUNum = uNumber.trim().toUpperCase();
  const existing = current.find(s => s.uNumber.trim().toUpperCase() === normUNum);

  if (existing) {
    if (name.trim()) existing.name = name.trim().toUpperCase();
    if (exNumber && exNumber !== 'N/A') existing.exNumber = exNumber.trim();
    saveMasterCredentials(current);
    return existing;
  }

  const newStaff: UserCredentialRecord = {
    id: normUNum,
    uNumber: normUNum,
    exNumber: exNumber.trim() || 'N/A',
    name: name.trim().toUpperCase(),
    credentials: {
      cuteAccess: 'Y',
      oneRes: 'N',
      alteaLhc: 'N',
      look: 'N',
      ebase: 'N',
      lms: 'N',
      mesWeb: 'N',
      mesWebIn: 'N',
      worldTracer: 'N',
      sbh: 'N',
      dasgo: 'N',
      ms365: 'N',
      lhalteaF: 'N',
      lxAlteaF: 'N',
      float: 'N',
      floatBac: 'N',
      pki: 'N',
      tac: '["N"]',
      emm: 'N'
    },
    updatedAt: new Date().toISOString(),
    notes: 'Self-registered by staff during verification'
  };

  current.push(newStaff);
  saveMasterCredentials(current);
  return newStaff;
}

export function getSubmissions(): SubmissionRecord[] {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const content = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        memorySubmissions = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed reading submissions file, using memory:", err);
  }
  return memorySubmissions;
}

export function saveSubmission(submission: SubmissionRecord): SubmissionRecord {
  const current = getSubmissions();
  // If user already submitted for this fortnight, update existing or append
  const existingIdx = current.findIndex(
    s => s.uNumber.toLowerCase() === submission.uNumber.toLowerCase() && s.fortnightPeriod === submission.fortnightPeriod
  );

  if (existingIdx >= 0) {
    current[existingIdx] = submission;
  } else {
    current.unshift(submission);
  }

  memorySubmissions = current;
  try {
    ensureDataDir();
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.warn("Failed writing submissions to disk, preserved in memory:", err);
  }

  return submission;
}

export function getFortnightPeriod(dateStr: string): { period: string; label: string; fortnightNum: 1 | 2; year: number; month: number } {
  // dateStr is YYYY-MM-DD
  const date = new Date(dateStr);
  const year = isNaN(date.getFullYear()) ? new Date().getFullYear() : date.getFullYear();
  const month = isNaN(date.getMonth()) ? new Date().getMonth() + 1 : date.getMonth() + 1;
  const day = isNaN(date.getDate()) ? new Date().getDate() : date.getDate();

  const fortnightNum: 1 | 2 = day <= 15 ? 1 : 2;
  const mm = String(month).padStart(2, '0');
  const period = `${year}-${mm}-F${fortnightNum}`;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = monthNames[month - 1] || "Month";
  
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const label = fortnightNum === 1 ? `1-15 ${monthName} ${year}` : `16-${lastDay} ${monthName} ${year}`;

  return { period, label, fortnightNum, year, month };
}

export function findStaffByUNumber(uNum: string): UserCredentialRecord | null {
  const normalized = uNum.trim().toLowerCase();
  const list = getMasterCredentials();
  
  return list.find(s => {
    const sUNum = s.uNumber.trim().toLowerCase();
    if (sUNum === normalized) return true;
    // Support entering "194283" matching "U194283"
    if (sUNum === `u${normalized}`) return true;
    if (normalized === `u${sUNum}`) return true;
    return false;
  }) || null;
}
