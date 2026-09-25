import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/layout/PageTransition";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ServicesPage from "./pages/Services";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import BookingPage from "./pages/BookingPage";
import LoginPage from "./pages/LoginPage";
import PatientDashboard from "./pages/PatientDashboard";
import PractitionerDashboard from "./pages/PractitionerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import SuperDashboard from "./pages/SuperDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import ReceptionQueuePage from "./pages/ReceptionQueuePage";
import InternDashboard from "./pages/InternDashboard";
import NursingDashboardPage from "./pages/NursingDashboardPage";
import NursingObservationPage from "./pages/NursingObservationPage";
import PractitionerNursingObservationPage from "./pages/PractitionerNursingObservationPage";
import AdminNursingAssignmentsPage from "./pages/AdminNursingAssignmentsPage";
import CategoryPage from "./pages/CategoryPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import ProfilePage from "./pages/ProfilePage";
import MedicalReportsPage from "./pages/MedicalReportsPage";
import PatientProfilePage from "./pages/PatientProfilePage";
import PatientsListPage from "./pages/PatientsListPage";
import AdminProfessionalsPage from "./pages/AdminProfessionalsPage";
import InternalAppointmentsPage from "./pages/InternalAppointmentsPage";
import AdminTeamPage from "./pages/AdminTeamPage";
import AdminCatalogPage from "./pages/AdminCatalogPage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/servicos" element={<PageTransition><ServicesPage /></PageTransition>} />
        <Route path="/servicos/:slug" element={<PageTransition><ServiceDetailPage /></PageTransition>} />
        <Route path="/categoria/:slug" element={<PageTransition><CategoryPage /></PageTransition>} />
        <Route path="/agendar" element={<PageTransition><BookingPage /></PageTransition>} />
        <Route path="/sobre" element={<PageTransition><AboutPage /></PageTransition>} />
        <Route path="/contacto" element={<PageTransition><ContactPage /></PageTransition>} />
        <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
        <Route path="/convite" element={<PageTransition><AcceptInvitationPage /></PageTransition>} />
        
        {/* Authenticated routes — all roles */}
        <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        
        {/* Role-specific dashboards */}
        <Route path="/paciente" element={<ProtectedRoute allowedRoles={["paciente"]}><PatientDashboard /></ProtectedRoute>} />
        <Route path="/profissional" element={<ProtectedRoute allowedRoles={["profissional"]}><PractitionerDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/super" element={<ProtectedRoute allowedRoles={["platform"]}><SuperDashboard /></ProtectedRoute>} />
        <Route path="/staff" element={<ProtectedRoute allowedRoles={["staff"]}><StaffDashboard /></ProtectedRoute>} />
        <Route path="/recepcao/fila" element={<ProtectedRoute allowedRoles={["staff","admin"]}><ReceptionQueuePage /></ProtectedRoute>} />
        <Route path="/interno" element={<ProtectedRoute allowedRoles={["interno"]}><InternDashboard /></ProtectedRoute>} />
        <Route path="/enfermagem" element={<ProtectedRoute allowedRoles={["enfermagem"]}><NursingDashboardPage /></ProtectedRoute>} />
        <Route path="/enfermagem/observacoes/:appointmentId" element={<ProtectedRoute allowedRoles={["enfermagem"]}><NursingObservationPage /></ProtectedRoute>} />
        <Route path="/profissional/observacoes-enfermagem/:appointmentId" element={<ProtectedRoute allowedRoles={["profissional"]}><PractitionerNursingObservationPage /></ProtectedRoute>} />
        <Route path="/equipa/enfermagem" element={<ProtectedRoute allowedRoles={["admin"]}><AdminNursingAssignmentsPage /></ProtectedRoute>} />
        
        {/* Medical system — doctors, staff, admins, interns (read-only) */}
        <Route path="/relatorios" element={<ProtectedRoute allowedRoles={["profissional"]}><MedicalReportsPage /></ProtectedRoute>} />
        <Route path="/pacientes" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><PatientsListPage /></ProtectedRoute>} />
        <Route path="/profissionais" element={<ProtectedRoute allowedRoles={["admin"]}><AdminProfessionalsPage /></ProtectedRoute>} />
        <Route path="/equipa" element={<ProtectedRoute allowedRoles={["admin"]}><AdminTeamPage /></ProtectedRoute>} />
        <Route path="/catalogo" element={<ProtectedRoute allowedRoles={["admin"]}><AdminCatalogPage /></ProtectedRoute>} />
        <Route path="/marcacoes" element={<ProtectedRoute allowedRoles={["admin", "staff", "profissional"]}><InternalAppointmentsPage /></ProtectedRoute>} />
        <Route path="/pacientes/:id" element={<ProtectedRoute allowedRoles={["admin", "staff"]}><PatientProfilePage /></ProtectedRoute>} />
        
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
