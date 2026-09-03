'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { ShieldCheck, User, Lock, ArrowRight, Scale } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { loginAsOfficer } = useAuth();
  const [badgeNumber, setBadgeNumber] = useState('LM-DEL-2024-88');
  const [password, setPassword] = useState('••••••••••••');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginAsOfficer(badgeNumber);
    router.push('/dashboard');
  };

  const handleDemoSignIn = () => {
    loginAsOfficer('LM-DEL-2024-88');
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col justify-center items-center p-6 text-neutral-900">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-1">
            <div className="w-10 h-10 rounded-md bg-neutral-900 text-white flex items-center justify-center font-bold shadow-xs">
              <span className="font-mono text-sm tracking-tighter">
                LL<span className="text-orange-500 font-black">.</span>AI
              </span>
            </div>
          </Link>
          <div>
            <div className="text-[10px] font-bold text-orange-600 font-mono uppercase tracking-wider">
              FIELD INSPECTION UNIT
            </div>
            <h1 className="text-xl font-black text-neutral-900 tracking-tight">Officer Portal Sign-In</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Legal Metrology Field Verification Platform
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="p-6 rounded-xl bg-white border border-[#DBD6CA] shadow-sm space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wide block mb-1.5">
                Officer Badge ID / Credentials:
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F4] border border-[#DBD6CA] rounded-md text-neutral-900 font-mono focus:outline-none focus:border-orange-500 shadow-2xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wide block mb-1.5">
                Passcode / Access Key:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F4] border border-[#DBD6CA] rounded-md text-neutral-900 focus:outline-none focus:border-orange-500 shadow-2xs"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs shadow-xs transition-all hover:translate-y-[-0.5px] flex items-center justify-center gap-1.5"
            >
              <span>Sign In to Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Sign-In */}
          <div className="pt-3 border-t border-[#E5E2D9]">
            <button
              onClick={handleDemoSignIn}
              className="w-full py-2.5 px-3 rounded-md bg-[#FAF8F4] hover:bg-neutral-100 border border-[#DBD6CA] text-neutral-800 text-xs font-bold transition-colors shadow-2xs"
            >
              <span>Quick Sign-In as Inspector (Demo)</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-center text-neutral-500">
          Authorized Legal Metrology field inspection personnel only.
        </p>
      </div>
    </div>
  );
}
