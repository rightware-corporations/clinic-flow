/** Preparatory real API client; old mock auth UI is not connected yet. */
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
