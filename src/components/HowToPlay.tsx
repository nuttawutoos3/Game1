import React from 'react';
import { GameSettings, ThemePalette } from '../types';
import { playSound } from '../utils/audio';
import { ArrowLeft, BookOpen, Heart, Swords, ShieldAlert, Award } from 'lucide-react';
import { motion } from 'motion/react';

interface HowToPlayProps {
  settings: GameSettings;
  onBack: () => void;
}

export default function HowToPlay({ settings, onBack }: HowToPlayProps) {
  const getThemeColors = (p: ThemePalette) => {
    switch (p) {
      case 'cyberpink':
        return { text: 'text-rose-500', border: 'border-rose-500', bg: 'bg-rose-500', activeBg: 'bg-rose-950/20' };
      case 'emerald':
        return { text: 'text-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-500', activeBg: 'bg-emerald-950/20' };
      case 'amethyst':
        return { text: 'text-purple-500', border: 'border-purple-500', bg: 'bg-purple-500', activeBg: 'bg-purple-950/20' };
      case 'classic':
        return { text: 'text-amber-500', border: 'border-amber-500', bg: 'bg-amber-500', activeBg: 'bg-amber-950/20' };
    }
  };

  const c = getThemeColors(settings.theme);

  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-950/80 border-2 border-slate-800 p-6 md:p-8 rounded-2xl backdrop-blur-md shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-3">
          <BookOpen className={`w-6 h-6 ${c.text}`} />
          <h2 className="text-xl md:text-2xl font-orbitron font-extrabold tracking-wider uppercase text-white">
            Tactical Flight Manual
          </h2>
        </div>
        
        <button
          id="back-title-btn-how"
          onClick={() => {
            playSound('click', settings.soundVolume);
            onBack();
          }}
          className={`flex items-center gap-2 px-4 py-1.5 text-xs font-mono tracking-wider bg-slate-900 border hover:bg-slate-800 rounded transition-all duration-200 cursor-pointer text-white`}
          style={{ borderColor: c.bg.replace('bg-', '') }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          BACK TO TITLE
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
        {/* Left Side: Controls visualization */}
        <div className="flex flex-col gap-5">
          <h3 className="text-xs font-game text-slate-400 tracking-wider">
            🛰️ DYNAMIC SHIP CONTROLS
          </h3>
          
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Your starfighter has been calibrated with your custom mapping. Press these keys in the arena to pilot:
            </p>

            <div className="flex flex-col gap-2">
              {[
                { action: 'UP', key: settings.bindings.up },
                { action: 'DOWN', key: settings.bindings.down },
                { action: 'LEFT', key: settings.bindings.left },
                { action: 'RIGHT', key: settings.bindings.right },
                { action: 'WEAPON / ACTION', key: settings.bindings.action },
              ].map((ctrl) => (
                <div key={ctrl.action} className="flex justify-between items-center py-2 px-3 bg-slate-950/50 border border-slate-900 rounded">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">
                    {ctrl.action}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-black border tracking-wider bg-slate-900 text-white ${c.border}`}>
                    {ctrl.key === ' ' ? 'SPACE' : ctrl.key.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Mission Briefing */}
        <div className="flex flex-col gap-5">
          <h3 className="text-xs font-game text-slate-400 tracking-wider">
            ☄️ INCOMING THREAT MATRIX
          </h3>

          <div className="flex flex-col gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/60">
            {/* Objective */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded text-rose-500 mt-0.5">
                <Swords className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-game tracking-wider text-slate-200">ASTEROID THREAT</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Incoming asteroids of various sizes will crash into your ship! Destroy them with your energy weapon to score points.
                </p>
              </div>
            </div>

            {/* Shield and HP */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-500 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-game tracking-wider text-slate-200">ENERGY RECHARGES</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Collect floating green shield pods to restore your health instantly and survive longer in the grid.
                </p>
              </div>
            </div>

            {/* High score */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-500 mt-0.5">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-game tracking-wider text-slate-200">HIGHSCORE SYSTEM</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Each difficulty level scales the speed of asteroids. Hard level awards triple points. Can you beat the arena high scores?
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-900 flex justify-center text-[10px] font-mono text-slate-500 uppercase tracking-widest relative z-10">
        <span>GRID FIGHTER PILOT BRIEFING COMPLETED. GOOD LUCK.</span>
      </div>
    </div>
  );
}
