import React from 'react';
import { Smartphone, Lock, Sparkles, Shield, Radio } from 'lucide-react';

export const DevicesPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-150 text-[#ECEDEF] font-sans pb-12">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Devices</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            SOON
          </span>
        </div>

        <div className="rounded-xl bg-[#111216]/90 border border-white/[0.07] p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-amber-400">
            <Smartphone className="w-7 h-7" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h4 className="text-base font-semibold text-white">
              Phone & Mobile Device Mirroring
            </h4>
            <p className="text-xs text-[#8A8F98] leading-relaxed">
              Mobile device tethering, iOS/Android companion pairing, and remote screen mirroring
              are currently in development and will be activated in an upcoming Orbito update.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-lg pt-4 text-left">
            <div className="p-3 rounded-lg bg-black/40 border border-white/[0.05] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                <Radio className="w-3.5 h-3.5 text-blue-400" />
                <span>Companion Link</span>
              </div>
              <p className="text-[11px] text-[#747982]">
                Pair with the Orbito mobile companion over local Wi-Fi.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-white/[0.05] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Mobile Preview</span>
              </div>
              <p className="text-[11px] text-[#747982]">
                Live responsive rendering of web and React Native apps.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-white/[0.05] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>End-to-End Safe</span>
              </div>
              <p className="text-[11px] text-[#747982]">
                Encrypted peer-to-peer connection with biometric approval.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-1.5 text-xs text-[#747982]">
            <Lock className="w-3 h-3 text-amber-400" />
            <span>This feature is temporarily locked and cannot be launched yet.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
