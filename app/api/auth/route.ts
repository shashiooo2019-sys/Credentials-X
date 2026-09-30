import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (username === 'admin' && password === 'Admin220!') {
      return NextResponse.json({
        success: true,
        user: {
          username: 'admin',
          role: 'ADMINISTRATOR',
          authenticatedAt: new Date().toISOString()
        },
        token: 'auth-admin-session-' + Date.now()
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid username or password' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to process authentication request' },
      { status: 500 }
    );
  }
}
