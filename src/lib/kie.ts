// ─────────────────────────────────────────────────────────────
// KIE.AI CLIENT — server-side only (uses KIE_API_KEY)
// One provider covers: Seedance 2.0 video, Nano Banana image
// fallback. Docs: https://docs.kie.ai
// ─────────────────────────────────────────────────────────────

const KIE_BASE = 'https://api.kie.ai/api/v1'

export type KieTaskState = 'waiting' | 'queuing' | 'generating' | 'success' | 'fail'

export type KieTaskInfo = {
  taskId: string
  state: KieTaskState
  resultUrls: string[]
  progress: number
  failMsg: string
  creditsConsumed?: number
}

function kieKey(): string {
  const key = process.env.KIE_API_KEY
  if (!key) throw new Error('KIE_API_KEY is not configured')
  return key
}

export async function kieCreateTask(
  model: string,
  input: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kieKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input }),
  })
  const json = await res.json()
  if (!res.ok || json.code !== 200 || !json.data?.taskId) {
    throw new Error(json.msg || `kie.ai createTask failed (${res.status})`)
  }
  return json.data.taskId as string
}

export async function kieGetTask(taskId: string): Promise<KieTaskInfo> {
  const res = await fetch(
    `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${kieKey()}` }, cache: 'no-store' },
  )
  const json = await res.json()
  const d = json.data || {}
  let resultUrls: string[] = []
  try {
    const parsed = d.resultJson ? JSON.parse(d.resultJson) : {}
    resultUrls = parsed.resultUrls || []
  } catch {
    /* resultJson not ready yet */
  }
  return {
    taskId: d.taskId || taskId,
    state: (d.state as KieTaskState) || 'waiting',
    resultUrls,
    progress: typeof d.progress === 'number' ? d.progress : 0,
    failMsg: d.failMsg || '',
    creditsConsumed: d.creditsConsumed,
  }
}

// ── Model registry (edit here to swap models / control cost) ──
export const KIE_MODELS = {
  videoDraft: 'bytedance/seedance-2-fast', // cheap draft pass
  videoFinal: 'bytedance/seedance-2',      // hero-quality final
  imageFallback: 'google/nano-banana',     // asset generation fallback
} as const
