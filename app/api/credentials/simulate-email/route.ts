import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, submissionId, uNumber, name, fortnightLabel, status } = body;

    if (!email || !submissionId) {
      return NextResponse.json(
        { success: false, error: 'Email and Submission ID are required for simulation.' },
        { status: 400 }
      );
    }

    // Simulate realistic mail server processing latency
    await new Promise(resolve => setTimeout(resolve, 350));

    return NextResponse.json({
      success: true,
      simulated: true,
      deliveredTo: email,
      submissionId,
      uNumber,
      name,
      fortnightLabel,
      status,
      timestamp: new Date().toISOString(),
      message: `Simulated confirmation email summary dispatched to ${email}`
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Simulated email dispatch failure: ' + msg },
      { status: 500 }
    );
  }
}
