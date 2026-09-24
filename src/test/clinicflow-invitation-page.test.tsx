import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AcceptInvitationPage from "@/pages/AcceptInvitationPage";
import { inspectInvitation } from "@/lib/clinicflow-api";

vi.mock("@/lib/clinicflow-api",()=>({
  inspectInvitation:vi.fn(),
  acceptInvitation:vi.fn(),
}));

beforeEach(()=>{
  vi.mocked(inspectInvitation).mockReset();
  window.history.replaceState(null,"","/convite#unit-test-secret-token-1234567890");
});

describe("invitation acceptance page",()=>{
  it("consumes the fragment then removes the secret from the visible URL",async()=>{
    vi.mocked(inspectInvitation).mockResolvedValue({
      displayName:"Synthetic Practitioner",
      email:"person@example.invalid",
      role:"PRACTITIONER",
      clinicName:"Synthetic Clinic",
      expiresAt:"2026-10-01T00:00:00Z",
      existingAccount:false,
    });
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AcceptInvitationPage/></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Synthetic Clinic")).toBeInTheDocument();
    expect(inspectInvitation).toHaveBeenCalledWith("unit-test-secret-token-1234567890");
    await waitFor(()=>expect(window.location.hash).toBe(""));
  });
});
