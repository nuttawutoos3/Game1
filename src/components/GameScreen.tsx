import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GameSettings, ThemePalette, HighScore } from '../types';
import { playSound } from '../utils/audio';
import { Trophy, RotateCcw, Home, Pause, Shield, Award, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GameScreenProps {
  settings: GameSettings;
  onBackToTitle: () => void;
}

// 1. Ground Plane with Tiled Texture
function Ground({ theme }: { theme: ThemePalette }) {
  // Load tiled texture from Cloudinary
  const texture = useTexture('https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/ground_d1kjrx.png');
  
  // Set tiling wrap
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12); // Tiling size

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial 
        map={texture} 
        roughness={0.7} 
        metalness={0.3} 
      />
    </mesh>
  );
}

// 2. Neon Grid Boundary Walls to frame the 50x50 plane
function ArenaWalls({ themeColor }: { themeColor: string }) {
  const wallLine = useMemo(() => {
    const points = [
      new THREE.Vector3(-25, 0, -25),
      new THREE.Vector3(25, 0, -25),
      new THREE.Vector3(25, 0, 25),
      new THREE.Vector3(-25, 0, 25),
      new THREE.Vector3(-25, 0, -25),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: themeColor });
    return new THREE.Line(geometry, material);
  }, [themeColor]);

  return (
    <group>
      {/* Outer base lines */}
      <primitive object={wallLine} />

      {/* Futuristic corner pillars */}
      {[
        [-25, -25], [25, -25], [25, 25], [-25, 25]
      ].map(([x, z], idx) => (
        <mesh key={idx} position={[x, 2.5, z]}>
          <cylinderGeometry args={[0.2, 0.2, 5, 8]} />
          <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={0.8} />
        </mesh>
      ))}

      {/* Grid Floor Lines inside */}
      <gridHelper args={[50, 25, themeColor, '#1e293b']} position={[0, 0.01, 0]} />
    </group>
  );
}

// Helper types for game elements
interface BulletState {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  active: boolean;
}

interface AsteroidState {
  id: number;
  x: number;
  z: number;
  y: number;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  points: number;
  vx: number;
  vz: number;
  
  // Animation & spritesheet configurations
  animTime: number;
  currentFrame: number;
  isFlipped: boolean;
  texture: THREE.Texture;
  colorOverride?: string;
  
  // Custom action timer states
  flashRedTime: number;
  flashWhiteTime: number;
  
  // Knockback parameters
  knockbackTimer: number;
  knockbackVx: number;
  knockbackVz: number;
  
  // Death animation triggers
  isDead: boolean;
  deathTimer: number;
  deathVx: number;
  deathVz: number;

  // Multi-punch cooldowns
  lastHitByPunch?: number;
  lastHitBySkill?: number;
}

interface PowerupState {
  id: number;
  x: number;
  z: number;
  y: number;
  vy: number;
  radius: number;
  type: 'shield';
  active: boolean;
}

interface ParticleState {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  alpha: number;
  decay: number;
  size: number;
}

// 3. Main ThreeJS Game logic component
// 3. Main ThreeJS Game logic component using player.png 4x4 spritesheet
function ArenaStage({
  settings,
  score,
  setScore,
  shield,
  setShield,
  gameOver,
  setGameOver,
  isPaused,
  themeColor
}: {
  settings: GameSettings;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  shield: number;
  setShield: React.Dispatch<React.SetStateAction<number>>;
  gameOver: boolean;
  setGameOver: (state: boolean) => void;
  isPaused: boolean;
  themeColor: string;
}) {
  const { camera } = useThree();
  const keysPressed = useRef<Record<string, boolean>>({});

  // Load the custom 4x4 player sprite sheet
  const playerTexture = useTexture('https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/player.png');
  const enemyTexture = useTexture('https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/enemy.png');
  const potionTexture = useTexture('https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/potion.png');

  const activeTexture = useMemo(() => {
    const t = playerTexture.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(0.25, 0.25);
    t.needsUpdate = true;
    return t;
  }, [playerTexture]);

  // Player positions and variables (ThreeJS operates on X and Z for the plane)
  const playerRef = useRef({
    x: 0,
    z: 15,
    y: 1.2, // Height slightly off the ground to account for taller 256px sprite
    speed: 13,
    lastFired: 0,
    fireRate: 250, // ms
    directionIdx: 0, // 0 to 7 index
  });

  // Animation states & timers
  const animTime = useRef(0);
  const currentFrame = useRef(0);
  const playerState = useRef<'idle' | 'walk' | 'attack' | 'dance'>('idle');
  const isFlipped = useRef(false);

  // Skill & attack action managers
  const attackDuration = 0.25; // seconds
  const attackActive = useRef(false);
  const attackTimer = useRef(0);
  const hitBoxPos = useRef({ x: 0, z: 0 });

  const skillDuration = 1.2; // seconds
  const skillActive = useRef(false);
  const skillTimer = useRef(0);
  const skillRadius = useRef(0);

  // State refs for fast updates inside useFrame
  const bullets = useRef<BulletState[]>([]);
  const asteroids = useRef<AsteroidState[]>([]);
  const powerups = useRef<PowerupState[]>([]);
  const particles = useRef<ParticleState[]>([]);

  // Local elements count ID
  const nextId = useRef(0);

  // Sound and difficulty multiplier
  const soundVolume = settings.soundVolume;
  const speedMultiplier = settings.difficulty === 'easy' ? 0.7 
                        : settings.difficulty === 'hard' ? 1.5 
                        : 1.0;

  // Track standard browser inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'p', 'P', 'o', 'O'].includes(e.key)) {
        e.preventDefault();
      }
      const k = e.key === ' ' ? 'Space' : e.key;
      keysPressed.current[k] = true;
      keysPressed.current[e.key] = true;
      keysPressed.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key === ' ' ? 'Space' : e.key;
      keysPressed.current[k] = false;
      keysPressed.current[e.key] = false;
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Determine movement checks based on settings or fallback
  const isInputActive = (action: 'up' | 'down' | 'left' | 'right' | 'action') => {
    const bound = settings.bindings[action];
    const normalized = bound === 'Space' ? ' ' : bound;

    if (keysPressed.current[normalized]) return true;
    if (keysPressed.current[bound]) return true;

    // Standard secondary hotkeys for supreme UX
    if (action === 'up' && (keysPressed.current['ArrowUp'] || keysPressed.current['w'])) return true;
    if (action === 'down' && (keysPressed.current['ArrowDown'] || keysPressed.current['s'])) return true;
    if (action === 'left' && (keysPressed.current['ArrowLeft'] || keysPressed.current['a'])) return true;
    if (action === 'right' && (keysPressed.current['ArrowRight'] || keysPressed.current['d'])) return true;
    if (action === 'action' && (keysPressed.current[' '] || keysPressed.current['Enter'])) return true;

    return false;
  };

  // Spawning logic (Enemies and Powerup Potions) inside React lifecycle synced with refs
  useEffect(() => {
    if (gameOver || isPaused) return;

    // Spawning timer for incoming threats (enemies)
    const asteroidInterval = setInterval(() => {
      if (isPaused || gameOver) return;

      const sizes = [
        { radius: 1.0, points: 150 },
        { radius: 1.4, points: 250 },
      ];
      const selected = sizes[Math.floor(Math.random() * sizes.length)];
      
      // Spawn enemy around a perimeter circle outside 25 unit arena
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = 32; // Spawn outside plane
      const sx = Math.cos(angle) * spawnDist;
      const sz = Math.sin(angle) * spawnDist;

      // Direct towards the player's general vicinity
      const targetX = playerRef.current.x + (Math.random() - 0.5) * 6;
      const targetZ = playerRef.current.z + (Math.random() - 0.5) * 6;
      
      const dx = targetX - sx;
      const dz = targetZ - sz;
      const dist = Math.hypot(dx, dz) || 1.0;
      const speed = (2.4 + Math.random() * 2.2) * speedMultiplier;

      // Clone a custom texture sheet for this specific enemy
      const t = enemyTexture.clone();
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(0.25, 0.5); // 4 columns, 2 rows (standing/idle and walking)
      t.needsUpdate = true;

      asteroids.current.push({
        id: nextId.current++,
        x: sx,
        z: sz,
        y: 1.2, // Billboards stand on the ground
        radius: selected.radius,
        hp: 2, // Exactly 2 HP!
        maxHp: 2,
        points: selected.points,
        speed: speed,
        vx: (dx / dist) * speed,
        vz: (dz / dist) * speed,
        
        // sprite sheet parameters
        animTime: 0,
        currentFrame: 0,
        isFlipped: dx < 0,
        texture: t,
        
        // flash timers
        flashRedTime: 0,
        flashWhiteTime: 0,
        
        // knockback vectors
        knockbackTimer: 0,
        knockbackVx: 0,
        knockbackVz: 0,
        
        // death details
        isDead: false,
        deathTimer: 0,
        deathVx: 0,
        deathVz: 0,
      });
    }, 1150 / speedMultiplier);

    // Spawning timer for potion items across the map
    const powerupInterval = setInterval(() => {
      if (isPaused || gameOver) return;
      
      // "สุ่มตกลงมาทั่วแผนที่" - Spawns randomly across the map
      powerups.current.push({
        id: nextId.current++,
        x: (Math.random() - 0.5) * 44,
        z: (Math.random() - 0.5) * 44,
        y: 14.0, // Start high up to fall down elegantly with gravity
        vy: 0.0,
        radius: 0.8,
        type: 'shield',
        active: true,
      });
    }, 5500);

    return () => {
      clearInterval(asteroidInterval);
      clearInterval(powerupInterval);
    };
  }, [isPaused, gameOver, speedMultiplier, enemyTexture]);

  // Group reference for dynamic updating elements in the Three Canvas without React re-render
  const pMeshRef = useRef<THREE.Group | null>(null);
  const pSpriteRef = useRef<THREE.Mesh | null>(null);
  const elementsGroupRef = useRef<THREE.Group | null>(null);

  useFrame((state, delta) => {
    if (gameOver || isPaused) return;

    const p = playerRef.current;
    
    // Check direct P and O triggers
    const isPunchPressed = keysPressed.current['p'] || keysPressed.current['P'];
    const isSkillPressed = keysPressed.current['o'] || keysPressed.current['O'];

    // Handle Active attack timer decay
    if (attackActive.current) {
      attackTimer.current += delta;
      if (attackTimer.current >= attackDuration) {
        attackActive.current = false;
        attackTimer.current = 0;
      }
    }

    // Handle Active energy skill timer decay & expansion
    if (skillActive.current) {
      skillTimer.current += delta;
      skillRadius.current = (skillTimer.current / skillDuration) * 12.0;
      if (skillTimer.current >= skillDuration) {
        skillActive.current = false;
        skillTimer.current = 0;
        skillRadius.current = 0;
      }
    }

    // Determine current look vector bvx/bvz based on directionIdx
    let bvx = 0;
    let bvz = -1; // Default North
    switch (p.directionIdx) {
      case 0: bvx = 0; bvz = 1; break; // South
      case 1: bvx = 0.7; bvz = 0.7; break; // SE
      case 2: bvx = 1; bvz = 0; break; // East
      case 3: bvx = 0.7; bvz = -0.7; break; // NE
      case 4: bvx = 0; bvz = -1; break; // North
      case 5: bvx = -0.7; bvz = -0.7; break; // NW
      case 6: bvx = -1; bvz = 0; break; // West
      case 7: bvx = -0.7; bvz = 0.7; break; // SW
    }

    // Trigger Punch/Attack when P is tapped
    if (isPunchPressed && !attackActive.current && !skillActive.current) {
      attackActive.current = true;
      attackTimer.current = 0;
      playSound('shoot', soundVolume);

      // Flash massive punch sparks
      for (let s = 0; s < 10; s++) {
        particles.current.push({
          id: nextId.current++,
          x: p.x + bvx * 2.2 + (Math.random() - 0.5) * 1.5,
          y: 0.5 + (Math.random() - 0.5) * 0.4,
          z: p.z + bvz * 2.2 + (Math.random() - 0.5) * 1.5,
          vx: bvx * 12 + (Math.random() - 0.5) * 4,
          vy: Math.random() * 4 + 1.5,
          vz: bvz * 12 + (Math.random() - 0.5) * 4,
          color: '#f43f5e',
          alpha: 1.0,
          decay: 0.04 + Math.random() * 0.04,
          size: 0.18,
        });
      }
    }

    // Trigger Expanding Energy Skill when O is tapped
    if (isSkillPressed && !skillActive.current) {
      skillActive.current = true;
      skillTimer.current = 0;
      skillRadius.current = 0;
      playSound('powerup', soundVolume);

      // Radial particle wave
      for (let s = 0; s < 45; s++) {
        const angle = (s / 45) * Math.PI * 2;
        const speed = 12 + Math.random() * 6;
        particles.current.push({
          id: nextId.current++,
          x: p.x,
          y: 0.4,
          z: p.z,
          vx: Math.cos(angle) * speed,
          vy: Math.random() * 6 + 1,
          vz: Math.sin(angle) * speed,
          color: themeColor,
          alpha: 1.0,
          decay: 0.012 + Math.random() * 0.015,
          size: 0.24,
        });
      }
    }

    // Update dynamic Hit Box Center
    hitBoxPos.current.x = p.x + bvx * 2.5;
    hitBoxPos.current.z = p.z + bvz * 2.5;

    // Calculate movement vector
    let mx = 0;
    let mz = 0;

    // Movement allowed if not casting ultimate energy skill
    if (!skillActive.current) {
      if (isInputActive('up')) mz -= 1;
      if (isInputActive('down')) mz += 1;
      if (isInputActive('left')) mx -= 1;
      if (isInputActive('right')) mx += 1;
    }

    // Apply movement with normalized speed
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      // Slow down movement slightly during heavy attack
      const speedModifier = attackActive.current ? 0.4 : 1.0;
      const dx = (mx / len) * p.speed * speedModifier * delta;
      const dz = (mz / len) * p.speed * speedModifier * delta;

      p.x = Math.max(-24.2, Math.min(24.2, p.x + dx));
      p.z = Math.max(-24.2, Math.min(24.2, p.z + dz));

      // Calculate direction index based on vector (8 directions)
      const angle = Math.atan2(mx, -mz); // relative to camera north
      let dirIdx = Math.round((angle / (Math.PI * 2)) * 8);
      if (dirIdx < 0) dirIdx += 8;
      dirIdx = dirIdx % 8;

      p.directionIdx = dirIdx;

      // Update horizontal flipping based on movement
      if (mx < 0) {
        isFlipped.current = true;
      } else if (mx > 0) {
        isFlipped.current = false;
      }
    }

    // Select active animation row state
    if (skillActive.current) {
      playerState.current = 'dance';
    } else if (attackActive.current) {
      playerState.current = 'attack';
    } else if (mx !== 0 || mz !== 0) {
      playerState.current = 'walk';
    } else {
      playerState.current = 'idle';
    }

    // Increment animation frames based on chosen state speeds
    animTime.current += delta;
    // Attack plays FASTER ("เล่น Animation ไวขึ้น") at 16 FPS!
    const fps = playerState.current === 'attack' ? 16 
              : playerState.current === 'walk' ? 8 
              : playerState.current === 'dance' ? 10 
              : 5;

    const frameDuration = 1 / fps;
    if (animTime.current >= frameDuration) {
      animTime.current = 0;
      currentFrame.current = (currentFrame.current + 1) % 4;
    }

    // Update cloned texture sheet offsets
    activeTexture.offset.x = currentFrame.current * 0.25;
    activeTexture.offset.y = playerState.current === 'idle' ? 0.75
                           : playerState.current === 'walk' ? 0.50
                           : playerState.current === 'attack' ? 0.25
                           : 0.00;

    // Apply player coordinates
    if (pMeshRef.current) {
      pMeshRef.current.position.set(p.x, p.y, p.z);
    }

    // Flip billboard mesh scale horizontally if needed
    if (pSpriteRef.current) {
      pSpriteRef.current.scale.set(isFlipped.current ? -2.8 : 2.8, 2.8, 1);
    }

    // Camera following smoothly with luxurious linear interpolation
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, p.x, 0.08);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, p.z + 11, 0.08);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, p.y + 9, 0.08);
    state.camera.lookAt(p.x, p.y, p.z);

    // Shooting actions (traditional space action)
    if (isInputActive('action')) {
      const now = Date.now();
      if (now - p.lastFired > p.fireRate) {
        bullets.current.push({
          id: nextId.current++,
          x: p.x + bvx * 0.8,
          z: p.z + bvz * 0.8,
          vx: bvx * 22,
          vz: bvz * 22,
          active: true,
        });

        p.lastFired = now;
        playSound('shoot', soundVolume);

        for (let s = 0; s < 3; s++) {
          particles.current.push({
            id: nextId.current++,
            x: p.x,
            y: p.y,
            z: p.z,
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 3,
            vz: (Math.random() - 0.5) * 3,
            color: '#ffffff',
            alpha: 1,
            decay: 0.08,
            size: 0.15,
          });
        }
      }
    }

    // Update bullets positions and lifetime
    bullets.current.forEach((b) => {
      b.x += b.vx * delta;
      b.z += b.vz * delta;

      // Deactivate if flies off boundaries
      if (Math.abs(b.x) > 35 || Math.abs(b.z) > 35) {
        b.active = false;
      }
    });
    bullets.current = bullets.current.filter(b => b.active);

    // Update powerups falling physics and collection
    powerups.current.forEach((pw) => {
      // falling physics
      if (pw.y > 0.6) {
        pw.vy -= 18.0 * delta; // gravity falling down
        pw.y += pw.vy * delta;
        if (pw.y <= 0.6) {
          pw.y = 0.6;
          pw.vy = -pw.vy * 0.35; // bouncy landing!
        }
      }

      const dist = Math.hypot(pw.x - p.x, pw.z - p.z);
      if (dist < pw.radius + 1.2) {
        pw.active = false;
        setShield((prev) => {
          const newVal = Math.min(5, prev + 1); // restored 1 out of 5 lives
          playSound('powerup', soundVolume);
          return newVal;
        });

        // Trigger healing green particles
        for (let s = 0; s < 12; s++) {
          particles.current.push({
            id: nextId.current++,
            x: pw.x,
            y: pw.y,
            z: pw.z,
            vx: (Math.random() - 0.5) * 6,
            vy: Math.random() * 5 + 1,
            vz: (Math.random() - 0.5) * 6,
            color: '#10b981',
            alpha: 1,
            decay: 0.02 + Math.random() * 0.02,
            size: 0.18,
          });
        }
      }
    });
    powerups.current = powerups.current.filter(pw => pw.active);

    const nowTime = Date.now();
    const elapsedTime = state.clock.getElapsedTime();

    // Update enemies vectors & deal damage from standard weapon, punch hit box, or expanding energy ring
    asteroids.current.forEach((ast) => {
      // 1. Handle Death State (flying away & rapid white flashing & fading out)
      if (ast.isDead) {
        ast.deathTimer -= delta;
        
        // "กระเด็นออกจากฉากไป" - Fly away rapidly and upward
        ast.x += ast.deathVx * delta;
        ast.z += ast.deathVz * delta;
        ast.y += 16.0 * delta; // fly up high!
        
        // update animation (use standing/idle Row 1 frame)
        ast.animTime += delta;
        if (ast.animTime >= 0.1) {
          ast.animTime = 0;
          ast.currentFrame = (ast.currentFrame + 1) % 4;
        }
        ast.texture.offset.x = ast.currentFrame * 0.25;
        ast.texture.offset.y = 0.5; // Standing/Idle row

        // "กระพริบสีขาวรัวๆ" - Rapid white flashing
        const isWhite = Math.sin(elapsedTime * 45) > 0;
        ast.colorOverride = isWhite ? '#ffffff' : '#666666';
        return; // Skip standard movement & collisions for dead enemies
      }

      // 2. Handle Knockback Slide State ("กระเด็นไปข้างหลังทิศทางที่เดินมา")
      if (ast.knockbackTimer > 0) {
        ast.knockbackTimer -= delta;
        
        // slide backward with deceleration
        ast.x += ast.knockbackVx * delta;
        ast.z += ast.knockbackVz * delta;
        ast.knockbackVx *= 0.92;
        ast.knockbackVz *= 0.92;
        
        // update animation
        ast.animTime += delta;
        if (ast.animTime >= 0.15) {
          ast.animTime = 0;
          ast.currentFrame = (ast.currentFrame + 1) % 4;
        }
        ast.texture.offset.x = ast.currentFrame * 0.25;
        ast.texture.offset.y = 0.5; // Idle/Stunned Row

        // flash white briefly when hit
        if (ast.flashWhiteTime > 0) {
          ast.flashWhiteTime -= delta;
          ast.colorOverride = '#ffffff';
        } else {
          ast.colorOverride = '#e2e8f0';
        }
      } else {
        // 3. Normal Active tracking movement ("เดินเข้ามาโจมตี")
        const dx = p.x - ast.x;
        const dz = p.z - ast.z;
        const dist = Math.hypot(dx, dz) || 1.0;
        
        // Calculate tracking vector towards the player
        const targetVx = (dx / dist) * ast.speed;
        const targetVz = (dz / dist) * ast.speed;
        
        // Smoothly interpolate current velocity towards the player
        ast.vx = THREE.MathUtils.lerp(ast.vx, targetVx, 0.04);
        ast.vz = THREE.MathUtils.lerp(ast.vz, targetVz, 0.04);
        
        ast.x += ast.vx * delta;
        ast.z += ast.vz * delta;

        // update animation
        ast.animTime += delta;
        if (ast.animTime >= 0.12) {
          ast.animTime = 0;
          ast.currentFrame = (ast.currentFrame + 1) % 4;
        }
        ast.texture.offset.x = ast.currentFrame * 0.25;
        ast.texture.offset.y = 0.0; // Row 2: Walk (เดิน)

        // update facing flip
        ast.isFlipped = ast.vx < 0;

        // Apply color overrides
        if (ast.flashWhiteTime > 0) {
          ast.flashWhiteTime -= delta;
          ast.colorOverride = '#ffffff';
        } else if (ast.flashRedTime > 0) {
          ast.flashRedTime -= delta;
          ast.colorOverride = '#ff3333'; // Flashes red when attacking player
        } else {
          ast.colorOverride = '#ffffff';
        }
      }

      // Check player ship collision (Enemy attacks Player)
      const pDist = Math.hypot(ast.x - p.x, ast.z - p.z);
      if (pDist < ast.radius + 1.1) {
        // Attack!
        // "เวลาโจมตีให้กระพริบสีแดง"
        ast.flashRedTime = 0.45;
        
        // Push enemy backward slightly after hitting player so they don't instakill
        const len = Math.hypot(ast.vx, ast.vz) || 1.0;
        ast.x -= (ast.vx / len) * 3.2;
        ast.z -= (ast.vz / len) * 3.2;

        playSound('hurt', soundVolume);

        // Player loses exactly 1 out of 5 lives
        setShield((prevShield) => {
          const updated = Math.max(0, prevShield - 1);
          if (updated <= 0) {
            setGameOver(true);
            playSound('explosion', soundVolume);
          }
          return updated;
        });

        // Spawn red damage hit particles
        for (let s = 0; s < 15; s++) {
          particles.current.push({
            id: nextId.current++,
            x: p.x,
            y: p.y,
            z: p.z,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * 5 + 1.5,
            vz: (Math.random() - 0.5) * 8,
            color: '#ef4444',
            alpha: 1,
            decay: 0.03 + Math.random() * 0.02,
            size: 0.22,
          });
        }
      }

      // Check PUNCH Hit Box collision
      if (attackActive.current) {
        const punchDist = Math.hypot(ast.x - hitBoxPos.current.x, ast.z - hitBoxPos.current.z);
        if (punchDist < ast.radius + 1.9 && (nowTime - (ast.lastHitByPunch || 0) > 400)) {
          ast.lastHitByPunch = nowTime;
          ast.hp -= 1; // takes 1 damage
          
          if (ast.hp === 1) {
            // Hit 1: "กระเด็นไปข้างหลังทิศทางที่เดินมา"
            playSound('hurt', soundVolume);
            ast.flashWhiteTime = 0.25;
            
            const len = Math.hypot(ast.vx, ast.vz) || 1.0;
            ast.knockbackTimer = 0.35;
            ast.knockbackVx = -(ast.vx / len) * 18.0;
            ast.knockbackVz = -(ast.vz / len) * 18.0;
          } else if (ast.hp <= 0) {
            // Hit 2: "กระเด็นออกจากฉากไป หรือ กระพริบสีขาวรัวๆ แล้วหายไป"
            playSound('explosion', soundVolume);
            setScore((prev) => prev + Math.round(ast.points * speedMultiplier));
            
            ast.isDead = true;
            ast.deathTimer = 0.65;
            
            const len = Math.hypot(ast.vx, ast.vz) || 1.0;
            ast.deathVx = -(ast.vx / len) * 25.0;
            ast.deathVz = -(ast.vz / len) * 25.0;
          }

          // Sparks
          for (let s = 0; s < 5; s++) {
            particles.current.push({
              id: nextId.current++,
              x: ast.x,
              y: ast.y,
              z: ast.z,
              vx: (Math.random() - 0.5) * 5,
              vy: Math.random() * 4 + 1,
              vz: (Math.random() - 0.5) * 5,
              color: '#ffffff',
              alpha: 1.0,
              decay: 0.06,
              size: 0.15,
            });
          }
        }
      }

      // Check ULTIMATE ENERGY RING collision
      if (skillActive.current) {
        const ringDist = Math.hypot(ast.x - p.x, ast.z - p.z);
        if (ringDist <= skillRadius.current && ringDist >= skillRadius.current - 2.5 && (nowTime - (ast.lastHitBySkill || 0) > 800)) {
          ast.lastHitBySkill = nowTime;
          ast.hp = 0; // Vaporize instantly!
          ast.isDead = true;
          ast.deathTimer = 0.65;
          
          const dx = ast.x - p.x;
          const dz = ast.z - p.z;
          const dLen = Math.hypot(dx, dz) || 1.0;
          ast.deathVx = (dx / dLen) * 25.0; // Knock out of screen radially
          ast.deathVz = (dz / dLen) * 25.0;

          setScore((prev) => prev + Math.round(ast.points * speedMultiplier * 1.2));
          playSound('explosion', soundVolume);

          // Disintegration particles
          for (let d = 0; d < 14; d++) {
            particles.current.push({
              id: nextId.current++,
              x: ast.x,
              y: ast.y,
              z: ast.z,
              vx: (Math.random() - 0.5) * 14,
              vy: Math.random() * 10,
              vz: (Math.random() - 0.5) * 14,
              color: themeColor,
              alpha: 1,
              decay: 0.015 + Math.random() * 0.02,
              size: 0.26,
            });
          }
        }
      }

      // Check bullets collisions
      bullets.current.forEach((bullet) => {
        if (!bullet.active) return;
        const bDist = Math.hypot(ast.x - bullet.x, ast.z - bullet.z);
        if (bDist < ast.radius + 0.5) {
          bullet.active = false;
          ast.hp -= 1; // takes 1 damage
          
          if (ast.hp === 1) {
            // Hit 1: "กระเด็นไปข้างหลังทิศทางที่เดินมา"
            playSound('hurt', soundVolume);
            ast.flashWhiteTime = 0.25;
            
            const len = Math.hypot(ast.vx, ast.vz) || 1.0;
            ast.knockbackTimer = 0.35;
            ast.knockbackVx = -(ast.vx / len) * 15.0;
            ast.knockbackVz = -(ast.vz / len) * 15.0;
          } else if (ast.hp <= 0) {
            // Hit 2: "กระเด็นออกจากฉากไป หรือ กระพริบสีขาวรัวๆ แล้วหายไป"
            playSound('explosion', soundVolume);
            setScore((prev) => prev + Math.round(ast.points * speedMultiplier));
            
            ast.isDead = true;
            ast.deathTimer = 0.65;
            
            const len = Math.hypot(ast.vx, ast.vz) || 1.0;
            ast.deathVx = -(ast.vx / len) * 22.0;
            ast.deathVz = -(ast.vz / len) * 22.0;
          }

          // bullet hit sparks
          for (let s = 0; s < 4; s++) {
            particles.current.push({
              id: nextId.current++,
              x: bullet.x,
              y: 0.6,
              z: bullet.z,
              vx: (Math.random() - 0.5) * 4,
              vy: Math.random() * 3 + 1,
              vz: (Math.random() - 0.5) * 4,
              color: '#ffffff',
              alpha: 1,
              decay: 0.08,
              size: 0.12,
            });
          }
        }
      });
    });

    // Dispose of any textures for dead enemies that are fully removed
    asteroids.current.forEach((ast) => {
      if (ast.hp <= 0 && ast.deathTimer <= 0) {
        ast.texture.dispose();
      }
    });

    // Filter out fully dead & gone enemies
    asteroids.current = asteroids.current.filter(ast => !ast.isDead || ast.deathTimer > 0);

    // Update fire blast particles decay
    particles.current.forEach((prt) => {
      prt.x += prt.vx * delta;
      prt.y += prt.vy * delta;
      prt.z += prt.vz * delta;
      prt.alpha -= prt.decay;
    });
    particles.current = particles.current.filter(prt => prt.alpha > 0);
  });

  return (
    <group ref={elementsGroupRef}>
      {/* 4. Player Sprite billboard displaying custom sprite sheet animations */}
      <group ref={pMeshRef}>
        <Billboard position={[0, 0.4, 0]} follow={true}>
          <mesh ref={pSpriteRef}>
            <planeGeometry args={[2.8, 2.8]} />
            <meshBasicMaterial 
              map={activeTexture} 
              transparent 
              alphaTest={0.05} 
              side={THREE.DoubleSide} 
            />
          </mesh>
        </Billboard>
        
        {/* Underbody indicator ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.38, 0]}>
          <ringGeometry args={[0.7, 0.8, 16]} />
          <meshBasicMaterial color={themeColor} transparent opacity={0.65} />
        </mesh>
      </group>

      {/* Render Expanding Energy Ring Wave */}
      {skillActive.current && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[playerRef.current.x, 0.05, playerRef.current.z]}>
          <ringGeometry args={[Math.max(0.1, skillRadius.current - 0.5), skillRadius.current + 0.1, 32]} />
          <meshBasicMaterial color={themeColor} transparent opacity={0.8 * (1 - skillRadius.current / 12.0)} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Render Active Punch Hit Box */}
      {attackActive.current && (
        <group position={[hitBoxPos.current.x, 0.5, hitBoxPos.current.z]}>
          <mesh>
            <boxGeometry args={[4.0, 1.0, 4.0]} />
            <meshBasicMaterial color="#f43f5e" transparent opacity={0.2} />
          </mesh>
          <mesh>
            <boxGeometry args={[4.0, 1.0, 4.0]} />
            <meshBasicMaterial color="#f43f5e" wireframe />
          </mesh>
        </group>
      )}

      {/* Render Active Enemies as 2D Billboard animated spritesheets */}
      {asteroids.current.map((ast) => (
        <group key={ast.id} position={[ast.x, ast.y, ast.z]}>
          <Billboard follow={true}>
            <mesh scale={[ast.isFlipped ? -2.4 * ast.radius : 2.4 * ast.radius, 2.4 * ast.radius, 1]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial 
                map={ast.texture} 
                transparent 
                alphaTest={0.05} 
                side={THREE.DoubleSide}
                color={ast.colorOverride || '#ffffff'}
              />
            </mesh>
          </Billboard>
        </group>
      ))}

      {/* Render Active Bullets */}
      {bullets.current.map((b) => (
        <mesh key={b.id} position={[b.x, 0.5, b.z]}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Render Active potion item modules */}
      {powerups.current.map((pw) => (
        <group key={pw.id} position={[pw.x, pw.y, pw.z]}>
          <Billboard follow={true}>
            <mesh scale={[1.6, 1.6, 1]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial 
                map={potionTexture} 
                transparent 
                alphaTest={0.05} 
                side={THREE.DoubleSide} 
              />
            </mesh>
          </Billboard>
        </group>
      ))}

      {/* Render active particles */}
      {particles.current.map((p) => (
        <mesh key={p.id} position={[p.x, p.y, p.z]}>
          <boxGeometry args={[p.size, p.size, p.size]} />
          <meshBasicMaterial color={p.color} transparent opacity={p.alpha} />
        </mesh>
      ))}
    </group>
  );
}

export default function GameScreen({ settings, onBackToTitle }: GameScreenProps) {
  const [score, setScore] = useState(0);
  const [shield, setShield] = useState(5);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  // Retrieve theme visual configurations
  const getThemeColors = (p: ThemePalette) => {
    switch (p) {
      case 'cyberpink':
        return { text: 'text-rose-500', hex: '#f43f5e', bg: 'bg-rose-500', glow: 'shadow-rose-500/50' };
      case 'emerald':
        return { text: 'text-emerald-400', hex: '#34d399', bg: 'bg-emerald-500', glow: 'shadow-emerald-500/50' };
      case 'amethyst':
        return { text: 'text-purple-500', hex: '#a855f7', bg: 'bg-purple-500', glow: 'shadow-purple-500/50' };
      case 'classic':
        return { text: 'text-amber-500', hex: '#f59e0b', bg: 'bg-amber-500', glow: 'shadow-amber-500/50' };
    }
  };

  const c = getThemeColors(settings.theme);

  // Load high scores
  useEffect(() => {
    const scores = localStorage.getItem(`cyber_arena_scores_${settings.difficulty}`);
    if (scores) {
      setHighScores(JSON.parse(scores));
    } else {
      const defaults = [
        { name: 'PILOT-A', score: 3200, date: '2026-07-01' },
        { name: 'TITAN', score: 2100, date: '2026-07-05' },
        { name: 'KAY', score: 1200, date: '2026-07-08' }
      ];
      setHighScores(defaults);
      localStorage.setItem(`cyber_arena_scores_${settings.difficulty}`, JSON.stringify(defaults));
    }
  }, [settings.difficulty]);

  // Handle Score Record Saving
  const handleSaveScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const newRecord: HighScore = {
      name: playerName.trim().substring(0, 10).toUpperCase(),
      score: score,
      date: new Date().toISOString().split('T')[0],
    };

    const updated = [...highScores, newRecord]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Keep top 5 only

    setHighScores(updated);
    localStorage.setItem(`cyber_arena_scores_${settings.difficulty}`, JSON.stringify(updated));
    setIsSaved(true);
    playSound('select', settings.soundVolume);
  };

  const handleRestart = () => {
    playSound('select', settings.soundVolume);
    setScore(0);
    setShield(5);
    setIsSaved(false);
    setPlayerName('');
    setGameOver(false);
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#030206] text-white flex flex-col font-mono">
      
      {/* 3D WebGL Canvas for interactive game experience */}
      <Suspense fallback={
        <div className="absolute inset-0 bg-[#030206] flex flex-col items-center justify-center gap-4 z-10">
          <Sparkles className="w-8 h-8 text-rose-500 animate-spin" />
          <p className="text-xs font-game tracking-wider text-slate-400">LOADING ARCADE STAGE...</p>
        </div>
      }>
        <Canvas 
          shadows 
          className="absolute inset-0 w-full h-full block"
          camera={{ position: [0, 10, 12], fov: 60 }}
        >
          <ambientLight color="#1e1b4b" intensity={0.9} />
          <directionalLight 
            position={[15, 25, 10]} 
            intensity={1.8} 
            color="#f43f5e" 
            castShadow 
          />
          <pointLight position={[0, 12, 0]} intensity={1.5} color={c.hex} />
          
          <Ground theme={settings.theme} />
          <ArenaWalls themeColor={c.hex} />
          
          <ArenaStage
            settings={settings}
            score={score}
            setScore={setScore}
            shield={shield}
            setShield={setShield}
            gameOver={gameOver}
            setGameOver={setGameOver}
            isPaused={isPaused}
            themeColor={c.hex}
          />
        </Canvas>
      </Suspense>

      {/* Heads Up Display Overlays */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
        
        {/* Left Side stats: score and level details */}
        <div className="flex flex-col gap-1 pointer-events-auto bg-slate-950/85 border-2 border-slate-900 p-3.5 rounded-xl backdrop-blur-md shadow-lg">
          <div className="text-[10px] text-slate-400 tracking-widest font-game">GRID SCORE</div>
          <div className="text-xl md:text-2xl font-orbitron font-extrabold text-white tracking-widest leading-none">
            {String(score).padStart(6, '0')}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400">
            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded font-bold uppercase tracking-wider text-[9px]">
              DIFFICULTY: {settings.difficulty}
            </span>
          </div>
        </div>

        {/* Action Controls Reminder */}
        <div className="hidden lg:flex flex-col gap-1 pointer-events-auto bg-slate-950/85 border-2 border-slate-900 p-2.5 rounded-xl backdrop-blur-md">
          <span className="text-[9px] text-slate-400 tracking-wider">ACTIVE HOTKEYS</span>
          <div className="flex gap-3 text-[10px] font-bold text-slate-300">
            <span>🚀 MOVE: [W/A/S/D or ARROWS]</span>
            <span>💥 SHOOT: [{settings.bindings.action}]</span>
            <span>🥊 PUNCH: [P]</span>
            <span>🌀 ENERGY RING: [O]</span>
          </div>
        </div>

        {/* Right Side Stats: Shield health indicator and Pause Button */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="flex flex-col items-end gap-1 bg-slate-950/85 border-2 border-slate-900 p-3 rounded-xl backdrop-blur-md shadow-lg min-w-[150px]">
            <div className="flex justify-between w-full text-[10px] tracking-wider text-slate-400 font-bold">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-emerald-400" /> LIVES LEFT</span>
              <span className={shield > 1 ? 'text-emerald-400' : 'text-rose-500 animate-pulse'}>{shield} / 5</span>
            </div>
            {/* Custom styled Health/Shield bar */}
            <div className="w-full h-2.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all duration-150 ${shield > 3 ? 'bg-emerald-500' : shield > 1 ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`}
                style={{ width: `${(shield / 5) * 100}%` }}
              />
            </div>
          </div>

          <button
            id="pause-btn"
            onClick={() => {
              playSound('click', settings.soundVolume);
              setIsPaused(!isPaused);
            }}
            className="p-3 bg-slate-950/85 border-2 border-slate-900 hover:border-slate-700 text-slate-300 rounded-xl hover:text-white transition-colors cursor-pointer"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Screen Damage flash effect */}
      {shield <= 2 && (
        <div className="absolute inset-0 pointer-events-none border-4 border-rose-600/30 animate-pulse z-10" />
      )}

      {/* Pause Screen Overlay */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="pause-overlay"
            className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col justify-center items-center z-20"
          >
            <div className="bg-slate-950 border-2 border-slate-800 p-8 rounded-2xl max-w-sm w-full text-center flex flex-col gap-6 shadow-2xl relative">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 p-3 bg-slate-900 border border-slate-700 rounded-full text-slate-300 shadow-md">
                <Pause className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <h3 className="text-xl font-orbitron font-extrabold tracking-widest text-white uppercase mt-2">
                  MISSION PAUSED
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">
                  Pilot, your current trajectory is suspended. Calibrate system before re-entry.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  id="resume-mission-btn"
                  onClick={() => {
                    playSound('select', settings.soundVolume);
                    setIsPaused(false);
                  }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-black font-game text-[10px] tracking-wider rounded-xl transition-all duration-200 cursor-pointer shadow-md"
                >
                  RESUME MISSION
                </button>

                <button
                  id="abort-mission-btn"
                  onClick={() => {
                    playSound('click', settings.soundVolume);
                    onBackToTitle();
                  }}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-rose-500 font-mono text-xs tracking-wider rounded-xl transition-all duration-200 cursor-pointer"
                >
                  ABORT MISSION & RETURN
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Screen Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            id="gameover-overlay"
            className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col justify-center items-center z-30 p-4"
          >
            <div className="bg-slate-950 border-2 border-slate-800 p-6 md:p-8 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col gap-6">
              
              <div className="text-center">
                <span className="text-[10px] font-game text-rose-500 animate-pulse tracking-widest">
                  PILOT ELIMINATED
                </span>
                <h2 className="text-3xl font-orbitron font-black text-white mt-1.5 uppercase tracking-wider">
                  MISSION FAILURE
                </h2>
                <div className="h-1 w-24 bg-rose-500 mx-auto my-3 rounded" />
              </div>

              {/* Score Display board */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">FINAL SCORE</div>
                  <div className={`text-2xl font-orbitron font-black tracking-widest ${c.text}`}>
                    {score}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">DIFFICULTY</div>
                  <div className="text-xs font-mono font-bold uppercase text-slate-300">
                    {settings.difficulty}
                  </div>
                </div>
              </div>

              {/* Submit High Score Form */}
              {!isSaved ? (
                <form onSubmit={handleSaveScore} className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50 flex flex-col gap-2.5">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wide flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" /> REGISTER PILOT CLASSIFICATION
                  </span>
                  <div className="flex gap-2">
                    <input
                      id="pilot-name-input"
                      type="text"
                      maxLength={10}
                      placeholder="ENTER PILOT CALLSIGN"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="flex-1 bg-black border border-slate-800 hover:border-slate-700 focus:border-slate-500 focus:outline-none px-3.5 py-2 text-xs rounded uppercase tracking-widest font-bold placeholder:text-slate-700"
                    />
                    <button
                      id="save-score-submit-btn"
                      type="submit"
                      disabled={!playerName.trim()}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-black font-mono text-xs font-black rounded uppercase tracking-wide cursor-pointer disabled:opacity-40"
                    >
                      SAVE
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-900/40 text-center text-xs text-emerald-400 font-medium">
                  ✓ Highscore classification record locked in orbit!
                </div>
              )}

              {/* Leaderboard panel */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500" /> ARENA HIGH SCORES ({settings.difficulty})
                </span>
                <div className="flex flex-col gap-1.5 bg-slate-900/30 p-3 rounded-xl border border-slate-800/40">
                  {highScores.map((record, index) => (
                    <div key={index} className="flex justify-between text-xs font-mono">
                      <span className="flex items-center gap-2">
                        <span className="text-slate-600 font-black">#{index + 1}</span>
                        <span className="font-extrabold text-white">{record.name}</span>
                      </span>
                      <span className={`font-black ${c.text}`}>{record.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  id="restart-mission-btn"
                  onClick={handleRestart}
                  className="py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white rounded-xl font-mono text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> RESTART MISSION
                </button>
                <button
                  id="game-over-back-btn"
                  onClick={onBackToTitle}
                  className="py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl font-mono text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Home className="w-4 h-4" /> RETURN HOME
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
