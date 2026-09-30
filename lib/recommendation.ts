export type CheckCategory = "laboratory" | "imaging" | "screening" | "functional" | "other"
export type CheckPriority = "routine" | "priority" | "urgent"
export type UrgencyLevel = "routine" | "priority" | "urgent" | "emergency"

export type RecommendedTest = {
  name: string
  category: CheckCategory
  why: string
  priority: CheckPriority
}

export type NamedReason = {
  name: string
  why: string
}

export type CheckupRecommendation = {
  summary: string
  recommended_checkup: RecommendedTest[]
  optional_tests: NamedReason[]
  not_needed_now: NamedReason[]
  doctor_visit: {
    recommended: boolean
    reason: string | null
  }
  urgency: {
    level: UrgencyLevel
    reason: string
  }
  source_basis: string[]
}

export type ToolStep = {
  name: string
  args?: Record<string, unknown>
  summary?: string
  status: "running" | "done" | "error"
}

export type RecommendationEvent =
  | { type: "steps"; steps: ToolStep[] }
  | { type: "result"; recommendation: CheckupRecommendation }
  | { type: "error"; error: string }

const CATEGORIES = new Set(["laboratory", "imaging", "screening", "functional", "other"])
const PRIORITIES = new Set(["routine", "priority", "urgent"])
const URGENCIES = new Set(["routine", "priority", "urgent", "emergency"])

export function isRecommendationEvent(value: unknown): value is RecommendationEvent {
  if (!value || typeof value !== "object") return false
  const event = value as Record<string, unknown>
  if (event.type === "error") return typeof event.error === "string"
  if (event.type === "steps") {
    return Array.isArray(event.steps) && event.steps.every((step) => {
      if (!step || typeof step !== "object") return false
      const item = step as Record<string, unknown>
      return typeof item.name === "string" && ["running", "done", "error"].includes(String(item.status))
    })
  }
  if (event.type !== "result" || !event.recommendation || typeof event.recommendation !== "object") return false
  const result = event.recommendation as Record<string, unknown>
  const visit = result.doctor_visit as Record<string, unknown> | undefined
  const urgency = result.urgency as Record<string, unknown> | undefined
  return (
    typeof result.summary === "string" &&
    Array.isArray(result.recommended_checkup) &&
    result.recommended_checkup.every((entry) => {
      if (!entry || typeof entry !== "object") return false
      const item = entry as Record<string, unknown>
      return typeof item.name === "string" && typeof item.why === "string" &&
        CATEGORIES.has(String(item.category)) && PRIORITIES.has(String(item.priority))
    }) &&
    Array.isArray(result.optional_tests) &&
    Array.isArray(result.not_needed_now) &&
    typeof visit?.recommended === "boolean" &&
    (visit.reason === null || typeof visit.reason === "string") &&
    URGENCIES.has(String(urgency?.level)) &&
    typeof urgency?.reason === "string" &&
    Array.isArray(result.source_basis) &&
    result.source_basis.every((source) => typeof source === "string")
  )
}

const PRICE_RULES: [RegExp, number][] = [
  [/тропон/, 5500],
  [/экг|электрокард/, 3000],
  [/давлени/, 1500],
  [/невролог/, 8000],
  [/ферритин/, 2800],
  [/общий анализ|гемоглоб/, 1800],
  [/ттг|тиреотроп|щитовид/, 2500],
  [/хгч|беремен/, 2200],
  [/узи|ультразв/, 8000],
  [/коагул|виллебранд/, 4500],
  [/анализ крови|кровь/, 2000],
]

export function indicativePriceKzt(name: string): number {
  const text = name.toLowerCase()
  for (const [pattern, price] of PRICE_RULES) {
    if (pattern.test(text)) return price
  }
  return 3500
}

export function formatPriceKzt(value: number): string {
  return `${new Intl.NumberFormat("ru-KZ").format(value)} ₸`
}
