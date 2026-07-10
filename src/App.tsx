import React, { useState, useEffect } from 'react';
import { GameScreenState, GameSettings } from './types';
import TitleScreen from './components/TitleScreen';
import OptionsScreen from './components/OptionsScreen';
import HowToPlay from './components/HowToPlay';
import GameScreen from './components/GameScreen';
import { playSound, startMusic, stopMusic } from './utils/audio';
import { Volume2, VolumeX, Keyboard, Terminal, Monitor, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_SETTINGS: GameSettings = {
  bindings: {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    action: 'Space',
  },
  soundVolume: 70,
  musicVolume: 35,
  scanlines: true,
  difficulty: 'medium',
  theme: 'cyberpink',
};

export default function App() {
  const [screen, setScreen] = useState<GameScreenState>('TITLE');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [audioStarted, setAudioStarted] = useState(false);

  // Initialize/load settings from local storage if available
  useEffect(() => {
    const saved = localStorage.getItem('cyber_arena_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
      } catch (e) {
        console.error('Failed to parse saved settings', e);
      }
    }
  }, []);

  // Save settings on change
  const handleSettingsChange = (newSettings: GameSettings) => {
    setSettings(newSettings);
    localStorage.setItem('cyber_arena_settings', JSON.stringify(newSettings));
  };

  // Start backgound music on first user click anywhere
  const handleInteractionInitAudio = () => {
    if (!audioStarted) {
      setAudioStarted(true);
      startMusic(settings.musicVolume);
      playSound('select', settings.soundVolume);
    }
  };

  const getThemePaletteClass = () => {
    switch (settings.theme) {
      case 'cyberpink':
        return {
          bgGradient: 'from-purple-950/20 via-slate-950/40 to-rose-950/20',
          borderColor: 'border-rose-500/30',
          glowGlow: 'rgba(244, 63, 94, 0.15)',
          cornerColor: 'text-rose-500',
        };
      case 'emerald':
        return {
          bgGradient: 'from-slate-950/40 via-emerald-950/10 to-teal-950/30',
          borderColor: 'border-emerald-500/30',
          glowGlow: 'rgba(52, 211, 153, 0.15)',
          cornerColor: 'text-emerald-400',
        };
      case 'amethyst':
        return {
          bgGradient: 'from-indigo-950/20 via-slate-950/40 to-purple-950/20',
          borderColor: 'border-purple-500/30',
          glowGlow: 'rgba(168, 85, 247, 0.15)',
          cornerColor: 'text-purple-400',
        };
      case 'classic':
        return {
          bgGradient: 'from-slate-950/40 via-amber-950/10 to-orange-950/20',
          borderColor: 'border-amber-500/30',
          glowGlow: 'rgba(245, 158, 11, 0.15)',
          cornerColor: 'text-amber-500',
        };
    }
  };

  const themeVars = getThemePaletteClass();

  return (
    <div
      id="app-viewport"
      onClick={handleInteractionInitAudio}
      className={`h-screen w-screen relative overflow-hidden bg-slate-950 bg-gradient-to-tr ${themeVars.bgGradient} text-slate-100 flex items-center justify-center font-sans`}
    >
      {/* CRT Scanline Overlay Filter */}
      {settings.scanlines && (
        <div id="crt-scanline-layer" className="absolute inset-0 pointer-events-none z-50 scanline-overlay opacity-60" />
      )}

      {/* Cyberpunk grid framework HUD corners */}
      <div className="absolute inset-4 pointer-events-none border border-slate-900 z-10 flex flex-col justify-between">
        <div className="flex justify-between w-full">
          <div className={`border-t-2 border-l-2 p-2 ${themeVars.borderColor} ${themeVars.cornerColor}`}>┌</div>
          <div className={`border-t-2 border-r-2 p-2 ${themeVars.borderColor} ${themeVars.cornerColor}`}>┐</div>
        </div>
        <div className="flex justify-between w-full">
          <div className={`border-b-2 border-l-2 p-2 ${themeVars.borderColor} ${themeVars.cornerColor}`}>└</div>
          <div className={`border-b-2 border-r-2 p-2 ${themeVars.borderColor} ${themeVars.cornerColor}`}>┘</div>
        </div>
      </div>

      {/* Music Audio Controller Status Flag */}
      <div className="absolute top-6 right-8 z-20 flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-slate-950/70 py-1.5 px-3 rounded-md border border-slate-900">
        {settings.musicVolume > 0 ? (
          <>
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
            <span>SYNTH LOOPS: {settings.musicVolume}%</span>
          </>
        ) : (
          <>
            <VolumeX className="w-3.5 h-3.5 text-slate-600" />
            <span>MUTED CHIP</span>
          </>
        )}
        {!audioStarted && (
          <span className="text-amber-500 animate-pulse ml-2">⚠️ CLICK TO ACTIVATE SOUND</span>
        )}
      </div>

      {/* Main Screen Router with Framer Motion transitions */}
      <div className="w-full h-full max-w-7xl mx-auto flex items-center justify-center p-4 relative z-10">
        <AnimatePresence mode="wait">
          {screen === 'TITLE' && (
            <motion.div
              key="title"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full flex items-center justify-center"
            >
              <TitleScreen
                settings={settings}
                onNavigate={(state) => setScreen(state)}
              />
            </motion.div>
          )}

          {screen === 'OPTIONS' && (
            <motion.div
              key="options"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="w-full flex items-center justify-center"
            >
              <OptionsScreen
                settings={settings}
                onChangeSettings={handleSettingsChange}
                onBack={() => setScreen('TITLE')}
              />
            </motion.div>
          )}

          {screen === 'HOW_TO_PLAY' && (
            <motion.div
              key="how-to-play"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="w-full flex items-center justify-center"
            >
              <HowToPlay
                settings={settings}
                onBack={() => setScreen('TITLE')}
              />
            </motion.div>
          )}

          {screen === 'PLAYING' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full"
            >
              <GameScreen
                settings={settings}
                onBackToTitle={() => setScreen('TITLE')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ambient background blur circles */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full blur-[140px] pointer-events-none -z-10 transition-colors duration-1000"
           style={{ backgroundColor: themeVars.glowGlow }} />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full blur-[140px] pointer-events-none -z-10 transition-colors duration-1000"
           style={{ backgroundColor: themeVars.glowGlow }} />
    </div>
  );
}
