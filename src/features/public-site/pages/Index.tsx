import Layout from "@/features/public-site/components/Layout";
import HeroSection from "@/features/public-site/components/HeroSection";
import ServiceCategoryGrid from "@/features/public-site/components/ServiceCategoryGrid";
import FeaturedServices from "@/features/public-site/components/FeaturedServices";
import AboutSection from "@/features/public-site/components/AboutSection";
import FAQSection from "@/features/public-site/components/FAQSection";
import CTASection from "@/features/public-site/components/CTASection";

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
