import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type {
  Encounter,
  Observation,
  PlannedRoute,
  Reminder,
} from "@/lib/domain/patient"
import type { CheckupRecommendation } from "@/lib/recommendation"
import { categoryForStudy, parseStudies } from "@/lib/domain/study-map"

function dateOf(value: unknown): Date {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate(): Date }).toDate()
  }
  return new Date()
}

function encounterFromDoc(id: string, data: Record<string, unknown>): Encounter {
  return {
    id,
    title: typeof data.title === "string" ? data.title : "Чекап",
    complaints: typeof data.complaints === "string" ? data.complaints : "",
    status: data.status === "completed" || data.status === "draft" ? data.status : "active",
    createdAt: dateOf(data.createdAt),
    studies: parseStudies(data.studies),
    recommendation:
      data.recommendation && typeof data.recommendation === "object"
        ? (data.recommendation as CheckupRecommendation)
        : undefined,
  }
}

export async function listEncounters(uid: string): Promise<Encounter[]> {
  const ref = collection(db(), "users", uid, "encounters")
  let snap
  try {
    snap = await getDocs(query(ref, orderBy("createdAt", "desc")))
  } catch {
    snap = await getDocs(ref)
  }
  const encounters = snap.docs.map((item) => encounterFromDoc(item.id, item.data()))
  if (encounters.length > 0) {
    return encounters.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  const requests = await getDocs(collection(db(), "users", uid, "requests")).catch(() => null)
  if (!requests || requests.empty) return []
  return requests.docs.map((item) => {
    const data = item.data()
    const tests = Array.isArray(data.tests) ? data.tests : []
    return {
      id: item.id,
      title: "Заявка на обследования",
      complaints: "",
      status: "active" as const,
      createdAt: dateOf(data.createdAt),
      studies: parseStudies(
        tests.map((test: { name?: string; priceKzt?: number }, index: number) => ({
          id: `${item.id}-${index}`,
          name: test.name,
          why: "",
          priceKzt: test.priceKzt,
          status: "recommended",
        })),
      ),
    }
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export async function getEncounter(uid: string, encounterId: string): Promise<Encounter | null> {
  const items = await listEncounters(uid)
  return items.find((item) => item.id === encounterId) ?? null
}

export async function updateEncounterStudies(
  uid: string,
  encounterId: string,
  studies: Encounter["studies"],
) {
  await updateDoc(doc(db(), "users", uid, "encounters", encounterId), {
    studies,
    updatedAt: serverTimestamp(),
  })
}

export async function saveStudyResult(
  uid: string,
  encounter: Encounter,
  studyId: string,
  value: number,
  unit?: string,
) {
  const study = encounter.studies.find((item) => item.id === studyId)
  if (!study) throw new Error("Исследование не найдено")
  const studies = encounter.studies.map((item) =>
    item.id === studyId ? { ...item, status: "result_uploaded" as const } : item,
  )
  await Promise.all([
    updateEncounterStudies(uid, encounter.id, studies),
    saveObservation(uid, {
      encounterId: encounter.id,
      name: study.name,
      category: categoryForStudy(study.name),
      value,
      unit,
      observedAt: new Date(),
      provenance: "patient",
      verification: "self_reported",
    }),
  ])
  return studies
}

export async function createEncounter(
  uid: string,
  input: Omit<Encounter, "id" | "createdAt">,
) {
  const ref = await addDoc(collection(db(), "users", uid, "encounters"), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function saveEncounterRecommendation(
  uid: string,
  encounterId: string,
  recommendation: CheckupRecommendation,
) {
  await updateDoc(doc(db(), "users", uid, "encounters", encounterId), {
    recommendation,
    updatedAt: serverTimestamp(),
  })
}

export async function listObservations(uid: string): Promise<Observation[]> {
  const snap = await getDocs(
    query(collection(db(), "users", uid, "observations"), orderBy("observedAt", "desc")),
  )
  return snap.docs.flatMap((item) => {
    const data = item.data()
    if (typeof data.name !== "string" || typeof data.value !== "number") return []
    return [{
      id: item.id,
      encounterId: typeof data.encounterId === "string" ? data.encounterId : undefined,
      code: typeof data.code === "string" ? data.code : undefined,
      name: data.name,
      category: data.category ?? "other",
      value: data.value,
      unit: typeof data.unit === "string" ? data.unit : undefined,
      referenceMin: typeof data.referenceMin === "number" ? data.referenceMin : undefined,
      referenceMax: typeof data.referenceMax === "number" ? data.referenceMax : undefined,
      observedAt: dateOf(data.observedAt),
      provenance: data.provenance ?? "patient",
      verification: data.verification ?? "self_reported",
    } satisfies Observation]
  })
}

export async function saveObservation(uid: string, input: Omit<Observation, "id">) {
  await addDoc(collection(db(), "users", uid, "observations"), input)
}

export async function listReminders(uid: string): Promise<Reminder[]> {
  const snap = await getDocs(
    query(collection(db(), "users", uid, "reminders"), orderBy("dueAt", "asc")),
  )
  return snap.docs.map((item) => {
    const data = item.data()
    return {
      id: item.id,
      title: typeof data.title === "string" ? data.title : "Напоминание",
      reason: typeof data.reason === "string" ? data.reason : "",
      dueAt: dateOf(data.dueAt),
      status: data.status === "completed" ? "completed" : "active",
      encounterId: typeof data.encounterId === "string" ? data.encounterId : undefined,
      channel: data.channel === "email" || data.channel === "sms" ? data.channel : "push",
    }
  })
}

export async function saveReminder(uid: string, input: Omit<Reminder, "id">) {
  await addDoc(collection(db(), "users", uid, "reminders"), input)
}

export async function savePlannedRoute(uid: string, input: PlannedRoute) {
  await setDoc(doc(db(), "users", uid, "routes", input.id), {
    ...input,
    updatedAt: serverTimestamp(),
  })
}

export async function saveFeedback(uid: string, message: string) {
  await addDoc(collection(db(), "users", uid, "feedback"), {
    message: message.trim(),
    topic: "general",
    createdAt: serverTimestamp(),
  })
}
