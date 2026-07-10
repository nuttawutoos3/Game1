import React, { useState, useEffect, useRef } from 'react';
import { GameScreenState, GameSettings, ThemePalette } from '../types';
import { playSound } from '../utils/audio';
import { Play, Settings, HelpCircle, Swords, Music, Gamepad2, Sparkles, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TitleScreenProps {
  settings: GameSettings;
  onNavigate: (state: GameScreenState) => void;
}

export default function TitleScreen({ settings, onNavigate }: TitleScreenProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const menuItems = [
    { id: 'PLAYING' as GameScreenState, label: 'LAUNCH MISSION', icon: Play, desc: 'Enter the playable neon arena' },
    { id: 'OPTIONS' as GameScreenState, label: 'SYSTEM CONFIG', icon: Settings, desc: 'Remap character keybinds, filters, sounds' },
    { id: 'HOW_TO_PLAY' as GameScreenState, label: 'TACTICAL MANUAL', icon: HelpCircle, desc: 'Learn maneuvers and target scores' },
  ];

  // Particle background simulation for retro title screen feel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    // Create particles
    const stars: { x: number; y: number; size: number; speed: number; opacity: number }[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.5 + 0.1,
      opacity: Math.random(),
    }));

    // Draw frame
    const render = () => {
      ctx.fillStyle = '#020205';
      ctx.fillRect(0, 0, width, height);

      // Draw starry ambient space dust
      stars.forEach((star) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Move star down slowly
        star.y += star.speed;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }

        // Pulse opacity
        star.opacity += (Math.random() - 0.5) * 0.05;
        star.opacity = Math.max(0.1, Math.min(0.9, star.opacity));
      });

      // Neon grid lines at the bottom moving forward
      ctx.strokeStyle = settings.theme === 'cyberpink' ? 'rgba(244, 63, 94, 0.06)' 
                      : settings.theme === 'emerald' ? 'rgba(16, 185, 129, 0.06)'
                      : settings.theme === 'amethyst' ? 'rgba(168, 85, 247, 0.06)'
                      : 'rgba(245, 158, 11, 0.06)';
      ctx.lineWidth = 1;
      
      const gridCount = 20;
      const horizonY = height * 0.45;
      
      // Horizontal grid lines
      for (let i = 0; i < gridCount; i++) {
        const y = horizonY + (height - horizonY) * Math.pow(i / gridCount, 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical perspective lines
      for (let i = 0; i <= gridCount; i++) {
        const xHorizon = (width / 2) + (i - gridCount / 2) * (width / gridCount) * 0.1;
        const xBottom = (width / 2) + (i - gridCount / 2) * (width / gridCount) * 1.5;
        ctx.beginPath();
        ctx.moveTo(xHorizon, horizonY);
        ctx.lineTo(xBottom, height);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [settings.theme]);

  // Keyboard navigation for menu item selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const b = settings.bindings;
      const key = e.key === ' ' ? 'Space' : e.key;

      if (key === b.up || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
        playSound('click', settings.soundVolume);
      } else if (key === b.down || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % menuItems.length);
        playSound('click', settings.soundVolume);
      } else if (key === b.action || e.key === 'Enter') {
        e.preventDefault();
        const selected = menuItems[activeIndex];
        playSound('select', settings.soundVolume);
        onNavigate(selected.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, settings, onNavigate]);

  const getThemeColorClass = (palette: ThemePalette) => {
    switch (palette) {
      case 'cyberpink':
        return { text: 'text-rose-500', bg: 'bg-rose-500', glow: 'shadow-rose-500/30', border: 'border-rose-500/40', activeBg: 'bg-rose-950/40' };
      case 'emerald':
        return { text: 'text-emerald-400', bg: 'bg-emerald-500', glow: 'shadow-emerald-500/30', border: 'border-emerald-500/40', activeBg: 'bg-emerald-950/40' };
      case 'amethyst':
        return { text: 'text-purple-400', bg: 'bg-purple-500', glow: 'shadow-purple-500/30', border: 'border-purple-500/40', activeBg: 'bg-purple-950/40' };
      case 'classic':
        return { text: 'text-amber-500', bg: 'bg-amber-500', glow: 'shadow-amber-500/30', border: 'border-amber-500/40', activeBg: 'bg-amber-950/40' };
    }
  };

  const colors = getThemeColorClass(settings.theme);

  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center overflow-hidden">
      {/* Immersive 3D Space & grid perspective background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col items-center justify-between w-full h-full max-w-4xl py-8 px-4 text-center">
        
        {/* Top Header details */}
        <div className="flex justify-between items-center w-full px-4 text-[10px] font-mono text-slate-500 tracking-wider">
          <span className="flex items-center gap-1">
            <Gamepad2 className={`w-3.5 h-3.5 ${colors.text}`} />
            STATION SYSTEM ONLINE
          </span>
          <span className="animate-pulse">● SIGNAL DIRECT</span>
        </div>

        {/* Title Logo Space */}
        <div className="flex flex-col items-center justify-center my-auto gap-4">
          <motion.div 
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative"
          >
            {/* Soft glowing orb behind the logo */}
            <div className={`absolute -inset-4 rounded-full ${colors.bg} opacity-20 blur-xl animate-pulse`} />
            
            <img
              id="game-logo"
              src="https://res.cloudinary.com/dsucg33fv/image/upload/v1782709347/logo_i8827v.png"
              alt="Cyber Retro Arena"
              referrerPolicy="no-referrer"
              className="max-h-[160px] md:max-h-[220px] object-contain relative z-10 drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] filter brightness-110"
              onError={(e) => {
                // Fail-safe text title if Cloudinary has connectivity issues
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const title = document.createElement('h1');
                  title.className = `text-4xl md:text-6xl font-orbitron font-black tracking-widest ${colors.text} uppercase`;
                  title.innerText = 'CYBER ARENA';
                  parent.appendChild(title);
                }
              }}
            />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-xs md:text-sm font-game text-slate-400 tracking-wider max-w-lg mt-2 leading-relaxed"
          >
            CHOOSE YOUR DIRECTION. DEFEND THE GRID.
          </motion.p>
        </div>

        {/* Interactive Main Menu */}
        <div className="w-full max-w-md flex flex-col gap-3.5 my-4">
          <AnimatePresence mode="popLayout">
            {menuItems.map((item, index) => {
              const isSelected = activeIndex === index;
              const IconComponent = item.icon;

              return (
                <motion.button
                  key={item.id}
                  id={`menu-item-${item.id.toLowerCase()}`}
                  onClick={() => {
                    playSound('select', settings.soundVolume);
                    onNavigate(item.id);
                  }}
                  onMouseEnter={() => {
                    setActiveIndex(index);
                    playSound('click', settings.soundVolume);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer relative ${
                    isSelected
                      ? `${colors.border} ${colors.activeBg} ${colors.glow} shadow-lg backdrop-blur-md`
                      : 'border-slate-800/60 bg-slate-950/65 hover:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 text-left">
                    <div className={`p-2 rounded-lg transition-colors ${isSelected ? `${colors.bg} text-black` : 'bg-slate-900 text-slate-400'}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`text-sm font-orbitron font-black tracking-widest transition-colors ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {item.label}
                      </h3>
                      <p className="text-[10px] font-sans text-slate-500 mt-0.5 font-medium tracking-wide">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {/* Aesthetic selected bullet indicators */}
                  {isSelected && (
                    <motion.div
                      layoutId="menu-pointer"
                      className={`h-2.5 w-2.5 rounded-full ${colors.bg}`}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Dynamic keyboard action hint */}
        <div className="flex flex-col gap-1 items-center justify-center my-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold font-mono">
              {settings.bindings.up === 'ArrowUp' ? '▲' : settings.bindings.up}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold font-mono">
              {settings.bindings.down === 'ArrowDown' ? '▼' : settings.bindings.down}
            </span>
            <span>TO NAVIGATE</span>
            <span className="mx-1 text-slate-700">|</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold font-mono">
              {settings.bindings.action === 'Space' ? 'SPACE' : settings.bindings.action}
            </span>
            <span>TO SELECT</span>
          </div>
          <p className="text-[9px] text-slate-600 mt-1 italic normal-case">
            You can remap movement keys and fire buttons in the configuration suite anytime.
          </p>
        </div>

      </div>
    </div>
  );
}
