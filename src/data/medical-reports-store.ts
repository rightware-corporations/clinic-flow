/**
 * Medical Reports Store (localStorage-based)
 * 
 * Backend integration point:
 * Replace these functions with API calls to your backend.
 * Each function maps to a typical REST endpoint:
 * - getReports → GET /api/reports
 * - getReport → GET /api/reports/:id
 * - saveReport → POST/PUT /api/reports
 * - deleteReport → DELETE /api/reports/:id
 * - getPatients → GET /api/patients
 */

import { MedicalReport, Patient } from "@/types/medical-reports";

const REPORTS_KEY = "medical_reports";
const PATIENTS_KEY = "clinic_patients";

// ============ MOCK PATIENTS ============

const defaultPatients: Patient[] = [
  { id: "C001", name: "João Silva", dateOfBirth: "1985-03-15", gender: "M", phone: "912345678", email: "joao@email.com", address: "Rua da Saúde 10, Lisboa", nif: "123456789", sns: "100000001" },
  { id: "C002", name: "Maria Santos", dateOfBirth: "1992-07-22", gender: "F", phone: "913456789", email: "maria@email.com", address: "Av. da Liberdade 50, Lisboa", nif: "234567890", sns: "100000002" },
  { id: "C003", name: "Pedro Costa", dateOfBirth: "1978-11-08", gender: "M", phone: "914567890", email: "pedro@email.com", address: "Rua dos Clérigos 25, Porto", nif: "345678901", sns: "100000003" },
  { id: "C004", name: "Ana Ferreira", dateOfBirth: "1990-01-30", gender: "F", phone: "915678901", email: "ana@email.com", address: "Rua Augusta 100, Lisboa", nif: "456789012", sns: "100000004" },
  { id: "C005", name: "Carlos Oliveira", dateOfBirth: "1965-06-12", gender: "M", phone: "916789012", email: "carlos@email.com", address: "Largo do Carmo 5, Lisboa", nif: "567890123", sns: "100000005" },
];

// ============ MOCK REPORTS ============

const defaultReports: MedicalReport[] = [
  {
    id: "RPT-001",
    type: "consultation",
    status: "finalized",
    patientId: "C001",
    patientName: "João Silva",
    doctorId: "doc-001",
    doctorName: "Dra. Ana Mendes",
    doctorSpecialty: "Medicina Geral e Familiar",
    createdAt: "2026-03-20T09:30:00Z",
    updatedAt: "2026-03-20T10:00:00Z",
    finalizedAt: "2026-03-20T10:00:00Z",
    symptoms: "Dores de cabeça frequentes há 2 semanas, especialmente ao final do dia. Cansaço geral.",
    diagnosis: "Cefaleia tensional. Possível relação com stress laboral.",
    observations: "Paciente refere período de grande stress no trabalho. Tensão arterial normal (120/80). Sem sinais neurológicos focais.",
    treatment: "Paracetamol 1g, 8/8h se dor. Técnicas de relaxamento. Reavaliar em 2 semanas.",
    notes: "Pedir análises de rotina na próxima consulta.",
  },
  {
    id: "RPT-002",
    type: "diagnostic",
    status: "finalized",
    patientId: "C002",
    patientName: "Maria Santos",
    doctorId: "doc-002",
    doctorName: "Dr. Ricardo Silva",
    doctorSpecialty: "Cardiologia",
    createdAt: "2026-03-21T14:00:00Z",
    updatedAt: "2026-03-21T14:45:00Z",
    finalizedAt: "2026-03-21T14:45:00Z",
    symptoms: "Palpitações esporádicas. Desconforto torácico leve ao esforço.",
    diagnosis: "Extrassístoles ventriculares isoladas, benignas. ECG sem alterações significativas.",
    observations: "ECG em repouso: ritmo sinusal, sem alterações ST. Ecocardiograma: função sistólica preservada, FEVE 65%.",
    treatment: "Sem necessidade de medicação específica. Evitar cafeína em excesso. Monitorizar.",
    notes: "Agendar Holter 24h para quantificação. Reavaliação em 3 meses.",
  },
  {
    id: "RPT-003",
    type: "follow_up",
    status: "draft",
    patientId: "C001",
    patientName: "João Silva",
    doctorId: "doc-001",
    doctorName: "Dra. Ana Mendes",
    doctorSpecialty: "Medicina Geral e Familiar",
    createdAt: "2026-03-24T09:30:00Z",
    updatedAt: "2026-03-24T09:30:00Z",
    symptoms: "Melhoria parcial das cefaleias. Mantém cansaço.",
    diagnosis: "",
    observations: "Resultados analíticos pendentes.",
    treatment: "",
    notes: "",
  },
  {
    id: "RPT-004",
    type: "prescription",
    status: "finalized",
    patientId: "C005",
    patientName: "Carlos Oliveira",
    doctorId: "doc-001",
    doctorName: "Dra. Ana Mendes",
    doctorSpecialty: "Medicina Geral e Familiar",
    createdAt: "2026-03-22T11:00:00Z",
    updatedAt: "2026-03-22T11:30:00Z",
    finalizedAt: "2026-03-22T11:30:00Z",
    symptoms: "Hipertensão arterial controlada. Diabetes tipo 2.",
    diagnosis: "HTA essencial. DM tipo 2 controlada.",
    observations: "TA: 135/85. HbA1c: 6.8%. Sem complicações.",
    treatment: "Ramipril 5mg/dia. Metformina 850mg, 2x/dia. Dieta hipocalórica e exercício regular.",
    notes: "Renovação de receituário crónico. Próxima consulta em 3 meses com análises.",
  },
];

// ============ PATIENTS CRUD ============

export function getPatients(): Patient[] {
  const stored = localStorage.getItem(PATIENTS_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fallback */ }
  }
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(defaultPatients));
  return [...defaultPatients];
}

export function getPatient(id: string): Patient | undefined {
  return getPatients().find((p) => p.id === id);
}

export function savePatient(patient: Patient): void {
  const patients = getPatients();
  const idx = patients.findIndex((p) => p.id === patient.id);
  if (idx >= 0) patients[idx] = patient;
  else patients.push(patient);
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients));
}

// ============ REPORTS CRUD ============

export function getReports(): MedicalReport[] {
  const stored = localStorage.getItem(REPORTS_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fallback */ }
  }
  localStorage.setItem(REPORTS_KEY, JSON.stringify(defaultReports));
  return [...defaultReports];
}

export function getReport(id: string): MedicalReport | undefined {
  return getReports().find((r) => r.id === id);
}

export function getReportsByPatient(patientId: string): MedicalReport[] {
  return getReports().filter((r) => r.patientId === patientId);
}

export function getReportsByDoctor(doctorId: string): MedicalReport[] {
  return getReports().filter((r) => r.doctorId === doctorId);
}

export function saveReport(report: MedicalReport): void {
  const reports = getReports();
  const idx = reports.findIndex((r) => r.id === report.id);
  if (idx >= 0) reports[idx] = { ...report, updatedAt: new Date().toISOString() };
  else reports.push({ ...report, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

export function deleteReport(id: string): void {
  const reports = getReports().filter((r) => r.id !== id);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

export function generateReportId(): string {
  const reports = getReports();
  const maxNum = reports.reduce((max, r) => {
    const num = parseInt(r.id.replace("RPT-", ""), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `RPT-${String(maxNum + 1).padStart(3, "0")}`;
}
