import type { Observation, PlannedStudy, StudyStatus } from "@/lib/domain/patient"

const STATUS: StudyStatus[] = [
  "recommended",
  "planned",
  "completed",
  "result_uploaded",
  "reviewed",
  "repeat_required",
]

const CATEGORY_HINTS: Array<[RegExp, Observation["category"]]> = [
  [/экг|электрокард|тропон|давлен|липид|холстерин|ldl|hdl|триглиц|сердц|эхокард/i, "cardiovascular"],
  [/ферритин|гемоглоб|анеми|железо|оак|общий анализ крови|mcv|mch/i, "iron"],
  [/глюк|hba1c|гликир|инсулин|bmi|массы тела|диабет/i, "metabolism"],
  [/alt|ast|алат|асат|ggt|билируб|печен/i, "liver"],
  [/креатин|скф|egfr|моч|почк/i, "kidney"],
  [/ттг|tsh|тирео|щитовид|т4|t4/i, "thyroid"],
]

export const STUDY_STATUS_LABEL: Record<StudyStatus, string> = {
  recommended: "Рекомендовано",
  planned: "Запланировано",
  completed: "Выполнено",
  result_uploaded: "Результат загружен",
  reviewed: "Проверено",
  repeat_required: "Нужен повтор",
}

export function categoryForStudy(name: string): Observation["category"] {
  for (const [pattern, category] of CATEGORY_HINTS) {
    if (pattern.test(name)) return category
  }
  return "other"
}

export function isDoneStatus(status: StudyStatus) {
  return status === "completed" || status === "result_uploaded" || status === "reviewed"
}

export function parseStudies(value: unknown): PlannedStudy[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return []
    const item = entry as Record<string, unknown>
    const name = typeof item.name === "string" ? item.name.trim() : ""
    if (!name) return []
    const status = STATUS.includes(item.status as StudyStatus)
      ? (item.status as StudyStatus)
      : "recommended"
    return [{
      id: typeof item.id === "string" && item.id ? item.id : `study-${index}-${name}`,
      name,
      why: typeof item.why === "string" ? item.why : "",
      priceKzt: typeof item.priceKzt === "number" ? item.priceKzt : 0,
      status,
    }]
  })
}

export function latestObservation(name: string, observations: Observation[]) {
  return observations.find((item) => item.name.toLowerCase() === name.toLowerCase())
}
