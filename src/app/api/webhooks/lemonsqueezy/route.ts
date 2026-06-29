import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('X-Signature-256') || ''
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || ''

  const hmac = crypto.createHmac('sha256', secret)
  const digest = Buffer.from(hmac.update(body).digest('hex'), 'utf8')
  const receivedSig = Buffer.from(
    signature.startsWith('sha256=') ? signature.slice(7) : signature,
    'utf8'
  )

  if (!crypto.timingSafeEqual(digest, receivedSig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const eventName = event.meta?.event_name

  switch (eventName) {
    case 'order_created':
      console.log('New order:', event.data?.id)
      break
    case 'subscription_created':
      console.log('New subscription:', event.data?.id)
      break
    case 'subscription_cancelled':
      console.log('Cancelled subscription:', event.data?.id)
      break
    default:
      console.log('Unhandled event:', eventName)
  }

  return NextResponse.json({ received: true })
}
