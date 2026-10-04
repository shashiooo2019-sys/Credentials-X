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

/**
 * Sanitize document IDs for Firestore:
 * Firestore document references must not contain slashes ('/') which create invalid path segments.
 * Document ID must match ^[a-zA-Z0-9_-]+$
 */
export function sanitizeDocId(id: string | undefined | null): string {
  if (!id || typeof id !== 'string') {
    return `STAFF_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
  }
  // Replace slashes, spaces, parentheses, brackets, and any non-alphanumeric chars with underscore
  let clean = id.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!clean) {
    return `STAFF_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
  }
  return clean.toUpperCase();
}

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
    // If local master file exists and has empty array, user explicitly cleared it
    let localFileExplicitlyEmpty = false;
    if (fs.existsSync(MASTER_FILE)) {
      try {
        const content = fs.readFileSync(MASTER_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length === 0) {
          localFileExplicitlyEmpty = true;
          memoryMasterCredentials = [];
        }
      } catch {}
    }

    const masterCol = collection(db, 'master_credentials');
    const masterSnap = await getDocs(masterCol);

    if (masterSnap.empty && !localFileExplicitlyEmpty) {
      console.log("Bootstrapping INITIAL_MASTER_CREDENTIALS to Firebase Firestore...");
      const batch = writeBatch(db);
      for (const rec of INITIAL_MASTER_CREDENTIALS) {
        const safeId = sanitizeDocId(rec.id || rec.uNumber);
        const docRef = doc(db, 'master_credentials', safeId);
        batch.set(docRef, {
          ...rec,
          id: safeId,
          uNumber: rec.uNumber.trim().toUpperCase(),
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
        const safeSubId = sanitizeDocId(sub.id);
        const docRef = doc(db, 'submissions', safeSubId);
        batch.set(docRef, { ...sub, id: safeSubId });
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
        const safeId = sanitizeDocId(data.id || d.id);
        list.push({
          ...data,
          id: safeId,
          uNumber: data.uNumber || safeId,
          orderIndex: data.orderIndex !== undefined ? data.orderIndex : list.length,
          credentials: {
            ...data.credentials,
            cuteAccess: data.credentials?.cuteAccess || 'Y'
          }
        });
      });

      // Sort by original file orderIndex
      list.sort((a, b) => (a.orderIndex ?? 999999) - (b.orderIndex ?? 999999));

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
        parsed.sort((a, b) => (a.orderIndex ?? 999999) - (b.orderIndex ?? 999999));
        memoryMasterCredentials = parsed;
        return parsed;
      }
    }
  } catch {}

  memoryMasterCredentials.sort((a, b) => (a.orderIndex ?? 999999) - (b.orderIndex ?? 999999));
  return memoryMasterCredentials;
}

/**
 * Save master credentials dataset to Firebase Firestore
 */
export async function saveMasterCredentials(data: UserCredentialRecord[]): Promise<boolean> {
  const safeData = data.map((r, idx) => {
    const rawUNum = (r.uNumber || r.id || `STAFF_${idx + 1}`).trim().toUpperCase();
    const safeId = sanitizeDocId(r.id || rawUNum);
    return {
      ...r,
      id: safeId,
      uNumber: rawUNum,
      name: (r.name || 'UNKNOWN').trim().toUpperCase(),
      exNumber: r.exNumber || 'N/A',
      orderIndex: r.orderIndex !== undefined ? r.orderIndex : idx,
      credentials: {
        ...r.credentials,
        cuteAccess: r.credentials?.cuteAccess || 'Y'
      },
      updatedAt: new Date().toISOString()
    };
  });

  safeData.sort((a, b) => (a.orderIndex ?? 999999) - (b.orderIndex ?? 999999));
  memoryMasterCredentials = safeData;
  try {
    fs.writeFileSync(MASTER_FILE, JSON.stringify(safeData, null, 2), 'utf-8');
  } catch {}

  try {
    // Write all records to Firestore in chunks of up to 400
    const chunkSize = 400;
    for (let i = 0; i < safeData.length; i += chunkSize) {
      const chunk = safeData.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(rec => {
        const docRef = doc(db, 'master_credentials', rec.id);
        batch.set(docRef, rec, { merge: true });
      });
      await batch.commit();
    }
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
  const rawUNum = (record.uNumber || record.id || `STAFF_${Date.now()}`).trim().toUpperCase();
  const safeId = sanitizeDocId(record.id || rawUNum);
  const safeRecord: UserCredentialRecord = {
    ...record,
    id: safeId,
    uNumber: rawUNum,
    name: (record.name || 'UNKNOWN').trim().toUpperCase(),
    exNumber: record.exNumber || 'N/A',
    credentials: {
      ...record.credentials,
      cuteAccess: record.credentials?.cuteAccess || 'Y'
    },
    updatedAt: new Date().toISOString()
  };

  try {
    const docRef = doc(db, 'master_credentials', safeId);
    await setDoc(docRef, safeRecord, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `master_credentials/${safeId}`);
  }

  // Update memory cache
  const idx = memoryMasterCredentials.findIndex(
    s => s.id === safeId || s.uNumber.trim().toUpperCase() === rawUNum
  );
  if (idx >= 0) {
    memoryMasterCredentials[idx] = safeRecord;
  } else {
    memoryMasterCredentials.unshift(safeRecord);
  }

  try {
    fs.writeFileSync(MASTER_FILE, JSON.stringify(memoryMasterCredentials, null, 2), 'utf-8');
  } catch {}

  return safeRecord;
}

/**
 * Delete a staff record from Firebase Firestore
 */
export async function deleteStaffRecord(uNumberOrId: string): Promise<boolean> {
  const norm = uNumberOrId.trim().toUpperCase();
  const safeId = sanitizeDocId(norm);

  const existing = memoryMasterCredentials.find(
    s => s.id === norm || s.id === safeId || s.uNumber.trim().toUpperCase() === norm
  );
  const docIdToDelete = existing?.id || safeId;

  try {
    const docRef = doc(db, 'master_credentials', docIdToDelete);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `master_credentials/${docIdToDelete}`);
  }

  memoryMasterCredentials = memoryMasterCredentials.filter(
    s => s.id !== docIdToDelete && s.uNumber.trim().toUpperCase() !== norm
  );
  try {
    fs.writeFileSync(MASTER_FILE, JSON.stringify(memoryMasterCredentials, null, 2), 'utf-8');
  } catch {}

  return true;
}

/**
 * Delete entire Master Credentials Registry from Firebase Firestore and local memory
 */
export async function clearAllMasterCredentials(): Promise<{ success: boolean; deletedCount: number }> {
  let count = memoryMasterCredentials.length;
  try {
    const masterCol = collection(db, 'master_credentials');
    const snap = await getDocs(masterCol);
    if (!snap.empty) {
      count = Math.max(count, snap.size);
      const docs = snap.docs;
      const chunkSize = 400;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn("Notice during clearing Firestore master credentials:", err);
  }

  isFirebaseInitialized = true;
  memoryMasterCredentials = [];
  try {
    fs.writeFileSync(MASTER_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch {}

  return { success: true, deletedCount: count };
}

/**
 * Upsert records: overwrites existing credentials for matching U-number, and adds new U-numbers to Firebase
 */
export async function upsertMasterCredentials(incomingRecords: UserCredentialRecord[]): Promise<{ updatedCount: number; addedCount: number; totalCount: number }> {
  const current = await getMasterCredentials();
  let updatedCount = 0;
  let addedCount = 0;

  const recordsToCommit: UserCredentialRecord[] = [];

  incomingRecords.forEach((newRec, idx) => {
    const rawUNum = (newRec.uNumber || newRec.id || `STAFF_${idx + 1}`).trim().toUpperCase();
    if (!rawUNum) return;

    const safeId = sanitizeDocId(newRec.id || rawUNum);
    const existingIndex = current.findIndex(
      s => s.id === safeId || s.uNumber.trim().toUpperCase() === rawUNum
    );

    const safeCreds = {
      ...newRec.credentials,
      cuteAccess: newRec.credentials?.cuteAccess || 'Y'
    };

    let updatedRecord: UserCredentialRecord;

    if (existingIndex >= 0) {
      updatedRecord = {
        ...current[existingIndex],
        id: current[existingIndex].id || safeId,
        uNumber: rawUNum,
        name: newRec.name ? newRec.name.trim().toUpperCase() : current[existingIndex].name,
        exNumber: newRec.exNumber && newRec.exNumber !== 'N/A' ? newRec.exNumber : current[existingIndex].exNumber,
        orderIndex: current[existingIndex].orderIndex !== undefined ? current[existingIndex].orderIndex : (newRec.orderIndex ?? idx),
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
        id: safeId,
        uNumber: rawUNum,
        exNumber: newRec.exNumber || 'N/A',
        name: (newRec.name || 'UNKNOWN').trim().toUpperCase(),
        orderIndex: newRec.orderIndex !== undefined ? newRec.orderIndex : (current.length + idx),
        credentials: safeCreds,
        updatedAt: new Date().toISOString()
      };
      current.push(updatedRecord);
      addedCount++;
    }

    recordsToCommit.push(updatedRecord);
  });

  try {
    const chunkSize = 400;
    for (let i = 0; i < recordsToCommit.length; i += chunkSize) {
      const chunk = recordsToCommit.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(rec => {
        const docRef = doc(db, 'master_credentials', rec.id);
        batch.set(docRef, rec, { merge: true });
      });
      await batch.commit();
    }
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
  const safeId = sanitizeDocId(normUNum);
  const current = await getMasterCredentials();
  const existing = current.find(s => s.id === safeId || s.uNumber.trim().toUpperCase() === normUNum);

  if (existing) {
    if (name.trim()) existing.name = name.trim().toUpperCase();
    if (exNumber && exNumber !== 'N/A') existing.exNumber = exNumber.trim();
    await saveSingleMasterRecord(existing);
    return existing;
  }

  const newStaff: UserCredentialRecord = {
    id: safeId,
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
        const safeSubId = sanitizeDocId(data.id || d.id);
        list.push({
          ...data,
          id: safeSubId
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
  const safeId = sanitizeDocId(submission.id);
  const safeSubmission: SubmissionRecord = {
    ...submission,
    id: safeId
  };
  const docRef = doc(db, 'submissions', safeId);

  try {
    await setDoc(docRef, safeSubmission, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `submissions/${safeId}`);
  }

  const current = memorySubmissions;
  const existingIdx = current.findIndex(
    s => s.id === safeId || (s.uNumber.toLowerCase() === submission.uNumber.toLowerCase() && s.fortnightPeriod === submission.fortnightPeriod)
  );

  if (existingIdx >= 0) {
    current[existingIdx] = safeSubmission;
  } else {
    current.unshift(safeSubmission);
  }

  memorySubmissions = current;
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch {}

  return safeSubmission;
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
  const safeId = sanitizeDocId(normalized);
  const list = await getMasterCredentials();
  
  return list.find(s => {
    const sUNum = s.uNumber?.trim().toUpperCase();
    const sId = s.id?.trim().toUpperCase();
    if (sUNum === normalized || sId === safeId || sId === normalized) return true;
    if (sUNum === `U${normalized}` || sUNum === normalized.replace(/^U/, '')) return true;
    if (s.name?.trim().toUpperCase() === normalized) return true;
    return false;
  }) || null;
}
