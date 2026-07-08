// ─────────────────────────────────────────────────────────────
// BYTEPLUS MODELARK CLIENT — server-side only (ARK_API_KEY)
// Official home of Seedance 2.0. Used as the primary video
// provider when ARK_API_KEY is set; kie.ai stays as fallback.
// Docs: https://docs.byteplus.com/en/docs/ModelArk/1520757
// ─────────────────────────────────────────────────────────────

const ARK_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3'

export const ARK_MODELS = {
  videoDraft: 'dreamina-seedance-2-0-fast-260128',
  videoFinal: 'dreamina-seedance-2-0-260128',
} as const

function arkKey(): string {
  const key = process.env.ARK_API_KEY
  if (!key) throw new Error('ARK_API_KEY is not configured')
  return key
}

export function arkEnabled(): boolean {
  return !!process.env.ARK_API_KEY
}

export async function arkCreateVideoTask(opts: {
  prompt: string
  referenceImageUrls?: string[]
  quality?: 'draft' | 'final'
  duration?: number
}): Promise<string> {
  const { prompt, referenceImageUrls = [], quality = 'draft', duration } = opts
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]
  for (const url of referenceImageUrls.slice(0, 9)) {
    content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' })
  }
  const body: Record<string, unknown> = {
    model: quality === 'final' ? ARK_MODELS.videoFinal : ARK_MODELS.videoDraft,
    content,
    ratio: '16:9',
    resolution: quality === 'final' ? '1080p' : '720p',
    generate_audio: quality === 'final',
  }
  if (duration) body.duration = Number(duration)

  const res = await fetch(`${ARK_BASE}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${arkKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || !json.id) {
    throw new Error(json?.error?.message || json?.message || `ModelArk createTask failed (${res.status})`)
  }
  return json.id as string
}

export type ArkTaskInfo = {
  state: 'waiting' | 'generating' | 'success' | 'fail'
  resultUrls: string[]
  progress: number
  failMsg: string
}

export async function arkGetVideoTask(taskId: string): Promise<ArkTaskInfo> {
  const res = await fetch(`${ARK_BASE}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${arkKey()}` },
    cache: 'no-store',
  })
  const json = await res.json()
  const status: string = json?.status || 'queued'
  if (status === 'succeeded') {
    const url = json?.content?.video_url
    return { state: 'success', resultUrls: url ? [url] : [], progress: 100, failMsg: '' }
  }
  if (status === 'failed' || status === 'cancelled' || status === 'expired') {
    return { state: 'fail', resultUrls: [], progress: 0, failMsg: json?.error?.message || json?.failure_reason || status }
  }
  return { state: status === 'running' ? 'generating' : 'waiting', resultUrls: [], progress: status === 'running' ? 50 : 5, failMsg: '' }
}

