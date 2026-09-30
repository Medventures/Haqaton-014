import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export function patientCodeFromUid(uid: string) {
  return `P-${uid.slice(0, 6).toUpperCase()}`
}

export async function firstDoctorId() {
  const snap = await getDocs(collection(db(), "doctors"))
  return snap.empty ? "" : snap.docs[0].id
}

export async function isDoctorAccount(uid: string) {
  const snap = await getDoc(doc(db(), "doctors", uid))
  return snap.exists()
}

export async function upsertClinicPatient(input: {
  uid: string
  email: string | null
  phone?: string
  name?: string
  age?: number
  sex?: string
  weightKg?: number
  heightCm?: number
  complaints?: string
}) {
  const existing = await getDoc(doc(db(), "clinic_patients", input.uid))
  const current = existing.data() ?? {}
  const doctorId = typeof current.doctorId === "string" && current.doctorId ? current.doctorId : await firstDoctorId()
  await setDoc(
    doc(db(), "clinic_patients", input.uid),
    {
      doctorId,
      name: input.name || (typeof current.name === "string" && current.name) || input.email || "Пациент",
      email: input.email ?? current.email ?? "",
      phone: input.phone ?? current.phone ?? "",
      patientCode: typeof current.patientCode === "string" && current.patientCode
        ? current.patientCode
        : patientCodeFromUid(input.uid),
      age: input.age ?? current.age ?? null,
      sex: input.sex ?? current.sex ?? "",
      weightKg: input.weightKg ?? current.weightKg ?? null,
      heightCm: input.heightCm ?? current.heightCm ?? null,
      role: "patient",
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
  return doctorId
}

export async function nextClinicSequence() {
  const snap = await getDocs(collection(db(), "clinic_requests"))
  return (
    snap.docs.reduce((current, item) => {
      const sequence = item.data().sequence
      return typeof sequence === "number" && sequence > current ? sequence : current
    }, 0) + 1
  )
}

export async function publishClinicRequest(input: {
  patientUid: string
  email: string | null
  phone: string
  encounterId: string
  tests: { name: string; priceKzt: number }[]
  totalKzt: number
  complaints: string
  anamnesis: string
  age?: number
  sex?: string
  weightKg?: number
  heightCm?: number
}) {
  const doctorId = await upsertClinicPatient({
    uid: input.patientUid,
    email: input.email,
    phone: input.phone,
    age: input.age,
    sex: input.sex,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    complaints: input.complaints,
  })
  const patient = await getDoc(doc(db(), "clinic_patients", input.patientUid))
  const data = patient.data() ?? {}
  const sequence = await nextClinicSequence()
  await addDoc(collection(db(), "clinic_requests"), {
    sequence,
    number: `З-${String(sequence).padStart(6, "0")}`,
    patientId: input.patientUid,
    patientCode: data.patientCode || patientCodeFromUid(input.patientUid),
    patientName: data.name || input.email || "Пациент",
    patientEmail: input.email ?? "",
    patientPhone: input.phone,
    birthDate: data.birthDate ?? "",
    age: input.age ?? data.age ?? null,
    sex: input.sex ?? data.sex ?? "",
    weightKg: input.weightKg ?? data.weightKg ?? null,
    heightCm: input.heightCm ?? data.heightCm ?? null,
    complaints: input.complaints,
    anamnesis: input.anamnesis,
    diagnoses: data.diagnoses ?? "",
    chronicDiseases: data.chronicDiseases ?? "",
    medications: data.medications ?? "",
    services: input.tests,
    program: "Персональный чекап",
    totalKzt: input.totalKzt,
    status: "new",
    cancelReason: "",
    cancelComment: "",
    doctorId,
    encounterId: input.encounterId,
    demo: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
