/** Typed same-origin API; Spring session + CSRF + verified tenant membership remain authoritative. */
export type ClinicMembership = {
  tenantId: string;
  clinicName: string;
  role: "CLINIC_ADMIN" | "RECEPTION" | "PRACTITIONER" | "INTERN" | "PATIENT";
};

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  memberships: ClinicMembership[];
};

let csrf: { header: string; token: string } | null = null;

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`ClinicFlow API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function refreshCsrf(): Promise<void> {
  csrf = await readJson<{ header: string; token: string }>(
    await fetch("/api/v1/auth/csrf", { credentials: "same-origin" }),
  );
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  await refreshCsrf();
  const body = new URLSearchParams({ email, password });
  await readJson(await fetch("/api/v1/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/x-www-form-urlencoded",
      [csrf!.header]: csrf!.token },
    body,
  }));
  await refreshCsrf();
  return readJson<CurrentUser>(
    await fetch("/api/v1/me", { credentials: "same-origin" }),
  );
}

export async function me(): Promise<CurrentUser> {
  return readJson<CurrentUser>(
    await fetch("/api/v1/me", { credentials: "same-origin" }),
  );
}

export async function tenantGet<T>(path: string, tenantId: string): Promise<T> {
  if (!path.startsWith("/api/v1/")) throw new Error("Expected a versioned API path");
  return readJson<T>(await fetch(path, {
    credentials: "same-origin",
    headers: { "X-Clinicflow-Tenant": tenantId },
  }));
}

export async function tenantMutation<T>(
  path: string, tenantId: string, method: "POST" | "PUT", body?: unknown,
): Promise<T> {
  if (!path.startsWith("/api/v1/")) throw new Error("Expected a versioned API path");
  if (!csrf) await refreshCsrf();
  return readJson<T>(await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "X-Clinicflow-Tenant": tenantId,
      "Content-Type": "application/json", [csrf!.header]: csrf!.token },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

export async function updateProfile(displayName: string): Promise<CurrentUser> {
  if (!csrf) await refreshCsrf();
  return readJson<CurrentUser>(await fetch("/api/v1/me", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", [csrf!.header]: csrf!.token },
    body: JSON.stringify({ displayName }),
  }));
}

export async function logout(): Promise<void> {
  await refreshCsrf();
  await readJson(await fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { [csrf!.header]: csrf!.token },
  }));
  csrf = null;
}


export type PatientGender = "M" | "F" | "OTHER" | "NOT_DISCLOSED";
export type PatientRecord = {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: PatientGender;
  phone: string | null;
  email: string | null;
  address: string | null;
  nationalId: string | null;
  healthNumber: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type PatientInput = Omit<PatientRecord, "id" | "createdAt" | "updatedAt"> & {
  version?: number;
};
export type PatientPage = {
  items: PatientRecord[];
  total: number;
  page: number;
  size: number;
};

export function activeTenantId(): string {
  const tenant = sessionStorage.getItem("clinicflow:tenant");
  if (!tenant) throw new Error("No active ClinicFlow tenant");
  return tenant;
}

export async function listPatients(query = "", page = 0, size = 50): Promise<PatientPage> {
  const params = new URLSearchParams({ query, page: String(page), size: String(size) });
  return tenantGet<PatientPage>(`/api/v1/patients?${params}`, activeTenantId());
}

export async function getPatientRecord(id: string): Promise<PatientRecord> {
  return tenantGet<PatientRecord>(`/api/v1/patients/${encodeURIComponent(id)}`, activeTenantId());
}

export async function createPatient(input: Omit<PatientInput, "version">): Promise<PatientRecord> {
  return tenantMutation<PatientRecord>("/api/v1/patients", activeTenantId(), "POST", input);
}

export async function updatePatient(id: string, input: PatientInput): Promise<PatientRecord> {
  return tenantMutation<PatientRecord>(`/api/v1/patients/${encodeURIComponent(id)}`,
    activeTenantId(), "PUT", input);
}

export async function archivePatient(id: string, version: number): Promise<void> {
  await tenantMutation<unknown>(`/api/v1/patients/${encodeURIComponent(id)}/archive`,
    activeTenantId(), "POST", { version });
}


// CF-B3: professional directory (the server authorizes every tenant-scoped request).
export type Specialty = { id: string; name: string; code: string; active: boolean };
export type ClinicUnitRecord = { id: string; name: string; address: string | null; active: boolean };
export type ClinicServiceRecord = {
  id: string; name: string; slug: string; durationMinutes: number; active: boolean;
  price: number | null; currencyCode: string | null;
};
export type EligibleProfessional = {
  userId: string; displayName: string; email: string;
  role: "PRACTITIONER" | "INTERN";
};
export type Professional = {
  userId: string; displayName: string; email: string;
  specialtyId: string | null; specialtyName: string | null;
  professionalTitle: string | null; licenseNumber: string | null; bio: string | null;
  unitIds: string[]; serviceIds: string[];
  active: boolean; version: number;
};
export type ProfessionalInput = {
  userId: string; specialtyId: string | null;
  professionalTitle: string | null; licenseNumber: string | null; bio: string | null;
  unitIds: string[]; serviceIds: string[]; version?: number;
};
export function listSpecialties(): Promise<Specialty[]> {
  return tenantGet<Specialty[]>("/api/v1/specialties", activeTenantId());
}
export function addSpecialty(input: {name: string; code: string}): Promise<Specialty> {
  return tenantMutation<Specialty>("/api/v1/specialties", activeTenantId(), "POST", input);
}
export function editSpecialty(id: string, input: {name: string; code: string}): Promise<Specialty> {
  return tenantMutation<Specialty>("/api/v1/specialties/" + encodeURIComponent(id),
    activeTenantId(), "PUT", input);
}
export function setSpecialtyActive(id: string, active: boolean): Promise<Specialty> {
  return tenantMutation<Specialty>("/api/v1/specialties/" + encodeURIComponent(id)
    + (active ? "/reactivate" : "/deactivate"), activeTenantId(), "POST");
}
export function listProfessionals(): Promise<Professional[]> {
  return tenantGet<Professional[]>("/api/v1/practitioners", activeTenantId());
}
export function listEligibleProfessionals(): Promise<EligibleProfessional[]> {
  return tenantGet<EligibleProfessional[]>("/api/v1/practitioners/eligible-members", activeTenantId());
}
export function listClinicUnits(): Promise<ClinicUnitRecord[]> {
  return tenantGet<ClinicUnitRecord[]>("/api/v1/clinic-units", activeTenantId());
}
export function listClinicServices(): Promise<ClinicServiceRecord[]> {
  return tenantGet<ClinicServiceRecord[]>("/api/v1/services", activeTenantId());
}
export function addProfessional(input: ProfessionalInput): Promise<Professional> {
  return tenantMutation<Professional>("/api/v1/practitioners", activeTenantId(), "POST", input);
}
export function editProfessional(input: ProfessionalInput): Promise<Professional> {
  return tenantMutation<Professional>("/api/v1/practitioners/" + encodeURIComponent(input.userId),
    activeTenantId(), "PUT", input);
}
export function setProfessionalActive(userId: string, version: number, active: boolean): Promise<Professional> {
  return tenantMutation<Professional>("/api/v1/practitioners/" + encodeURIComponent(userId)
    + (active ? "/reactivate" : "/deactivate"), activeTenantId(), "POST", {version});
}


// CF-B5: INTERNAL appointment workflow. Public BookingPage remains a demo.
export type BookableProfessional = {
  userId: string; displayName: string;
  professionalTitle: string | null; specialtyName: string | null;
  unitIds: string[]; serviceIds: string[];
};
export type AppointmentStatus =
  "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type ClinicAppointment = {
  id: string; patientId: string; practitionerUserId: string;
  unitId: string; serviceId: string; startsAt: string; endsAt: string;
  status: AppointmentStatus; version: number;
  patientName: string; practitionerName: string; unitName: string; serviceName: string;
};
export type NewAppointment = {
  patientId: string; practitionerUserId: string;
  unitId: string; serviceId: string; startsAt: string;
};
export type AvailabilitySlot = { startsAt: string; endsAt: string; unitId: string };
export type SlotPreview = {
  date: string; practitionerUserId: string; serviceId: string;
  serviceDurationMinutes: number; slots: AvailabilitySlot[];
};
export type AppointmentCommand = "confirm" | "start" | "complete" | "cancel" | "no-show";

export function listBookableProfessionals(): Promise<BookableProfessional[]> {
  return tenantGet<BookableProfessional[]>("/api/v1/practitioners/bookable", activeTenantId());
}
export function listAppointments(from: string, to: string): Promise<ClinicAppointment[]> {
  const qs = new URLSearchParams({from,to});
  return tenantGet<ClinicAppointment[]>("/api/v1/appointments?" + qs, activeTenantId());
}
export function getSlotPreview(
  practitionerUserId: string, serviceId: string, date: string,
): Promise<SlotPreview> {
  const qs = new URLSearchParams({practitionerUserId,serviceId,date});
  return tenantGet<SlotPreview>("/api/v1/scheduling/slot-preview?" + qs, activeTenantId());
}
export async function createAppointment(
  input: NewAppointment, idempotencyKey: string,
): Promise<ClinicAppointment> {
  if (!csrf) await refreshCsrf();
  return readJson<ClinicAppointment>(await fetch("/api/v1/appointments", {
    method: "POST", credentials: "same-origin",
    headers: {
      "X-Clinicflow-Tenant": activeTenantId(),
      "Idempotency-Key": idempotencyKey,
      "Content-Type": "application/json",
      [csrf!.header]: csrf!.token,
    },
    body: JSON.stringify(input),
  }));
}
export function commandAppointment(
  id: string, command: AppointmentCommand, version: number,
): Promise<ClinicAppointment> {
  return tenantMutation<ClinicAppointment>(
    "/api/v1/appointments/" + encodeURIComponent(id) + "/" + command,
    activeTenantId(), "POST", {version},
  );
}
export function rescheduleAppointment(
  id: string, input: {version: number; unitId: string; startsAt: string},
): Promise<ClinicAppointment> {
  return tenantMutation<ClinicAppointment>(
    "/api/v1/appointments/" + encodeURIComponent(id) + "/reschedule",
    activeTenantId(), "POST", input,
  );
}


// CF-B6B: private clinical reports. Do not persist report content to browser storage.
export type ClinicalReportType = "CONSULTATION" | "DIAGNOSTIC" | "FOLLOW_UP";
export type ClinicalReportStatus = "DRAFT" | "FINALIZED";
export type ClinicalReportSummary = {
  id: string; appointmentId: string; patientId: string; patientName: string;
  reportType: ClinicalReportType; status: ClinicalReportStatus; version: number;
  createdAt: string; updatedAt: string; finalizedAt: string | null;
};
export type ClinicalReportPage = {
  items: ClinicalReportSummary[]; total: number; page: number; size: number;
};
export type ClinicalAddendum = {
  id: string; reportId: string; authorId: string; content: string; createdAt: string;
};
export type ClinicalReportDetail = {
  summary: ClinicalReportSummary;
  symptoms: string; diagnosis: string; observations: string; treatment: string; notes: string;
  addenda: ClinicalAddendum[];
};
export type ClinicalReportInput = {
  appointmentId: string; reportType: ClinicalReportType;
  symptoms: string; diagnosis: string; observations: string;
  treatment: string; notes: string; version?: number;
};
export type EligibleClinicalEncounter = {
  id: string; patientId: string; patientName: string;
  startsAt: string; status: "IN_PROGRESS" | "COMPLETED"; serviceName: string;
};
export function listClinicalReports(page = 0): Promise<ClinicalReportPage> {
  return tenantGet<ClinicalReportPage>(
    "/api/v1/clinical-reports?page=" + encodeURIComponent(page), activeTenantId(),
  );
}
export function listEligibleClinicalEncounters(): Promise<EligibleClinicalEncounter[]> {
  return tenantGet<EligibleClinicalEncounter[]>(
    "/api/v1/clinical-reports/eligible-appointments", activeTenantId(),
  );
}
export function getClinicalReport(id: string): Promise<ClinicalReportDetail> {
  return tenantGet<ClinicalReportDetail>(
    "/api/v1/clinical-reports/" + encodeURIComponent(id), activeTenantId(),
  );
}
export function createClinicalReport(input: ClinicalReportInput): Promise<ClinicalReportDetail> {
  return tenantMutation<ClinicalReportDetail>(
    "/api/v1/clinical-reports", activeTenantId(), "POST", input,
  );
}
export function updateClinicalReport(
  id: string, input: ClinicalReportInput,
): Promise<ClinicalReportDetail> {
  return tenantMutation<ClinicalReportDetail>(
    "/api/v1/clinical-reports/" + encodeURIComponent(id), activeTenantId(), "PUT", input,
  );
}
export function finalizeClinicalReport(id: string, version: number): Promise<ClinicalReportDetail> {
  return tenantMutation<ClinicalReportDetail>(
    "/api/v1/clinical-reports/" + encodeURIComponent(id) + "/finalize",
    activeTenantId(), "POST", { version },
  );
}
export async function createClinicalAddendum(
  id: string, content: string, idempotencyKey: string,
): Promise<ClinicalAddendum> {
  if (!csrf) await refreshCsrf();
  return readJson<ClinicalAddendum>(await fetch(
    "/api/v1/clinical-reports/" + encodeURIComponent(id) + "/addenda",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-Clinicflow-Tenant": activeTenantId(),
        "Idempotency-Key": idempotencyKey,
        "Content-Type": "application/json",
        [csrf!.header]: csrf!.token,
      },
      body: JSON.stringify({ content: content.trim() }),
    },
  ));
}
