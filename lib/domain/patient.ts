import type { CheckupRecommendation } from "@/lib/recommendation"

export type DataMode = "live" | "demo"
export type Provenance =
  | "patient"
  | "laboratory"
  | "clinician"
  | "imported"
  | "derived"
  | "ai_recommendation"

export type EncounterStatus = "draft" | "active" | "completed"
export type StudyStatus =
  | "recommended"
  | "planned"
  | "completed"
  | "result_uploaded"
  | "reviewed"
  | "repeat_required"

export type PlannedStudy = {
  id: string
  name: string
  why: string
  priceKzt: number
  status: StudyStatus
}

export type Encounter = {
  id: string
  title: string
  complaints: string
  status: EncounterStatus
  createdAt: Date
  studies: PlannedStudy[]
  recommendation?: CheckupRecommendation
}

export type Observation = {
  id: string
  encounterId?: string
  code?: string
  name: string
  category: "cardiovascular" | "iron" | "metabolism" | "liver" | "kidney" | "thyroid" | "other"
  value: number
  unit?: string
  referenceMin?: number
  referenceMax?: number
  observedAt: Date
  provenance: Provenance
  verification: "self_reported" | "document_verified" | "provider_verified"
}

export type Reminder = {
  id: string
  title: string
  reason: string
  dueAt: Date
  status: "active" | "completed"
  encounterId?: string
  channel: "push" | "email" | "sms"
}

export type PlannedRoute = {
  id: string
  encounterId: string
  studyIds: string[]
  address: string
  latitude?: number
  longitude?: number
  plannedAt: Date
  status: "draft" | "planned" | "completed"
}

export const CATEGORY_LABELS: Record<Observation["category"], string> = {
  cardiovascular: "Сердечно-сосудистая система",
  iron: "Обмен железа",
  metabolism: "Глюкоза и метаболизм",
  liver: "Печень",
  kidney: "Почки",
  thyroid: "Щитовидная железа",
  other: "Другие показатели",
}

export function observationStatus(item: Observation) {
  if (item.referenceMin == null || item.referenceMax == null) return "Без референса"
  return item.value < item.referenceMin || item.value > item.referenceMax
    ? "Требует внимания"
    : "В норме"
}
