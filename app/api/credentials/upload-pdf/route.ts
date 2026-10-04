import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { saveMasterCredentials, upsertMasterCredentials, sanitizeDocId } from '@/lib/storage';
import { UserCredentialRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formErr: unknown) {
      const msg = formErr instanceof Error ? formErr.message : 'Invalid form data';
      return NextResponse.json(
        { success: false, error: `Upload payload error: ${msg}. If your file is very large, try CSV or copy-pasting the table.` },
        { status: 400 }
      );
    }
    const file = formData.get('file') as File | null;
    const directJson = formData.get('json') as string | null;
    const action = formData.get('action') as string | null; // 'preview' | 'commit'
    const mode = formData.get('mode') as string | null; // 'upsert' (default) | 'replace'

    // If direct JSON provided
    if (directJson) {
      let parsed: UserCredentialRecord[];
      try {
        parsed = JSON.parse(directJson);
      } catch (jsonErr: unknown) {
        const msg = jsonErr instanceof Error ? jsonErr.message : 'Invalid JSON format';
        return NextResponse.json({ success: false, error: 'JSON parse error: ' + msg }, { status: 400 });
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        if (action === 'commit') {
          if (mode === 'replace') {
            await saveMasterCredentials(parsed);
            return NextResponse.json({
              success: true,
              records: parsed,
              count: parsed.length,
              message: `Master credentials database replaced with ${parsed.length} staff records in Firebase Firestore.`
            });
          } else {
            const res = await upsertMasterCredentials(parsed);
            return NextResponse.json({
              success: true,
              records: parsed,
              count: parsed.length,
              updatedCount: res.updatedCount,
              addedCount: res.addedCount,
              totalCount: res.totalCount,
              message: `Successfully updated ${res.updatedCount} existing records and added ${res.addedCount} new staff to Firebase Firestore. Total database records: ${res.totalCount}.`
            });
          }
        }
        return NextResponse.json({
          success: true,
          records: parsed,
          count: parsed.length,
          message: 'Preview ready.'
        });
      }
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file was uploaded. Please upload a PDF or CSV file.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    // Check if it's a CSV or text file
    if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      const text = buffer.toString('utf-8');
      const records = parseCsvToRecords(text);
      if (records.length === 0) {
        return NextResponse.json({ success: false, error: 'Could not extract valid records from CSV/Text.' }, { status: 400 });
      }
      if (action === 'commit') {
        if (mode === 'replace') {
          await saveMasterCredentials(records);
          return NextResponse.json({
            success: true,
            records,
            count: records.length,
            message: `Successfully replaced master database with ${records.length} records in Firebase Firestore.`
          });
        } else {
          const res = await upsertMasterCredentials(records);
          return NextResponse.json({
            success: true,
            records,
            count: records.length,
            updatedCount: res.updatedCount,
            addedCount: res.addedCount,
            totalCount: res.totalCount,
            message: `Successfully updated ${res.updatedCount} existing records and added ${res.addedCount} new staff in Firebase Firestore. Total database records: ${res.totalCount}.`
          });
        }
      }
      return NextResponse.json({
        success: true,
        records,
        count: records.length,
        message: `Extracted ${records.length} staff records from CSV for preview.`,
      });
    }

    // It is a PDF file! Use Gemini to parse PDF document into structured JSON
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'GEMINI_API_KEY is not configured for automatic PDF multimodal table extraction. You can alternatively upload a CSV or paste table text.'
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const base64Pdf = buffer.toString('base64');

    const prompt = `
You are an expert aviation and credentials data extraction system.
Analyze the attached PDF document containing staff credentials (which may contain a full master staff table or just a few names to add/update).
Extract every row in the table into a clean JSON array of staff records matching the exact column structure below.

Expected Table Columns & Mapping:
1. UNUMBER -> string uNumber (e.g. "U194283" or "N/A (NEW STAFF 02)")
2. EX Number -> string exNumber (e.g. "EX855733" or "N/A")
3. NAMES -> string name (e.g. "RAKESH PARMAR")
4. ONE RES -> string oneRes ("Y" | "N" | "")
5. ALTEA LHCM -> string alteaLhc ("SUP" | "Y" | "N" | "")
6. Altea LXCM -> string alteaLxc (ignore field, set to "N" unless specified)
7. LOOK -> string look ("Y" | "N" | "")
8. EBASE -> string ebase ("Y" | "N" | "")
9. LMS -> string lms ("Y" | "N" | "")
10. MesWeb -> string mesWeb ("Y" | "N" | "")
11. MesWeb Internet -> string mesWebIn ("Y" | "N" | "")
12. WorldTracer -> string worldTracer ("Y" | "N" | "")
13. WT Tablet -> string wtTablet (ignore field, set to "N" unless specified)
14. SBH -> string sbh ("Y" | "N" | "")
15. DASGO -> string dasgo ("Y" | "Edit" | "View only" | "N" | "")
16. MS365 -> string ms365 ("Y" | "N" | "")
17. LHALTEA FM -> string lhalteaF ("Y" | "N" | "")
18. LX ALTEA FM -> string lxAlteaF ("Y" | "N" | "")
19. FLOAT -> string float ("Y" | "N" | "")
20. FLOAT Backup -> string floatBac ("Y" | "N" | "")
21. PKI -> string pki ("Y" | "N" | "")
22. TAC -> string tac (Turnaround companion App access codes: 'Y', 'MOD', 'ALS', or array/string like '["MOD"]', '["ALS"]', '["Y"]', '["MOD","ALS","Y"]', or "N")
23. EMM -> string emm ("Y" | "N" | "")

Each JSON object must have this structure:
{
  "id": string (unique ID, use uNumber),
  "uNumber": string (e.g. "U194283"),
  "exNumber": string (e.g. "EX855733" or "N/A"),
  "name": string (e.g. "RAKESH PARMAR"),
  "credentials": {
    "cuteAccess": string ("Y" | "N", default "Y"),
    "oneRes": string ("Y" | "N" | ""),
    "alteaLhc": string ("SUP" | "Y" | "N" | ""),
    "alteaLxc": string ("Y" | "N" | ""),
    "look": string ("Y" | "N" | ""),
    "ebase": string ("Y" | "N" | ""),
    "lms": string ("Y" | "N" | ""),
    "mesWeb": string ("Y" | "N" | ""),
    "mesWebIn": string ("Y" | "N" | ""),
    "worldTracer": string ("Y" | "N" | ""),
    "wtTablet": string ("Y" | "N" | ""),
    "sbh": string ("Y" | "N" | ""),
    "dasgo": string ("Y" | "N" | "Edit" | "View only" | ""),
    "ms365": string ("Y" | "N" | ""),
    "lhalteaF": string ("Y" | "N" | ""),
    "lxAlteaF": string ("Y" | "N" | ""),
    "float": string ("Y" | "N" | ""),
    "floatBac": string ("Y" | "N" | ""),
    "pki": string ("Y" | "N" | ""),
    "tac": string (Turnaround companion App access codes: 'Y', 'MOD', 'ALS', or array/string like '["MOD"]', '["ALS"]', '["Y"]', '["MOD","ALS","Y"]', or "N"),
    "emm": string ("Y" | "N" | "")
  }
}

Important Instructions:
- Set cuteAccess to "Y" by default for all staff.
- Support documents with only a few names/records as well as full master documents.
- Return ONLY a raw JSON array. Do not wrap with markdown code blocks or explanations.
`;

    let responseText = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Pdf,
                  mimeType: 'application/pdf'
                }
              },
              {
                text: prompt
              }
            ]
          }
        ]
      });
      responseText = response.text || '';
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : 'AI model processing error';
      return NextResponse.json(
        { success: false, error: `PDF Extraction failed: ${msg}. You can also download the CSV template or paste table rows directly.` },
        { status: 500 }
      );
    }

    const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let extractedRecords: UserCredentialRecord[] = [];
    try {
      extractedRecords = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        extractedRecords = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse Gemini output into valid JSON array.');
      }
    }

    if (!Array.isArray(extractedRecords) || extractedRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Extraction yielded 0 records. Please check the PDF quality.' },
        { status: 400 }
      );
    }

    // Sanitize records & ensure cuteAccess defaults to Y
    const sanitized = extractedRecords.map((r, idx) => {
      const rawUNum = (r.uNumber || r.id || `STAFF_${idx + 1}`).trim().toUpperCase();
      const safeId = sanitizeDocId(r.id || rawUNum);
      return {
        id: safeId,
        uNumber: rawUNum,
        exNumber: r.exNumber || 'N/A',
        name: (r.name || 'UNKNOWN').trim().toUpperCase(),
        orderIndex: idx,
        credentials: {
          cuteAccess: r.credentials?.cuteAccess ?? 'Y',
          oneRes: r.credentials?.oneRes ?? 'N',
          alteaLhc: r.credentials?.alteaLhc ?? 'N',
          look: r.credentials?.look ?? 'N',
          ebase: r.credentials?.ebase ?? 'N',
          lms: r.credentials?.lms ?? 'N',
          mesWeb: r.credentials?.mesWeb ?? 'N',
          mesWebIn: r.credentials?.mesWebIn ?? 'N',
          worldTracer: r.credentials?.worldTracer ?? 'N',
          sbh: r.credentials?.sbh ?? 'N',
          dasgo: r.credentials?.dasgo ?? 'N',
          ms365: r.credentials?.ms365 ?? 'N',
          lhalteaF: r.credentials?.lhalteaF ?? 'N',
          lxAlteaF: r.credentials?.lxAlteaF ?? 'N',
          float: r.credentials?.float ?? 'N',
          floatBac: r.credentials?.floatBac ?? 'N',
          pki: r.credentials?.pki ?? 'N',
          tac: r.credentials?.tac ?? '',
          emm: r.credentials?.emm ?? 'N'
        },
        updatedAt: new Date().toISOString()
      };
    });

    if (action === 'commit') {
      if (mode === 'replace') {
        await saveMasterCredentials(sanitized);
        return NextResponse.json({
          success: true,
          records: sanitized,
          count: sanitized.length,
          message: `Successfully replaced master database with ${sanitized.length} staff records in Firebase Firestore.`
        });
      } else {
        const res = await upsertMasterCredentials(sanitized);
        return NextResponse.json({
          success: true,
          records: sanitized,
          count: sanitized.length,
          updatedCount: res.updatedCount,
          addedCount: res.addedCount,
          totalCount: res.totalCount,
          message: `Successfully updated ${res.updatedCount} existing records and added ${res.addedCount} new staff to Firebase Firestore. Total records: ${res.totalCount}.`
        });
      }
    }

    return NextResponse.json({
      success: true,
      records: sanitized,
      count: sanitized.length,
      message: `Extracted ${sanitized.length} staff records from PDF for preview.`
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: 'File processing error: ' + message }, { status: 500 });
  }
}

function parseCsvToRecords(csvText: string): UserCredentialRecord[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse CSV line taking quotes into account
  const parseLine = (text: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const headerCols = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Helper to find header index
  const findCol = (...keywords: string[]): number => {
    return headerCols.findIndex(h => keywords.some(k => h.includes(k)));
  };

  const idxUNum = findCol('unumber', 'unum', 'staffid', 'staffno', 'id');
  const idxExNum = findCol('exnumber', 'exno', 'exnum', 'ex');
  const idxName = findCol('names', 'name', 'staffname', 'fullname');
  const idxOneRes = findCol('oneres', '1res', 'one');
  const idxAlteaLhc = findCol('altealhcm', 'altealhc', 'altealh', 'lhcm');
  const idxAlteaLxc = findCol('altealxcm', 'altealxc', 'lxcm');
  const idxLook = findCol('look');
  const idxEbase = findCol('ebase');
  const idxLms = findCol('lms');
  
  // Specific match for MesWeb vs MesWeb Internet (ensure 'names' is never matched by 'mes')
  const idxMesIn = findCol('meswebinternet', 'meswebin', 'mesinternet', 'mesin', 'internet');
  let idxMes = findCol('mesweb', 'mesw', 'mesinternal');
  if (idxMes === -1) {
    idxMes = headerCols.findIndex((h, idx) => !h.includes('name') && h.includes('mes') && idx !== idxMesIn);
  }
  
  // Specific match for WorldTracer vs WT Tablet
  const idxWtTablet = findCol('wttablet', 'tablet');
  let idxWt = findCol('worldtracer', 'worldtrac', 'tracer', 'world');
  if (idxWt === -1 || idxWt === idxWtTablet) {
    idxWt = headerCols.findIndex((h, idx) => (h.includes('world') || h.includes('tracer')) && idx !== idxWtTablet);
  }

  const idxSbh = findCol('sbh');
  const idxDasgo = findCol('dasgo');
  const idxM365 = findCol('ms365', 'm365', '365');
  const idxLhFm = findCol('lhalteafm', 'lhaltea', 'lhfm');
  const idxLxFm = findCol('lxalteafm', 'lxaltea', 'lxfm');
  
  // Specific match for FLOAT vs FLOAT Backup
  const idxFloatBac = findCol('floatbackup', 'floatbac', 'backup');
  let idxFloat = findCol('float');
  if (idxFloat === idxFloatBac) {
    idxFloat = headerCols.findIndex((h, idx) => h.includes('float') && idx !== idxFloatBac);
  }

  const idxPki = findCol('pki');
  const idxTac = findCol('tac', 'turnaround');
  const idxEmm = headerCols.findIndex(h => h === 'emm' || h.startsWith('emm'));
  const idxCute = findCol('cute');

  const records: UserCredentialRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0 || cols.every(c => !c)) continue;

    // Expected master column layout:
    // 0: UNUMBER, 1: EX Number, 2: NAMES, 3: ONE RES, 4: ALTEA LHCM, 5: Altea LXCM (ignore),
    // 6: LOOK, 7: EBASE, 8: LMS, 9: MesWeb, 10: MesWeb Internet, 11: WorldTracer, 12: WT Tablet (ignore),
    // 13: SBH, 14: DASGO, 15: MS365, 16: LHALTEA FM, 17: LX ALTEA FM, 18: FLOAT, 19: FLOAT Backup,
    // 20: PKI, 21: TAC, 22: EMM
    const rawUNum = (idxUNum >= 0 ? cols[idxUNum] : cols[0])?.trim() || `U-NEW-${i}`;
    const exNum = (idxExNum >= 0 ? cols[idxExNum] : cols[1])?.trim() || 'N/A';
    const name = (idxName >= 0 ? cols[idxName] : cols[2])?.trim() || `Staff ${i}`;
    const safeId = sanitizeDocId(rawUNum);

    const getVal = (idx: number, fallbackIdx: number, defVal: string = 'N'): string => {
      if (idx >= 0 && cols[idx] !== undefined && cols[idx] !== '') return cols[idx].trim();
      if (fallbackIdx >= 0 && cols[fallbackIdx] !== undefined && cols[fallbackIdx] !== '') return cols[fallbackIdx].trim();
      return defVal;
    };

    records.push({
      id: safeId,
      uNumber: rawUNum.toUpperCase(),
      exNumber: exNum || 'N/A',
      name: name.toUpperCase(),
      orderIndex: i - 1,
      credentials: {
        cuteAccess: getVal(idxCute, -1, 'Y') || 'Y',
        oneRes: getVal(idxOneRes, 3, 'N'),
        alteaLhc: getVal(idxAlteaLhc, 4, 'N'),
        alteaLxc: getVal(idxAlteaLxc, 5, 'N'),
        look: getVal(idxLook, 6, 'N'),
        ebase: getVal(idxEbase, 7, 'N'),
        lms: getVal(idxLms, 8, 'N'),
        mesWeb: getVal(idxMes, 9, 'N'),
        mesWebIn: getVal(idxMesIn, 10, 'N'),
        worldTracer: getVal(idxWt, 11, 'N'),
        wtTablet: getVal(idxWtTablet, 12, 'N'),
        sbh: getVal(idxSbh, 13, 'N'),
        dasgo: getVal(idxDasgo, 14, 'N'),
        ms365: getVal(idxM365, 15, 'N'),
        lhalteaF: getVal(idxLhFm, 16, 'N'),
        lxAlteaF: getVal(idxLxFm, 17, 'N'),
        float: getVal(idxFloat, 18, 'N'),
        floatBac: getVal(idxFloatBac, 19, 'N'),
        pki: getVal(idxPki, 20, 'N'),
        tac: getVal(idxTac, 21, 'N'),
        emm: getVal(idxEmm, 22, 'N')
      },
      updatedAt: new Date().toISOString()
    });
  }

  return records;
}
