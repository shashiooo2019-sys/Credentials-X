export interface CredentialFields {
  cuteAccess?: string; // CUTE Access (default: 'Y')
  oneRes: string;
  alteaLhc: string; // Altea LH
  alteaLxc?: string; // Omitted from UI
  look: string;
  ebase: string;
  lms: string;
  mesWeb: string;
  mesWebIn: string;
  worldTracer: string;
  wtTablet?: string; // Omitted from UI
  sbh: string;
  dasgo: string;
  ms365: string; // M365
  lhalteaF: string; // ALS only
  lxAlteaF: string; // ALS only
  float: string; // ALS only
  floatBac: string; // ALS only
  pki: string; // M365 users only
  tac: string; // Turnaround companion App (Y, MOD, ALS)
  emm: string;
}

export interface UserCredentialRecord {
  id: string; // usually uNumber
  uNumber: string;
  exNumber: string;
  name: string;
  credentials: CredentialFields;
  updatedAt?: string;
  notes?: string;
}

export type FieldStatus = 'PENDING' | 'CONFIRMED' | 'CHANGE_REQUESTED' | 'NOT_APPLICABLE';

export interface FieldVerification {
  fieldKey: keyof CredentialFields;
  fieldLabel: string;
  currentValue: string;
  status: FieldStatus;
  remark: string; // up to 255 chars
}

export interface SubmissionRecord {
  id: string; // unique submission id e.g. SUB-1727670000000-U194283
  uNumber: string;
  exNumber: string;
  name: string;
  verificationDate: string; // YYYY-MM-DD
  submittedAt: string; // ISO timestamp
  fortnightPeriod: string; // e.g. "2026-09-F2" (16-30 Sep 2026)
  fortnightLabel: string; // "16-30 Sep 2026"
  verifications: FieldVerification[];
  hasChangeRequests: boolean;
  changeRequestCount: number;
  confirmedCount: number;
  totalActiveFields: number;
  overallRemarks?: string;
  status: 'CONFIRMED' | 'CHANGE_REQUESTED';
}

export interface FortnightFilter {
  year: number;
  month: number; // 1-12
  fortnight: 1 | 2; // 1 = 1-15, 2 = 16-end of month
}

export const CREDENTIAL_FIELD_CONFIG: {
  key: keyof CredentialFields;
  label: string;
  shortCode: string;
  description: string;
  category: 'Core Departure & DCS' | 'Operations & Baggage' | 'Workstation & Security';
  alsOnly?: boolean;
  m365Only?: boolean;
}[] = [
  { key: 'cuteAccess', label: 'CUTE Access', shortCode: 'CUTE', description: 'Common Use Terminal Equipment (CUTE) Workstation Access (Default: Y)', category: 'Workstation & Security' },
  { key: 'oneRes', label: 'ONE RES', shortCode: 'ONE RES', description: 'One Res Reservation System Access', category: 'Core Departure & DCS' },
  { key: 'alteaLhc', label: 'Altea LH', shortCode: 'Altea LH', description: 'Amadeus Altea LH Departure Control System (SUP/Y/N)', category: 'Core Departure & DCS' },
  { key: 'look', label: 'LOOK', shortCode: 'LOOK', description: 'LOOK Passenger and PNR Viewing System', category: 'Core Departure & DCS' },
  { key: 'ebase', label: 'EBASE', shortCode: 'EBASE', description: 'EBASE Station and Flight Operations Portal', category: 'Operations & Baggage' },
  { key: 'lms', label: 'LMS', shortCode: 'LMS', description: 'Learning Management System Training Profile', category: 'Workstation & Security' },
  { key: 'mesWeb', label: 'MesWeb', shortCode: 'MesWeb', description: 'MesWeb Internal Operational Messaging', category: 'Operations & Baggage' },
  { key: 'mesWebIn', label: 'MesWeb Internet', shortCode: 'MesWeb In', description: 'MesWeb External Internet Access Portal', category: 'Operations & Baggage' },
  { key: 'worldTracer', label: 'WorldTracer', shortCode: 'WorldTrac', description: 'SITA WorldTracer Baggage Tracing System', category: 'Operations & Baggage' },
  { key: 'sbh', label: 'SBH', shortCode: 'SBH', description: 'Special Baggage Handling System', category: 'Operations & Baggage' },
  { key: 'dasgo', label: 'DASGO', shortCode: 'DASGO', description: 'DASGO Ground Operations Management (Edit/View only/Y)', category: 'Operations & Baggage' },
  { key: 'ms365', label: 'M365', shortCode: 'M365', description: 'Microsoft 365 Enterprise Email & Collaboration', category: 'Workstation & Security' },
  { key: 'lhalteaF', label: 'LH Altea FM', shortCode: 'LH Altea FM', description: 'Lufthansa Altea Flight Management (ALS only)', category: 'Core Departure & DCS', alsOnly: true },
  { key: 'lxAlteaF', label: 'LX Altea FM', shortCode: 'LX Altea FM', description: 'SWISS Altea Flight Management (ALS only)', category: 'Core Departure & DCS', alsOnly: true },
  { key: 'float', label: 'FLOAT', shortCode: 'FLOAT', description: 'FLOAT Operational Terminal Access (ALS only)', category: 'Operations & Baggage', alsOnly: true },
  { key: 'floatBac', label: 'FLOAT Backup', shortCode: 'FLOAT Bac', description: 'FLOAT Emergency Fallback Profile (ALS only)', category: 'Operations & Baggage', alsOnly: true },
  { key: 'pki', label: 'PKI Certificate', shortCode: 'PKI', description: 'Public Key Infrastructure Smartcard/Certificate (M365 users only)', category: 'Workstation & Security', m365Only: true },
  { key: 'tac', label: 'Turnaround companion App', shortCode: 'TAC', description: 'Turnaround companion App (Access codes: Y, MOD, ALS)', category: 'Operations & Baggage' },
  { key: 'emm', label: 'EMM', shortCode: 'EMM', description: 'Enterprise Mobile Management Device Profile', category: 'Workstation & Security' },
];

export function isUserAls(credentials: CredentialFields | undefined | null, exNumber?: string): boolean {
  if (exNumber && exNumber !== 'N/A' && exNumber.trim().length > 0) return true;
  if (!credentials) return false;
  const tac = String(credentials.tac || '').toUpperCase();
  const altea = String(credentials.alteaLhc || '').toUpperCase();
  const lhFm = String(credentials.lhalteaF || '').trim().toUpperCase();
  const lxFm = String(credentials.lxAlteaF || '').trim().toUpperCase();
  const float = String(credentials.float || '').trim().toUpperCase();
  const floatBac = String(credentials.floatBac || '').trim().toUpperCase();

  if (tac.includes('ALS') || altea.includes('ALS')) return true;
  if (lhFm && lhFm !== 'N' && lhFm !== 'N/A' && lhFm !== '["N"]') return true;
  if (lxFm && lxFm !== 'N' && lxFm !== 'N/A' && lxFm !== '["N"]') return true;
  if (float && float !== 'N' && float !== 'N/A' && float !== '["N"]') return true;
  if (floatBac && floatBac !== 'N' && floatBac !== 'N/A' && floatBac !== '["N"]') return true;
  return false;
}

export function isUserM365(credentials: CredentialFields | undefined | null): boolean {
  if (!credentials) return false;
  const m365 = String(credentials.ms365 || '').trim().toUpperCase();
  return m365 !== '' && m365 !== 'N' && m365 !== 'N/A' && m365 !== '["N"]';
}

export function formatCredentialDisplay(key: string, value: string | undefined | null): string {
  if (!value) return 'N';
  const trimmed = String(value).trim();
  if (key === 'tac') {
    if (trimmed === '["N"]' || trimmed === 'N' || trimmed === '[""]') return 'N';
    try {
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          // Normalize to Y, MOD, ALS
          const filtered = parsed.filter(item => item && item !== 'N');
          return filtered.length > 0 ? filtered.join(', ') : 'N';
        }
      }
    } catch {
      // fallback regex clean
      const cleaned = trimmed.replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
      return cleaned.length > 0 ? cleaned.join(', ') : trimmed;
    }
  }
  return trimmed;
}
