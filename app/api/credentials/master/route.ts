import { NextRequest, NextResponse } from 'next/server';
import {
  getMasterCredentials,
  saveMasterCredentials,
  saveSingleMasterRecord,
  deleteStaffRecord,
  clearAllMasterCredentials
} from '@/lib/storage';
import { INITIAL_MASTER_CREDENTIALS } from '@/lib/initial-data';
import { UserCredentialRecord } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.toLowerCase() || '';

    const list = await getMasterCredentials();

    if (!search) {
      return NextResponse.json({
        success: true,
        count: list.length,
        staff: list
      });
    }

    const filtered = list.filter(
      item =>
        item.uNumber.toLowerCase().includes(search) ||
        item.name.toLowerCase().includes(search) ||
        item.exNumber.toLowerCase().includes(search)
    );

    return NextResponse.json({
      success: true,
      count: filtered.length,
      staff: filtered
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const record: UserCredentialRecord = await req.json();

    if (!record.uNumber || !record.name) {
      return NextResponse.json(
        { success: false, error: 'U Number and Name are required.' },
        { status: 400 }
      );
    }

    await saveSingleMasterRecord(record);
    const updatedList = await getMasterCredentials();

    return NextResponse.json({
      success: true,
      message: 'Staff credential record saved successfully to Firebase Firestore',
      staff: updatedList
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uNumber = searchParams.get('uNumber');
    const isAll = searchParams.get('all') === 'true' || searchParams.get('clearAll') === 'true';

    if (isAll) {
      const result = await clearAllMasterCredentials();
      return NextResponse.json({
        success: true,
        message: `Entire Master Credentials Registry (${result.deletedCount} staff profiles) deleted successfully.`,
        deletedCount: result.deletedCount,
        count: 0,
        staff: []
      });
    }

    if (!uNumber) {
      return NextResponse.json({ success: false, error: 'uNumber parameter or all=true is required' }, { status: 400 });
    }

    await deleteStaffRecord(uNumber);
    const updated = await getMasterCredentials();

    return NextResponse.json({
      success: true,
      message: `Staff record ${uNumber} deleted from Firebase Firestore`,
      count: updated.length
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Reset to default seed
export async function PUT() {
  try {
    await saveMasterCredentials([...INITIAL_MASTER_CREDENTIALS]);
    return NextResponse.json({
      success: true,
      message: 'Master database successfully reset to original seed dataset in Firebase Firestore.',
      count: INITIAL_MASTER_CREDENTIALS.length
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
