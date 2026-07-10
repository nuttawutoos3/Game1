import React, { useState, useEffect } from 'react';
import { GameSettings, KeyBindings, ThemePalette } from '../types';
import { playSound, updateMusicVolume } from '../utils/audio';
import { ArrowLeft, RotateCcw, Volume2, Music, Monitor, Shield, Sparkles, Check, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface OptionsScreenProps {
  settings: GameSettings;
  onChangeSettings: (settings: GameSettings) => void;
  onBack: () => void;
}

export default function OptionsScreen({ settings, onChangeSettings, onBack }: OptionsScreenProps) {
  const [activeBinding, setActiveBinding] = useState<keyof KeyBindings | null>(null);
  const [testedKey, setTestedKey] = useState<string | null>(null);

  // Monitor keyboard for key testing or key remapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for arrow keys or space during configuration
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (activeBinding) {
        const newKey = e.key === ' ' ? 'Space' : e.key;
        
        // Ensure binding is safe
        const updatedBindings = { ...settings.bindings, [activeBinding]: newKey };
        onChangeSettings({
          ...settings,
          bindings: updatedBindings
        });
        
        playSound('select', settings.soundVolume);
        setActiveBinding(null);
      } else {
        setTestedKey(e.key === ' ' ? 'Space' : e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBinding, settings, onChangeSettings]);

  // Reset to original defaults
  const handleResetDefaults = () => {
    playSound('click', settings.soundVolume);
    onChangeSettings({
      ...settings,
      bindings: {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
        action: 'Space'
      },
      soundVolume: 75,
      musicVolume: 50,
      difficulty: 'medium',
      scanlines: true,
      theme: 'cyberpink'
    });
  };

  const updateBinding = (action: keyof KeyBindings) => {
    playSound('click', settings.soundVolume);
    setActiveBinding(action);
  };

  const handleVolumeChange = (field: 'soundVolume' | 'musicVolume', val: number) => {
    const updated = { ...settings, [field]: val };
    onChangeSettings(updated);
    if (field === 'soundVolume') {
      // play click debounce-ish
      playSound('click', val);
    } else {
      updateMusicVolume(val);
    }
  };

  const handleDifficultyChange = (difficulty: 'easy' | 'medium' | 'hard') => {
    playSound('click', settings.soundVolume);
    onChangeSettings({ ...settings, difficulty });
  };

  const handleThemeChange = (theme: ThemePalette) => {
    playSound('select', settings.soundVolume);
    onChangeSettings({ ...settings, theme });
  };

  const handleScanlineToggle = () => {
    playSound('click', settings.soundVolume);
    onChangeSettings({ ...settings, scanlines: !settings.scanlines });
  };

  // Color schemes mapper
  const getThemeColors = (p: ThemePalette) => {
    switch (p) {
      case 'cyberpink':
        return { text: 'text-rose-500', border: 'border-rose-500', bg: 'bg-rose-500', glow: 'shadow-rose-500/50' };
      case 'emerald':
        return { text: 'text-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-500', glow: 'shadow-emerald-500/50' };
      case 'amethyst':
        return { text: 'text-purple-500', border: 'border-purple-500', bg: 'bg-purple-500', glow: 'shadow-purple-500/50' };
      case 'classic':
        return { text: 'text-amber-500', border: 'border-amber-500', bg: 'bg-amber-500', glow: 'shadow-amber-500/50' };
    }
  };

  const c = getThemeColors(settings.theme);

  return (
    <div id="options-panel" className="w-full max-w-4xl mx-auto bg-slate-950/80 border-2 border-slate-800 p-6 md:p-8 rounded-2xl backdrop-blur-md shadow-2xl relative overflow-hidden">
      {/* Visual neon grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 pb-4 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <Sparkles className={`w-6 h-6 ${c.text}`} />
          <h2 className="text-xl md:text-2xl font-orbitron font-extrabold tracking-wider uppercase text-white">
            System Configuration
          </h2>
        </div>
        
        <div className="flex gap-3">
          <button
            id="reset-defaults-btn"
            onClick={handleResetDefaults}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono tracking-wider bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded text-slate-300 transition-all duration-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET DEFAULTS
          </button>
          
          <button
            id="back-menu-btn"
            onClick={onBack}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-mono tracking-wider bg-slate-900 border hover:bg-slate-800 rounded transition-all duration-200 cursor-pointer text-white`}
            style={{ borderColor: c.bg.replace('bg-', '') }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK TO TITLE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
        {/* Left Column: Key Remapping */}
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-game text-slate-400 mb-4 tracking-wider">
              🎮 CONTROL MAPPINGS
            </h3>
            <p className="text-xs text-slate-400 font-sans mb-4 leading-relaxed">
              Click any input action below, then press a key on your keyboard to map it.
            </p>

            <div className="flex flex-col gap-2.5">
              {(Object.keys(settings.bindings) as Array<keyof KeyBindings>).map((action) => {
                const label = action.toUpperCase();
                const boundKey = settings.bindings[action];
                const isConfiguring = activeBinding === action;

                return (
                  <div
                    key={action}
                    id={`binding-row-${action}`}
                    className={`flex justify-between items-center p-3 rounded-lg border transition-all ${
                      isConfiguring 
                        ? 'bg-slate-900 border-2 border-dashed' 
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                    style={isConfiguring ? { borderColor: c.bg.replace('bg-', '') } : {}}
                  >
                    <span className="text-xs font-mono font-bold tracking-widest text-slate-300">
                      MOVE {label}
                    </span>
                    <button
                      id={`bind-btn-${action}`}
                      onClick={() => updateBinding(action)}
                      className={`px-4 py-1.5 rounded font-game text-[10px] tracking-wider transition-all duration-150 shadow-md min-w-[130px] cursor-pointer ${
                        isConfiguring 
                          ? `${c.bg} text-black animate-pulse` 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {isConfiguring ? 'PRESS KEY...' : boundKey}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Keyboard Tester Box */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col gap-2.5">
            <span className="text-[10px] font-game tracking-widest text-slate-500">
              KEYBOARD SIGNAL TESTER
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">
                Last Key Received:
              </span>
              <span className={`px-2 py-1 text-xs font-mono rounded font-bold uppercase ${testedKey ? `${c.bg} text-black` : 'bg-slate-800 text-slate-600'}`}>
                {testedKey || 'NONE'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Tap any keyboard key outside remap state to see if it registers successfully here.
            </p>
          </div>
        </div>

        {/* Right Column: Audio & Environmental Customization */}
        <div className="flex flex-col gap-6">
          {/* Theme Palette Select */}
          <div className="bg-slate-900/30 border border-slate-800/80 p-4 rounded-xl">
            <h3 className="text-xs font-game text-slate-400 mb-3 tracking-wider flex items-center gap-2">
              🎨 VISUAL CODES
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'cyberpink', name: 'CYBERPUNK PINK', color: 'from-rose-500 to-fuchsia-600' },
                { id: 'emerald', name: 'EMERALD MATRIX', color: 'from-emerald-400 to-teal-600' },
                { id: 'amethyst', name: 'AMETHYST VOID', color: 'from-purple-500 to-indigo-600' },
                { id: 'classic', name: 'VINTAGE ARCADE', color: 'from-amber-400 to-orange-600' }
              ].map((themeOpt) => (
                <button
                  key={themeOpt.id}
                  id={`theme-btn-${themeOpt.id}`}
                  onClick={() => handleThemeChange(themeOpt.id as ThemePalette)}
                  className={`flex flex-col p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                    settings.theme === themeOpt.id
                      ? 'bg-slate-900 border-slate-500 ring-1 ring-slate-400'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-1">
                    <span className="text-[10px] font-mono font-extrabold text-white tracking-wide">
                      {themeOpt.name}
                    </span>
                    {settings.theme === themeOpt.id && (
                      <Check className={`w-3.5 h-3.5 ${c.text}`} />
                    )}
                  </div>
                  <div className={`w-full h-1.5 rounded bg-gradient-to-r ${themeOpt.color}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Sound Volume Sliders */}
          <div className="bg-slate-900/30 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-4">
            <h3 className="text-xs font-game text-slate-400 tracking-wider flex items-center gap-2">
              🔊 SONIC SPECTRUM
            </h3>
            
            {/* SFX slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" /> Sound FX
                </span>
                <span className="font-bold text-white">{settings.soundVolume}%</span>
              </div>
              <input
                id="sfx-volume-slider"
                type="range"
                min="0"
                max="100"
                value={settings.soundVolume}
                onChange={(e) => handleVolumeChange('soundVolume', parseInt(e.target.value))}
                className="w-full accent-slate-200 cursor-pointer"
              />
            </div>

            {/* Music slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1">
                  <Music className="w-3.5 h-3.5" /> Synth Music
                </span>
                <span className="font-bold text-white">{settings.musicVolume}%</span>
              </div>
              <input
                id="music-volume-slider"
                type="range"
                min="0"
                max="100"
                value={settings.musicVolume}
                onChange={(e) => handleVolumeChange('musicVolume', parseInt(e.target.value))}
                className="w-full accent-slate-200 cursor-pointer"
              />
            </div>
          </div>

          {/* Filter & Difficulty */}
          <div className="bg-slate-900/30 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-4">
            {/* CRT Screen Filter Toggle */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4" /> CRT scanlines overlay
                </span>
                <span className="text-[10px] text-slate-500">Scanline monitor rendering</span>
              </div>
              <button
                id="toggle-scanlines-btn"
                onClick={handleScanlineToggle}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                  settings.scanlines ? c.bg : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    settings.scanlines ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Difficulty Preset */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Target Difficulty Level
              </span>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    id={`diff-btn-${diff}`}
                    onClick={() => handleDifficultyChange(diff)}
                    className={`py-1 rounded font-mono text-[10px] tracking-widest uppercase transition-all duration-150 cursor-pointer ${
                      settings.difficulty === diff
                        ? `${c.bg} text-black font-extrabold`
                        : 'hover:bg-slate-900 text-slate-400'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Retro bottom bar hint */}
      <div className="mt-8 pt-4 border-t border-slate-900 flex justify-between items-center text-[10px] font-mono text-slate-500 relative z-10">
        <span className="flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          Settings are automatically applied
        </span>
        <span>ENGINE V2.1.0</span>
      </div>
    </div>
  );
}
