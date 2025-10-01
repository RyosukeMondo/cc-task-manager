import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/**
 * Proxy route for user settings
 * Forwards requests to the backend settings API
 */
export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authorization = request.headers.get('authorization');

    // Forward request to backend
    const backendUrl = `${BACKEND_URL}/api/settings`;

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
    console.error('Error proxying settings GET request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get authorization header
    const authorization = request.headers.get('authorization');

    // Get request body
    const body = await request.json();

    // Forward request to backend
    const backendUrl = `${BACKEND_URL}/api/settings`;

    const response = await fetch(backendUrl, {
      method: 'PATCH',
      headers: {
        ...(authorization && { authorization }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying settings PATCH request:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
