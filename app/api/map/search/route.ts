import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim()
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  if (!query) return Response.json({ error: "Укажите адрес или район." }, { status: 400 })
  if (!token) return Response.json({ error: "Mapbox пока не настроен." }, { status: 503 })

  const params = new URLSearchParams({
    q: `${query} медицинская лаборатория`,
    access_token: token,
    language: "ru",
    country: "KZ",
    limit: "8",
    types: "poi",
  })
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, {
    next: { revalidate: 300 },
  })
  if (!response.ok) return Response.json({ error: "Поиск мест сейчас недоступен." }, { status: 502 })
  const data = await response.json() as {
    features?: Array<{
      id: string
      geometry?: { coordinates?: [number, number] }
      properties?: { name?: string; full_address?: string; place_formatted?: string }
    }>
  }
  const places = (data.features ?? []).flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates
    if (!coordinates) return []
    return [{
      id: feature.id,
      name: feature.properties?.name ?? "Медицинская организация",
      address: feature.properties?.full_address ?? feature.properties?.place_formatted ?? query,
      longitude: coordinates[0],
      latitude: coordinates[1],
      source: "Mapbox",
    }]
  })
  return Response.json({ places })
}
