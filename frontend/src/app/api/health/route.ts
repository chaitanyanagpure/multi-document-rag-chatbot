import { NextResponse } from 'next/server'

/**
 * GET /api/health
 * Health check endpoint used by Docker and load balancer health probes.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      app: process.env.NEXT_PUBLIC_APP_NAME || 'VerbaFlow AI',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
}
