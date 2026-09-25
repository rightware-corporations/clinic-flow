import Navbar from "@/components/layout/Navbar";
import Footer from "@/features/public-site/components/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export default function Layout({ children, hideFooter }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      {!hideFooter && <Footer />}
      <MobileBottomNav />
    </div>
  );
}
