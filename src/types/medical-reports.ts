/**
 * Medical Report Types
 * 
 * Core data structures for the medical reporting system.
 * These types define the report lifecycle: draft → finalized.
 * 
 * Backend integration point:
 * Replace localStorage calls in src/data/medical-reports-store.ts
 * with API calls when backend is connected.
 */

export type ReportType = "consultation" | "diagnostic" | "follow_up" | "prescription";
export type ReportStatus = "draft" | "finalized";

export const reportTypeLabels: Record<ReportType, string> = {
  consultation: "Relatório de Consulta",
  diagnostic: "Relatório Diagnóstico",
  follow_up: "Relatório de Seguimento",
  prescription: "Resumo de Prescrição",
};

export const reportStatusLabels: Record<ReportStatus, string> = {
  draft: "Rascunho",
  finalized: "Finalizado",
};

export interface MedicalReport {
  id: string;
  type: ReportType;
  status: ReportStatus;
  
  // Patient info
  patientId: string;
  patientName: string;
  
  // Doctor info
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  
  // Timestamps
  createdAt: string; // ISO date
  updatedAt: string;
  finalizedAt?: string;
  
  // Clinical data (structured sections)
  symptoms: string;
  diagnosis: string;
  observations: string;
  treatment: string;
  notes: string;
  
  // Optional appointment reference
  appointmentId?: string;
}

export interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: "M" | "F" | "Outro";
  phone: string;
  email: string;
  address: string;
  nif: string; // Tax ID (Portuguese)
  sns: string; // National Health Service number
}
