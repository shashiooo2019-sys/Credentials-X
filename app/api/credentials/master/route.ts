import { NextRequest, NextResponse } from 'next/server';
import { getMasterCredentials, saveMasterCredentials } from '@/lib/storage';
import { INITIAL_MASTER_CREDENTIALS } from '@/lib/initial-data';
import { UserCredentialRecord } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.toLowerCase() || '';

    const list = getMasterCredentials();

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

    const list = getMasterCredentials();
    const existingIndex = list.findIndex(
      s => s.uNumber.toLowerCase().trim() === record.uNumber.toLowerCase().trim()
    );

    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...record,
        updatedAt: new Date().toISOString()
      };
    } else {
      list.unshift({
        ...record,
        id: record.uNumber.trim(),
        updatedAt: new Date().toISOString()
      });
    }

    saveMasterCredentials(list);

    return NextResponse.json({
      success: true,
      message: existingIndex >= 0 ? 'Record updated successfully' : 'New record created successfully',
      staff: list
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

    if (!uNumber) {
      return NextResponse.json({ success: false, error: 'uNumber parameter is required' }, { status: 400 });
    }

    const list = getMasterCredentials();
    const updated = list.filter(s => s.uNumber.toLowerCase() !== uNumber.toLowerCase());

    saveMasterCredentials(updated);

    return NextResponse.json({
      success: true,
      message: `Staff record ${uNumber} deleted`,
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
    saveMasterCredentials([...INITIAL_MASTER_CREDENTIALS]);
    return NextResponse.json({
      success: true,
      message: 'Master database successfully reset to original seed dataset.',
      count: INITIAL_MASTER_CREDENTIALS.length
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
