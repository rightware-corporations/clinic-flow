import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/home/HeroSection";
import ServiceCategoryGrid from "@/components/home/ServiceCategoryGrid";
import FeaturedServices from "@/components/home/FeaturedServices";
import AboutSection from "@/components/home/AboutSection";
import FAQSection from "@/components/home/FAQSection";
import CTASection from "@/components/home/CTASection";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <ServiceCategoryGrid />
      <FeaturedServices />
      <AboutSection />
      <FAQSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
