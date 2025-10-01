import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/**
 * Proxy route for analytics trend data
 * Forwards requests to the backend analytics API
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    // Get authorization header
    const authorization = request.headers.get('authorization');

    // Forward request to backend
    const backendUrl = `${BACKEND_URL}/api/analytics/trends${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        ...(authorization && { authorization }),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying analytics trends request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics trend data' },
      { status: 500 }
    );
  }
}
