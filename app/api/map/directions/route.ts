import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from")
  const to = request.nextUrl.searchParams.get("to")
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  if (!from || !to) return Response.json({ error: "Нужны начальная и конечная точки." }, { status: 400 })
  if (!token) return Response.json({ error: "Mapbox пока не настроен." }, { status: 503 })
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${encodeURIComponent(from)};${encodeURIComponent(to)}?overview=geojson&access_token=${token}`,
    { next: { revalidate: 60 } },
  )
  if (!response.ok) return Response.json({ error: "Маршрут сейчас недоступен." }, { status: 502 })
  const data = await response.json() as { routes?: Array<{ distance: number; duration: number; geometry: unknown }> }
  const route = data.routes?.[0]
  if (!route) return Response.json({ error: "Маршрут не найден." }, { status: 404 })
  return Response.json({
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry,
  })
}
