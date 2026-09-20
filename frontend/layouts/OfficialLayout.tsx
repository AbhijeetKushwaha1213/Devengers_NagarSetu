import React from 'react';
import Navbar from '@/components/Navbar';

interface OfficialLayoutProps {
  children: React.ReactNode;
  title?: string;
  badge?: string;
}

export const OfficialLayout: React.FC<OfficialLayoutProps> = ({
  children,
  title,
  badge = 'Official Portal'
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col">
      <Navbar />
      {title && (
        <header className="border-b border-white/10 bg-white/5 backdrop-blur px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {badge}
            </span>
          </div>
        </header>
      )}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
};

export default OfficialLayout;
