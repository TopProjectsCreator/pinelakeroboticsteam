import { ReactNode } from "react";
import Navigation from "./Navigation";
import Footer from "./Footer";
import Chatbot from "./Chatbot";
import TopBanner from "./TopBanner";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBanner />
      <Navigation />
      <main className="flex-1 pt-26">
        {children}
      </main>
      <Footer />
      <Chatbot />
    </div>
  );
};

export default Layout;
