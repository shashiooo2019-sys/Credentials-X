import { NextRequest, NextResponse } from 'next/server';
import { findStaffByUNumber, getMasterCredentials, registerNewStaff, getSubmissions, getFortnightPeriod } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uNumber = searchParams.get('uNumber');

    if (!uNumber || uNumber.trim().length === 0) {
      return NextResponse.json(
        { found: false, error: 'Please enter a U Number to initiate verification.' },
        { status: 400 }
      );
    }

    const staff = await findStaffByUNumber(uNumber);

    if (!staff) {
      // Suggest close matches or sample U-numbers to assist user
      const all = await getMasterCredentials();
      const suggestions = all
        .filter(s => s.uNumber.toLowerCase().includes(uNumber.toLowerCase()) || s.name.toLowerCase().includes(uNumber.toLowerCase()))
        .slice(0, 5)
        .map(s => ({ uNumber: s.uNumber, name: s.name }));

      return NextResponse.json(
        {
          found: false,
          notFound: true,
          requestedUNumber: uNumber.trim().toUpperCase(),
          error: `No credential record found for "${uNumber.trim()}". You can input your name below to register and submit your credentials status.`,
          suggestions
        },
        { status: 404 }
      );
    }

    const allSubmissions = await getSubmissions();
    const currentFortnight = getFortnightPeriod(new Date().toISOString());
    const existingSubmission = allSubmissions.find(
      s => s.uNumber.trim().toUpperCase() === staff.uNumber.trim().toUpperCase() &&
           s.fortnightPeriod === currentFortnight.period
    );

    return NextResponse.json({
      found: true,
      staff,
      existingSubmission: existingSubmission || null,
      currentFortnightLabel: currentFortnight.label
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { found: false, error: 'Internal lookup error: ' + message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uNumber, name, exNumber } = await req.json();

    if (!uNumber || !name || !uNumber.trim() || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'U Number and Full Name are required.' },
        { status: 400 }
      );
    }

    const staff = await registerNewStaff(uNumber.trim().toUpperCase(), name.trim().toUpperCase(), exNumber);

    return NextResponse.json({
      success: true,
      staff,
      message: 'Profile registered successfully.'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Failed to register profile: ' + message },
      { status: 500 }
    );
  }
}
