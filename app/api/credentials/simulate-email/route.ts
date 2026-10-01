import { NextRequest, NextResponse } from 'next/server';

const OFFICIAL_REVIEW_EMAIL = 'Log-in Reviews - DELSM Operations and Security <ea8add7c.lufthansagroup.onmicrosoft.com@emea.teams.ms>';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      submissionId,
      uNumber,
      name,
      fortnightLabel,
      status,
      officialRecipient = OFFICIAL_REVIEW_EMAIL
    } = body;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: 'Submission ID is required.' },
        { status: 400 }
      );
    }

    // Simulate realistic mail server processing latency
    await new Promise(resolve => setTimeout(resolve, 350));

    const recipients = [officialRecipient];
    if (email && email.trim() && !recipients.includes(email.trim())) {
      recipients.push(email.trim());
    }

    return NextResponse.json({
      success: true,
      simulated: true,
      officialRecipient,
      staffEmail: email || null,
      deliveredTo: recipients,
      submissionId,
      uNumber,
      name,
      fortnightLabel,
      status,
      timestamp: new Date().toISOString(),
      message: `Credentials verification notification dispatched to ${officialRecipient}${email ? ` and copy sent to ${email}` : ''}`
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Email dispatch failure: ' + msg },
      { status: 500 }
    );
  }
}
