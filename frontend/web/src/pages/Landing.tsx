import { useEffect, useState } from "react";
import { getProducts, type Product } from "../api/shop";
import { HeroSection } from "../components/landing/HeroSection";
import { ProductShowcase } from "../components/landing/ProductShowcase";
import { FeaturesSection } from "../components/landing/FeaturesSection";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
import { AboutUsSection } from "../components/landing/AboutUsSection";
import { LocateUsSection } from "../components/landing/LocateUsSection";
import { ContactUsSection } from "../components/landing/ContactUsSection";
import { Footer } from "../components/layout/Footer";

export function Landing() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  return (
    <div className="page-enter">
      <HeroSection />
      <ProductShowcase products={products} />
      <FeaturesSection />
      <HowItWorksSection />
      <AboutUsSection />
      <LocateUsSection />
      <ContactUsSection />
      <Footer />
    </div>
  );
}
