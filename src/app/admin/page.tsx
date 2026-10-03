'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Upload, BookOpen, Activity, Settings, LogOut } from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6 flex gap-6">
      {/* Side Navigation */}
      <nav className="w-64 glass-panel flex flex-col p-4 gap-4 h-[calc(100vh-3rem)]">
        <div className="text-xl font-bold mb-8 px-2 flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-purple-900">L</div>
          <span>GlassAdmin</span>
        </div>

        <div className="flex flex-col gap-2">
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
          <NavItem
            icon={<BookOpen size={20} />}
            label="My Books"
            active={activeTab === 'books'}
            onClick={() => setActiveTab('books')}
          />
          <NavItem
            icon={<Upload size={20} />}
            label="Submit Work"
            active={activeTab === 'submit'}
            onClick={() => setActiveTab('submit')}
          />
          <NavItem
            icon={<Activity size={20} />}
            label="Analytics"
            active={activeTab === 'analytics'}
            onClick={() => setActiveTab('analytics')}
          />
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <NavItem icon={<Settings size={20} />} label="Settings" active={false} onClick={() => alert('Settings clicked')} />
          <NavItem icon={<LogOut size={20} />} label="Logout" active={false} onClick={() => alert('Logging out...')} />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-[calc(100vh-3rem)] pr-2">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'books' && <BooksView />}
        {activeTab === 'submit' && <SubmitView />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        active
          ? 'bg-white text-purple-900 shadow-[0_0_20px_rgba(255,255,255,0.3)] font-semibold'
          : 'hover:bg-white/10 text-white/70 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DashboardView() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold">Welcome back, Author</h1>
        <p className="text-white/50">Your library is currently reaching 12.4k readers.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Reads" value="142,809" delta="+12%" />
        <StatCard label="Avg. Dwell Time" value="4m 32s" delta="+5%" />
        <StatCard label="Revenue" value="$1,240.00" delta="+18%" />
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-xl font-semibold mb-4">Active Book Performance</h2>
        <div className="h-64 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden">
          {/* Simulated Heatmap / Graph */}
          <div className="absolute inset-0 flex items-end justify-around px-4 pb-4 gap-2">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ height: '10%' }}
                animate={{ height: `${Math.random() * 80 + 20}%` }}
                transition={{ repeat: Infinity, repeatType: 'reverse', duration: 2 + Math.random() }}
                className="w-full bg-purple-400/40 rounded-t-sm border-t border-purple-300/50"
              />
            ))}
          </div>
          <p className="text-white/30 z-10 font-mono text-sm">LIVE READER HEATMAP</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, delta }: { label: string, value: string, delta: string }) {
  return (
    <div className="glass-panel p-6 transition-transform hover:scale-[1.02]">
      <p className="text-white/50 text-sm">{label}</p>
      <div className="flex items-end gap-3">
        <h3 className="text-3xl font-bold">{value}</h3>
        <span className="text-green-400 text-xs mb-1">{delta}</span>
      </div>
    </div>
  );
}

function BooksView() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">My Library</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-panel p-4 group cursor-pointer hover:bg-white/20 transition-colors">
            <div className="aspect-video bg-white/10 rounded-lg mb-4 overflow-hidden relative">
              <img src={`/api/placeholder/400/225?text=Book ${i}`} alt="Cover" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 className="font-bold text-lg">The Multimodal Journey Vol. {i}</h3>
            <p className="text-white/50 text-sm mb-4">A cinematic exploration of reactive text.</p>
            <div className="flex justify-between items-center">
              <span className="text-xs bg-purple-500/30 px-2 py-1 rounded border border-purple-500/50">Premium</span>
              <span className="text-sm font-mono">$9.99</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmitView() {
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="text-4xl font-bold">Submit New Work</h1>
        <p className="text-white/50">Upload your manuscript and multimodal assets.</p>
      </header>

      <div className="glass-panel p-8 space-y-6">
        <div className="space-y-2">
          <label className="text-sm text-white/70">Book Title</label>
          <input className="w-full bg-white/10 border border-white/20 rounded-lg p-3 outline-none focus:border-purple-400 transition-colors" placeholder="Enter title..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-white/70">Visibility</label>
            <select className="w-full bg-white/10 border border-white/20 rounded-lg p-3 outline-none">
              <option value="open">Open Source</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">Price ($)</label>
            <input type="number" className="w-full bg-white/10 border border-white/20 rounded-lg p-3 outline-none" placeholder="0.00" />
          </div>
        </div>

        <div className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center hover:border-purple-400 transition-colors cursor-pointer group">
          <Upload className="mx-auto mb-4 text-white/30 group-hover:text-purple-400 transition-colors" size={48} />
          <p className="text-lg font-medium">Drop your manuscript here</p>
          <p className="text-sm text-white/40">Supports .txt, .md, .docx</p>
        </div>

        <button className="w-full py-4 bg-white text-purple-900 font-bold rounded-xl hover:bg-purple-100 transition-colors shadow-lg">
          Submit for Review
        </button>
      </div>
    </div>
  );
}

function AnalyticsView() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Reader Analytics</h1>
      <div className="glass-panel p-8 h-96 flex items-center justify-center">
        <p className="text-white/30 italic">Detailed heatmap and dwell-time analytics loading...</p>
      </div>
    </div>
  );
}
