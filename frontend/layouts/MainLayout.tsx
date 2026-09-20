import React from 'react';
import Navbar from '@/components/Navbar';

interface MainLayoutProps {
  children: React.ReactNode;
  showNavbar?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  showNavbar = true
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {showNavbar && <Navbar />}
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
