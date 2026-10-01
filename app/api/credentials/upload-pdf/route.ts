import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { saveMasterCredentials, upsertMasterCredentials, getMasterCredentials } from '@/lib/storage';
import { UserCredentialRecord } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const directJson = formData.get('json') as string | null;
    const action = formData.get('action') as string | null; // 'preview' | 'commit'
    const mode = formData.get('mode') as string | null; // 'upsert' (default) | 'replace'

    // If direct JSON provided
    if (directJson) {
      try {
        const parsed: UserCredentialRecord[] = JSON.parse(directJson);
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid JSON';
        return NextResponse.json({ success: false, error: 'JSON parse error: ' + msg }, { status: 400 });
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
Analyze the attached PDF document containing staff credentials (which may contain a full staff table or just a few names to add/update).
Extract every row in the table into a clean JSON array of staff records.

Each object must match this TypeScript structure:
{
  "id": string (unique ID, use uNumber),
  "uNumber": string (e.g. "U194283"),
  "exNumber": string (e.g. "EX855733" or "N/A"),
  "name": string (e.g. "RAKESH PARMAR"),
  "credentials": {
    "cuteAccess": string ("Y" | "N", default "Y"),
    "oneRes": string ("Y" | "N" | ""),
    "alteaLhc": string ("SUP" | "Y" | "N" | ""),
    "look": string ("Y" | "N" | ""),
    "ebase": string ("Y" | "N" | ""),
    "lms": string ("Y" | "N" | ""),
    "mesWeb": string ("Y" | "N" | ""),
    "mesWebIn": string ("Y" | "N" | ""),
    "worldTracer": string ("Y" | "N" | ""),
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
- Set cuteAccess to "Y" by default for everyone unless specified as N.
- Support documents with only a few names/records as well as full master documents.
- Return ONLY a raw JSON array. Do not wrap with markdown code blocks or explanations.
`;

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

    const responseText = response.text || '';
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
    const sanitized = extractedRecords.map(r => ({
      id: r.uNumber || `STAFF-${Math.random().toString(36).substring(2, 7)}`,
      uNumber: r.uNumber || 'N/A',
      exNumber: r.exNumber || 'N/A',
      name: r.name || 'UNKNOWN',
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
    }));

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

  const idxUNum = findCol('unum', 'staffid', 'unumber', 'id');
  const idxName = findCol('name', 'staffname', 'names');
  const idxExNum = findCol('exno', 'exnumber', 'exnum', 'ex');
  const idxCute = findCol('cute');
  const idxOneRes = findCol('oneres', '1res');
  const idxAltea = findCol('altealh', 'altea', 'lhc');
  const idxLook = findCol('look');
  const idxEbase = findCol('ebase');
  const idxLms = findCol('lms');
  const idxMes = findCol('mesweb', 'mes');
  const idxMesIn = findCol('meswebin', 'internet');
  const idxWt = findCol('world', 'tracer');
  const idxSbh = findCol('sbh');
  const idxDasgo = findCol('dasgo');
  const idxM365 = findCol('m365', 'ms365', '365');
  const idxLhFm = findCol('lhaltea', 'lhfm');
  const idxLxFm = findCol('lxaltea', 'lxfm');
  const idxFloat = findCol('float');
  const idxFloatBac = findCol('floatbac', 'backup');
  const idxPki = findCol('pki');
  const idxTac = findCol('tac', 'turnaround');
  const idxEmm = findCol('emm');

  const records: UserCredentialRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0 || cols.every(c => !c)) continue;

    // Determine values either by mapped header or by common index order
    const uNum = (idxUNum >= 0 ? cols[idxUNum] : cols[0])?.trim() || `U-NEW-${i}`;
    const name = (idxName >= 0 ? cols[idxName] : cols[1])?.trim() || `Staff ${i}`;
    const exNum = (idxExNum >= 0 ? cols[idxExNum] : cols[2])?.trim() || 'N/A';

    const getVal = (idx: number, fallbackIdx: number, defVal: string = 'N'): string => {
      if (idx >= 0 && cols[idx] !== undefined && cols[idx] !== '') return cols[idx].trim();
      if (fallbackIdx >= 0 && cols[fallbackIdx] !== undefined && cols[fallbackIdx] !== '') return cols[fallbackIdx].trim();
      return defVal;
    };

    records.push({
      id: uNum.toUpperCase(),
      uNumber: uNum.toUpperCase(),
      exNumber: exNum || 'N/A',
      name: name.toUpperCase(),
      credentials: {
        cuteAccess: getVal(idxCute, 3, 'Y') || 'Y',
        oneRes: getVal(idxOneRes, 4, 'N'),
        alteaLhc: getVal(idxAltea, 5, 'N'),
        look: getVal(idxLook, 6, 'N'),
        ebase: getVal(idxEbase, 7, 'N'),
        lms: getVal(idxLms, 8, 'N'),
        mesWeb: getVal(idxMes, 9, 'N'),
        mesWebIn: getVal(idxMesIn, 10, 'N'),
        worldTracer: getVal(idxWt, 11, 'N'),
        sbh: getVal(idxSbh, 12, 'N'),
        dasgo: getVal(idxDasgo, 13, 'N'),
        ms365: getVal(idxM365, 14, 'N'),
        lhalteaF: getVal(idxLhFm, 15, 'N'),
        lxAlteaF: getVal(idxLxFm, 16, 'N'),
        float: getVal(idxFloat, 17, 'N'),
        floatBac: getVal(idxFloatBac, 18, 'N'),
        pki: getVal(idxPki, 19, 'N'),
        tac: getVal(idxTac, 20, 'N'),
        emm: getVal(idxEmm, 21, 'N')
      },
      updatedAt: new Date().toISOString()
    });
  }

  return records;
}
