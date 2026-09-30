import { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const recentRequests = new Map<string, number>()

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!token || !apiKey) return Response.json({ error: "Нужен вход в аккаунт." }, { status: 401 })
  const identity = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
  )
  const identityData = await identity.json().catch(() => null) as { users?: Array<{ localId?: string }> } | null
  const uid = identityData?.users?.[0]?.localId
  if (!identity.ok || !uid) return Response.json({ error: "Сессия истекла. Войдите снова." }, { status: 401 })
  const lastRequest = recentRequests.get(uid) ?? 0
  if (Date.now() - lastRequest < 5_000) {
    return Response.json({ error: "Подождите несколько секунд и повторите." }, { status: 429 })
  }
  recentRequests.set(uid, Date.now())

  const origin = process.env.MEDLIB_ORIGIN || "http://127.0.0.1:3000"
  const body = await request.text()
  if (body.length > 20_000) return Response.json({ error: "Данные анкеты слишком длинные." }, { status: 413 })
  let upstream: Response
  try {
    upstream = await fetch(`${origin}/api/patient-recommendation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
  } catch {
    return Response.json({ error: "Сервис подбора сейчас недоступен." }, { status: 503 })
  }

  const contentType = upstream.headers.get("content-type") || ""
  if (!upstream.ok || !contentType.includes("text/event-stream") || !upstream.body) {
    const data = (await upstream.json().catch(() => null)) as { error?: string } | null
    return Response.json(
      { error: data?.error || "Не удалось получить ответ." },
      { status: upstream.status || 503 },
    )
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  })
}
