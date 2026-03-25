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
import CategoryPage from "./pages/CategoryPage";
import ProfilePage from "./pages/ProfilePage";
import MedicalReportsPage from "./pages/MedicalReportsPage";
import PatientProfilePage from "./pages/PatientProfilePage";
import PatientsListPage from "./pages/PatientsListPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/servicos" element={<PageTransition><ServicesPage /></PageTransition>} />
        <Route path="/servicos/:slug" element={<PageTransition><ServiceDetailPage /></PageTransition>} />
        <Route path="/categoria/:slug" element={<PageTransition><CategoryPage /></PageTransition>} />
        <Route path="/agendar" element={<PageTransition><BookingPage /></PageTransition>} />
        <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
        
        <Route path="/perfil" element={<ProtectedRoute><PageTransition><ProfilePage /></PageTransition></ProtectedRoute>} />
        <Route path="/paciente" element={<ProtectedRoute allowedRoles={["paciente"]}><PageTransition><PatientDashboard /></PageTransition></ProtectedRoute>} />
        <Route path="/profissional" element={<ProtectedRoute allowedRoles={["profissional"]}><PageTransition><PractitionerDashboard /></PageTransition></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><PageTransition><AdminDashboard /></PageTransition></ProtectedRoute>} />
        <Route path="/super" element={<ProtectedRoute allowedRoles={["admin"]}><PageTransition><SuperDashboard /></PageTransition></ProtectedRoute>} />
        
        {/* Medical reports system — accessible to doctors and admins */}
        <Route path="/relatorios" element={<ProtectedRoute allowedRoles={["profissional", "admin"]}><PageTransition><MedicalReportsPage /></PageTransition></ProtectedRoute>} />
        
        {/* Patient management — accessible to doctors and admins */}
        <Route path="/pacientes" element={<ProtectedRoute allowedRoles={["profissional", "admin"]}><PageTransition><PatientsListPage /></PageTransition></ProtectedRoute>} />
        <Route path="/pacientes/:id" element={<ProtectedRoute allowedRoles={["profissional", "admin"]}><PageTransition><PatientProfilePage /></PageTransition></ProtectedRoute>} />
        
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
