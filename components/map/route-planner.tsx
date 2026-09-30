"use client"

import "mapbox-gl/dist/mapbox-gl.css"
import { useEffect, useState } from "react"
import MapboxMap, { Marker } from "react-map-gl/mapbox"
import { Crosshair, MapPin, Search } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { listEncounters } from "@/lib/repositories/patient-repository"
import { savePlannedRoute } from "@/lib/repositories/patient-repository"
import type { PlannedStudy } from "@/lib/domain/patient"

type Place = {
  id: string
  name: string
  address: string
  longitude: number
  latitude: number
  source: "Mapbox"
}

export function RoutePlanner() {
  const { user } = useAuth()
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const [studies, setStudies] = useState<PlannedStudy[]>([])
  const [encounterId, setEncounterId] = useState("")
  const [selectedStudies, setSelectedStudies] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [places, setPlaces] = useState<Place[]>([])
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [date, setDate] = useState("")
  const [time, setTime] = useState("09:00")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    void listEncounters(user.uid).then((items) => {
      const active = items.find((item) => item.status === "active")
      const next = active?.studies ?? []
      setEncounterId(active?.id ?? "")
      setStudies(next)
      setSelectedStudies(next.map((item) => item.id))
    }).catch(() => {})
  }, [user])

  async function search() {
    if (!query.trim()) return
    setLoading(true); setError("")
    try {
      const response = await fetch(`/api/map/search?q=${encodeURIComponent(query)}`)
      const data = await response.json() as { places?: Place[]; error?: string }
      if (!response.ok) { setError(data.error ?? "Поиск недоступен."); return }
      setPlaces(data.places ?? [])
    } catch {
      setError("Поиск мест сейчас недоступен.")
    } finally {
      setLoading(false)
    }
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        setQuery(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`)
        setError("")
      },
      () => setError("Не удалось получить местоположение. Разрешите доступ или введите адрес."),
    )
  }

  async function savePlan() {
    if (!user || !encounterId || !selectedPlace || !date || selectedStudies.length === 0) {
      setError("Выберите исследования, место и дату.")
      return
    }
    setLoading(true)
    setError("")
    try {
      await savePlannedRoute(user.uid, {
        id: crypto.randomUUID(),
        encounterId,
        studyIds: selectedStudies,
        address: selectedPlace.address,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        plannedAt: new Date(`${date}T${time}`),
        status: "planned",
      })
      setError("Маршрут сохранён.")
    } catch {
      setError("Не удалось сохранить маршрут.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="mb-6"><h1 className="text-2xl font-semibold tracking-tight">Маршрут чекапа</h1><p className="mt-1 text-sm text-muted-foreground">Выберите удобное место и планируемое время прохождения обследований.</p></header>
      {!token ? <Alert className="mb-4"><MapPin /><AlertTitle>Карта пока не настроена</AlertTitle><AlertDescription>Добавьте NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN. Планирование исследований доступно, но поиск мест отключён.</AlertDescription></Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card><CardHeader><CardTitle>1. Местоположение</CardTitle></CardHeader><CardContent className="space-y-2"><label className="text-sm font-medium" htmlFor="route-address">Ваш район или адрес</label><div className="flex gap-2"><Input id="route-address" placeholder="Например, Бостандыкский район" value={query} onChange={(e) => setQuery(e.target.value)} /><Button size="icon" aria-label="Найти медицинские организации" onClick={() => void search()} disabled={loading || !token}><Search /></Button></div><Button variant="outline" className="w-full" onClick={locate}><Crosshair />Использовать моё местоположение</Button>{error ? <p className="text-sm text-destructive">{error}</p> : null}</CardContent></Card>
          <Card><CardHeader><CardTitle>2. Что нужно пройти</CardTitle><CardDescription>Выбрано {selectedStudies.length} из {studies.length}</CardDescription></CardHeader><CardContent className="space-y-3">{studies.length ? studies.map((study) => <label key={study.id} className="flex items-center gap-3 text-sm"><Checkbox checked={selectedStudies.includes(study.id)} onCheckedChange={(checked) => setSelectedStudies((current) => checked ? [...current, study.id] : current.filter((id) => id !== study.id))} />{study.name}</label>) : <p className="text-sm text-muted-foreground">Сначала создайте обращение и выберите исследования.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>3. Планируемое время</CardTitle><CardDescription>Это план, а не подтверждённая запись.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-2"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></CardContent></Card>
        </div>
        <div className="space-y-4">
          {token ? <div className="h-[360px] overflow-hidden rounded-xl border md:h-[520px]"><MapboxMap mapboxAccessToken={token} initialViewState={{ longitude: selectedPlace?.longitude ?? 76.89, latitude: selectedPlace?.latitude ?? 43.24, zoom: selectedPlace ? 13 : 10 }} mapStyle="mapbox://styles/mapbox/streets-v12">{places.map((place) => <Marker key={place.id} longitude={place.longitude} latitude={place.latitude} onClick={() => setSelectedPlace(place)}><MapPin className="size-7 fill-primary text-primary" /></Marker>)}</MapboxMap></div> : <div className="grid h-[360px] place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">Карта появится после настройки Mapbox</div>}
          <div className="grid gap-3 sm:grid-cols-2">{places.map((place) => <Card key={place.id} className={selectedPlace?.id === place.id ? "border-primary" : ""}><CardHeader><CardTitle>{place.name}</CardTitle><CardDescription>{place.address}</CardDescription></CardHeader><CardContent><p className="mb-3 text-xs text-muted-foreground">Место найдено через Mapbox. Наличие исследований и часы работы не подтверждены.</p><Button variant="outline" onClick={() => setSelectedPlace(place)}>Выбрать</Button></CardContent></Card>)}</div>
          {selectedPlace ? <Card><CardHeader><CardDescription>Ваш план</CardDescription><CardTitle>{selectedPlace.name}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{selectedPlace.address}</p><p>{date || "Дата не выбрана"} · {time}</p><p>{selectedStudies.length} исследований</p><Button className="mt-2" disabled={loading} onClick={() => void savePlan()}>Сохранить план</Button></CardContent></Card> : null}
        </div>
      </div>
    </>
  )
}
