import { NextRequest, NextResponse } from 'next/server';
import {
  getSubmissions,
  saveSubmission,
  getMasterCredentials,
  getFortnightPeriod
} from '@/lib/storage';
import { SubmissionRecord, FieldVerification } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uNumber, exNumber, name, verificationDate, verifications, overallRemarks } = body;

    if (!uNumber || !name) {
      return NextResponse.json(
        { success: false, error: 'User number and name are required.' },
        { status: 400 }
      );
    }

    const effectiveDate = verificationDate || new Date().toISOString().split('T')[0];
    const fortnight = getFortnightPeriod(effectiveDate);

    // Validate verifications
    if (!Array.isArray(verifications) || verifications.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No verification items provided.' },
        { status: 400 }
      );
    }

    // Validate max 255 chars on remarks
    for (const item of verifications as FieldVerification[]) {
      if (item.remark && item.remark.length > 255) {
        return NextResponse.json(
          { success: false, error: `Remark for "${item.fieldLabel}" exceeds maximum 255 characters.` },
          { status: 400 }
        );
      }
    }

    const changeRequests = verifications.filter((v: FieldVerification) => v.status === 'CHANGE_REQUESTED');
    const confirmedItems = verifications.filter((v: FieldVerification) => v.status === 'CONFIRMED');

    const submissionId = `SUB-${effectiveDate.replace(/-/g, '')}-${uNumber.replace(/[^a-zA-Z0-9]/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord: SubmissionRecord = {
      id: submissionId,
      uNumber: uNumber.trim(),
      exNumber: exNumber || 'N/A',
      name: name.trim(),
      verificationDate: effectiveDate,
      submittedAt: new Date().toISOString(),
      fortnightPeriod: fortnight.period,
      fortnightLabel: fortnight.label,
      verifications,
      hasChangeRequests: changeRequests.length > 0,
      changeRequestCount: changeRequests.length,
      confirmedCount: confirmedItems.length,
      totalActiveFields: verifications.length,
      overallRemarks: overallRemarks ? String(overallRemarks).slice(0, 255) : '',
      status: changeRequests.length > 0 ? 'CHANGE_REQUESTED' : 'CONFIRMED'
    };

    const saved = await saveSubmission(newRecord);

    return NextResponse.json({
      success: true,
      submission: saved,
      message: 'Credential verification submitted successfully.'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Submission error: ' + message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const fortnightParam = searchParams.get('fortnight'); // 1 or 2
    const filterStatus = searchParams.get('status'); // 'ALL' | 'MISSING' | 'CHANGE_REQUESTED' | 'CONFIRMED'

    const allSubmissions = await getSubmissions();
    const masterStaff = await getMasterCredentials();

    // Default to current date fortnight if not provided
    const now = new Date();
    const targetYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const targetMonth = monthParam ? parseInt(monthParam, 10) : (now.getMonth() + 1);
    const targetFortnight = (fortnightParam ? parseInt(fortnightParam, 10) : (now.getDate() <= 15 ? 1 : 2)) as 1 | 2;

    const mm = String(targetMonth).padStart(2, '0');
    const targetPeriodKey = `${targetYear}-${mm}-F${targetFortnight}`;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = monthNames[targetMonth - 1] || "Month";
    const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
    const fortnightLabel = targetFortnight === 1 ? `1-15 ${monthName} ${targetYear}` : `16-${lastDayOfMonth} ${monthName} ${targetYear}`;

    // Submissions in this specific fortnight
    const fortnightSubmissions = allSubmissions.filter(s => s.fortnightPeriod === targetPeriodKey);

    // Identify who submitted vs who is missing
    const submittedUNumbers = new Set(fortnightSubmissions.map(s => s.uNumber.toLowerCase().trim()));

    const missingStaff = masterStaff
      .filter(staff => !submittedUNumbers.has(staff.uNumber.toLowerCase().trim()))
      .map(staff => ({
        uNumber: staff.uNumber,
        exNumber: staff.exNumber,
        name: staff.name,
        credentials: staff.credentials,
        status: 'MISSING'
      }));

    // Filter submissions if status specified
    let filteredSubmissions = fortnightSubmissions;
    if (filterStatus === 'CHANGE_REQUESTED') {
      filteredSubmissions = fortnightSubmissions.filter(s => s.hasChangeRequests);
    } else if (filterStatus === 'CONFIRMED') {
      filteredSubmissions = fortnightSubmissions.filter(s => !s.hasChangeRequests);
    } else if (filterStatus === 'MISSING' || filterStatus === 'PENDING') {
      filteredSubmissions = [];
    }

    const totalStaffCount = masterStaff.length;
    const submittedCount = fortnightSubmissions.length;
    const missingCount = missingStaff.length;
    const changeRequestCount = fortnightSubmissions.filter(s => s.hasChangeRequests).length;
    const confirmedCount = fortnightSubmissions.filter(s => !s.hasChangeRequests).length;
    const complianceRate = totalStaffCount > 0 ? Math.round((submittedCount / totalStaffCount) * 100) : 0;

    return NextResponse.json({
      success: true,
      period: targetPeriodKey,
      label: fortnightLabel,
      year: targetYear,
      month: targetMonth,
      fortnight: targetFortnight,
      metrics: {
        totalStaffCount,
        submittedCount,
        missingCount,
        changeRequestCount,
        confirmedCount,
        complianceRate
      },
      submissions: filteredSubmissions,
      missingStaff: filterStatus === 'MISSING' || filterStatus === 'PENDING' || filterStatus === 'ALL' || !filterStatus ? missingStaff : []
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Failed fetching submissions: ' + message },
      { status: 500 }
    );
  }
}
