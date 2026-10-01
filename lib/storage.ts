import fs from 'fs';
import path from 'path';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { INITIAL_MASTER_CREDENTIALS } from './initial-data';
import { UserCredentialRecord, SubmissionRecord } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const MASTER_FILE = path.join(DATA_DIR, 'master_credentials.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

// In-memory cache fallback for fast response & resilience
let memoryMasterCredentials: UserCredentialRecord[] = [...INITIAL_MASTER_CREDENTIALS];
let memorySubmissions: SubmissionRecord[] = [];
let isFirebaseInitialized = false;

// Seed sample past submissions
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

function ensureLocalCache() {
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
    console.warn("Local cache notice:", err);
  }
}

ensureLocalCache();

/**
 * Sync initial master credentials and seed submissions to Firebase Firestore if not yet populated
 */
async function initializeFirebaseDataIfNeeded() {
  if (isFirebaseInitialized) return;
  try {
    const masterCol = collection(db, 'master_credentials');
    const masterSnap = await getDocs(masterCol);

    if (masterSnap.empty) {
      console.log("Bootstrapping INITIAL_MASTER_CREDENTIALS to Firebase Firestore...");
      const batch = writeBatch(db);
      // Chunk into batches of up to 450 items
      for (const rec of INITIAL_MASTER_CREDENTIALS) {
        const docRef = doc(db, 'master_credentials', rec.uNumber.trim().toUpperCase());
        batch.set(docRef, {
          ...rec,
          id: rec.uNumber.trim().toUpperCase(),
          credentials: {
            ...rec.credentials,
            cuteAccess: rec.credentials.cuteAccess || 'Y'
          },
          updatedAt: new Date().toISOString()
        });
      }
      await batch.commit();
      console.log(`Successfully bootstrapped ${INITIAL_MASTER_CREDENTIALS.length} records to Firebase!`);
    }

    const subCol = collection(db, 'submissions');
    const subSnap = await getDocs(subCol);
    if (subSnap.empty && memorySubmissions.length > 0) {
      const batch = writeBatch(db);
      for (const sub of memorySubmissions) {
        const docRef = doc(db, 'submissions', sub.id);
        batch.set(docRef, sub);
      }
      await batch.commit();
      console.log("Successfully seeded initial submissions to Firebase!");
    }

    isFirebaseInitialized = true;
  } catch (err) {
    console.warn("Notice during Firebase initialization check:", err);
  }
}

/**
 * Retrieve master credentials directly from Firebase Firestore
 */
export async function getMasterCredentials(): Promise<UserCredentialRecord[]> {
  try {
    await initializeFirebaseDataIfNeeded();
    const masterCol = collection(db, 'master_credentials');
    const snap = await getDocs(masterCol);

    if (!snap.empty) {
      const list: UserCredentialRecord[] = [];
      snap.forEach(d => {
        const data = d.data() as UserCredentialRecord;
        list.push({
          ...data,
          id: data.id || d.id,
          uNumber: data.uNumber || d.id,
          credentials: {
            ...data.credentials,
            cuteAccess: data.credentials?.cuteAccess || 'Y'
          }
        });
      });

      // Update memory cache
      memoryMasterCredentials = list;
      try {
        fs.writeFileSync(MASTER_FILE, JSON.stringify(list, null, 2), 'utf-8');
      } catch {}
      return list;
    }
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'master_credentials');
    } catch {
      console.warn("Using local cache fallback for master credentials:", err);
    }
  }

  // Fallback to local file / memory
  try {
    if (fs.existsSync(MASTER_FILE)) {
      const content = fs.readFileSync(MASTER_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryMasterCredentials = parsed;
        return parsed;
      }
    }
  } catch {}

  return memoryMasterCredentials;
}

/**
 * Save master credentials dataset to Firebase Firestore
 */
export async function saveMasterCredentials(data: UserCredentialRecord[]): Promise<boolean> {
  const safeData = data.map(r => ({
    ...r,
    id: r.uNumber.trim().toUpperCase(),
    uNumber: r.uNumber.trim().toUpperCase(),
    credentials: {
      ...r.credentials,
      cuteAccess: r.credentials?.cuteAccess || 'Y'
    },
    updatedAt: new Date().toISOString()
  }));

  memoryMasterCredentials = safeData;
  try {
    fs.writeFileSync(MASTER_FILE, JSON.stringify(safeData, null, 2), 'utf-8');
  } catch {}

  try {
    // Write all records to Firestore
    const batch = writeBatch(db);
    safeData.forEach(rec => {
      const docRef = doc(db, 'master_credentials', rec.uNumber);
      batch.set(docRef, rec, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'master_credentials');
    return false;
  }
}

/**
 * Save single staff master record to Firebase Firestore
 */
export async function saveSingleMasterRecord(record: UserCredentialRecord): Promise<UserCredentialRecord> {
  const normUNum = record.uNumber.trim().toUpperCase();
  const safeRecord: UserCredentialRecord = {
    ...record,
    id: normUNum,
    uNumber: normUNum,
    name: record.name.trim().toUpperCase(),
    exNumber: record.exNumber || 'N/A',
    credentials: {
      ...record.credentials,
      cuteAccess: record.credentials?.cuteAccess || 'Y'
    },
    updatedAt: new Date().toISOString()
  };

  try {
    const docRef = doc(db, 'master_credentials', normUNum);
    await setDoc(docRef, safeRecord, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `master_credentials/${normUNum}`);
  }

  // Update memory cache
  const idx = memoryMasterCredentials.findIndex(s => s.uNumber.trim().toUpperCase() === normUNum);
  if (idx >= 0) {
    memoryMasterCredentials[idx] = safeRecord;
  } else {
    memoryMasterCredentials.unshift(safeRecord);
  }

  return safeRecord;
}

/**
 * Delete a staff record from Firebase Firestore
 */
export async function deleteStaffRecord(uNumber: string): Promise<boolean> {
  const normUNum = uNumber.trim().toUpperCase();
  try {
    const docRef = doc(db, 'master_credentials', normUNum);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `master_credentials/${normUNum}`);
  }

  memoryMasterCredentials = memoryMasterCredentials.filter(s => s.uNumber.trim().toUpperCase() !== normUNum);
  try {
    fs.writeFileSync(MASTER_FILE, JSON.stringify(memoryMasterCredentials, null, 2), 'utf-8');
  } catch {}

  return true;
}

/**
 * Upsert records: overwrites existing credentials for matching U-number, and adds new U-numbers to Firebase
 */
export async function upsertMasterCredentials(incomingRecords: UserCredentialRecord[]): Promise<{ updatedCount: number; addedCount: number; totalCount: number }> {
  const current = await getMasterCredentials();
  let updatedCount = 0;
  let addedCount = 0;

  const batch = writeBatch(db);

  incomingRecords.forEach(newRec => {
    if (!newRec.uNumber) return;
    const normUNum = newRec.uNumber.trim().toUpperCase();
    const existingIndex = current.findIndex(s => s.uNumber.trim().toUpperCase() === normUNum);

    const safeCreds = {
      ...newRec.credentials,
      cuteAccess: newRec.credentials?.cuteAccess || 'Y'
    };

    let updatedRecord: UserCredentialRecord;

    if (existingIndex >= 0) {
      updatedRecord = {
        ...current[existingIndex],
        name: newRec.name || current[existingIndex].name,
        exNumber: newRec.exNumber && newRec.exNumber !== 'N/A' ? newRec.exNumber : current[existingIndex].exNumber,
        credentials: {
          ...current[existingIndex].credentials,
          ...safeCreds
        },
        updatedAt: new Date().toISOString()
      };
      current[existingIndex] = updatedRecord;
      updatedCount++;
    } else {
      updatedRecord = {
        id: normUNum,
        uNumber: normUNum,
        exNumber: newRec.exNumber || 'N/A',
        name: newRec.name || 'UNKNOWN',
        credentials: safeCreds,
        updatedAt: new Date().toISOString()
      };
      current.push(updatedRecord);
      addedCount++;
    }

    const docRef = doc(db, 'master_credentials', normUNum);
    batch.set(docRef, updatedRecord, { merge: true });
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'master_credentials');
  }

  memoryMasterCredentials = current;
  try {
    fs.writeFileSync(MASTER_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch {}

  return { updatedCount, addedCount, totalCount: current.length };
}

/**
 * Register a new staff member dynamically in Firebase Firestore
 */
export async function registerNewStaff(uNumber: string, name: string, exNumber: string = 'N/A'): Promise<UserCredentialRecord> {
  const normUNum = uNumber.trim().toUpperCase();
  const current = await getMasterCredentials();
  const existing = current.find(s => s.uNumber.trim().toUpperCase() === normUNum);

  if (existing) {
    if (name.trim()) existing.name = name.trim().toUpperCase();
    if (exNumber && exNumber !== 'N/A') existing.exNumber = exNumber.trim();
    await saveSingleMasterRecord(existing);
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

  await saveSingleMasterRecord(newStaff);
  return newStaff;
}

/**
 * Retrieve submissions from Firebase Firestore
 */
export async function getSubmissions(): Promise<SubmissionRecord[]> {
  try {
    await initializeFirebaseDataIfNeeded();
    const subCol = collection(db, 'submissions');
    const snap = await getDocs(subCol);

    if (!snap.empty) {
      const list: SubmissionRecord[] = [];
      snap.forEach(d => {
        const data = d.data() as SubmissionRecord;
        list.push({
          ...data,
          id: data.id || d.id
        });
      });

      // Sort by submittedAt descending
      list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

      memorySubmissions = list;
      try {
        fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
      } catch {}
      return list;
    }
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'submissions');
    } catch {
      console.warn("Using local cache fallback for submissions:", err);
    }
  }

  return memorySubmissions;
}

/**
 * Save a single submission to Firebase Firestore
 */
export async function saveSubmission(submission: SubmissionRecord): Promise<SubmissionRecord> {
  const docRef = doc(db, 'submissions', submission.id);

  try {
    await setDoc(docRef, submission);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `submissions/${submission.id}`);
  }

  const current = memorySubmissions;
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
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch {}

  return submission;
}

export function getFortnightPeriod(dateStr: string): { period: string; label: string; fortnightNum: 1 | 2; year: number; month: number } {
  const date = new Date(dateStr);
  const year = isNaN(date.getFullYear()) ? new Date().getFullYear() : date.getFullYear();
  const month = isNaN(date.getMonth()) ? new Date().getMonth() + 1 : date.getMonth() + 1;
  const day = isNaN(date.getDate()) ? new Date().getDate() : date.getDate();

  const fortnightNum: 1 | 2 = day <= 15 ? 1 : 2;
  const mm = String(month).padStart(2, '0');
  const period = `${year}-${mm}-F${fortnightNum}`;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = monthNames[month - 1] || "Month";
  
  const lastDay = new Date(year, month, 0).getDate();
  const label = fortnightNum === 1 ? `1-15 ${monthName} ${year}` : `16-${lastDay} ${monthName} ${year}`;

  return { period, label, fortnightNum, year, month };
}

export async function findStaffByUNumber(uNum: string): Promise<UserCredentialRecord | null> {
  const normalized = uNum.trim().toUpperCase();
  const list = await getMasterCredentials();
  
  return list.find(s => {
    const sUNum = s.uNumber.trim().toUpperCase();
    if (sUNum === normalized) return true;
    if (sUNum === `U${normalized}`) return true;
    if (normalized === `U${sUNum}`) return true;
    return false;
  }) || null;
}
