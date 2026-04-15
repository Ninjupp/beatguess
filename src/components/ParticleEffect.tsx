import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  velocity: { x: number; y: number };
  type: 'block' | 'line' | 'text' | 'glitch';
  text?: string;
  delay: number;
}

export default function ParticleEffect({ active, count = 40 }: { active: boolean; count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (active) {
      const newParticles: Particle[] = [];
      const colors = ['#10b981', '#ffffff', '#ff003c', '#000000'];
      const types: ('block' | 'line' | 'text' | 'glitch')[] = ['block', 'line', 'text', 'glitch', 'block', 'line'];
      const texts = ['SYS_ERR', 'OVERRIDE', 'NULL', '0xDEAD', 'FATAL', 'WIN', 'SCORE'];
      
      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const isHorizontal = Math.random() > 0.5;
        
        let width = 10;
        let height = 10;
        
        if (type === 'line') {
          width = isHorizontal ? Math.random() * 200 + 50 : Math.random() * 10 + 2;
          height = isHorizontal ? Math.random() * 10 + 2 : Math.random() * 200 + 50;
        } else if (type === 'block' || type === 'glitch') {
          width = Math.random() * 80 + 20;
          height = Math.random() * 80 + 20;
        }

        newParticles.push({
          id: Math.random(),
          x: (Math.random() - 0.5) * 100, // percentage offset from center
          y: (Math.random() - 0.5) * 100,
          width,
          height,
          color: colors[Math.floor(Math.random() * colors.length)],
          velocity: {
            x: (Math.random() - 0.5) * 100,
            y: (Math.random() - 0.5) * 100,
          },
          type,
          text: type === 'text' ? texts[Math.floor(Math.random() * texts.length)] : undefined,
          delay: Math.random() * 0.2,
        });
      }
      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [active, count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ 
              x: `${p.x}vw`, 
              y: `${p.y}vh`, 
              scaleX: p.type === 'glitch' ? 5 : 0,
              scaleY: p.type === 'glitch' ? 0.1 : 0,
              opacity: 1,
              skewX: p.type === 'glitch' ? '45deg' : '0deg'
            }}
            animate={{ 
              x: `${p.x + p.velocity.x}vw`, 
              y: `${p.y + p.velocity.y}vh`, 
              scaleX: [0, 1.5, 1, 0],
              scaleY: [0, 1.5, 1, 0],
              opacity: [1, 1, 0],
              skewX: p.type === 'glitch' ? ['45deg', '-45deg', '0deg'] : '0deg',
              filter: p.type === 'glitch' ? ['invert(100%)', 'hue-rotate(90deg)', 'none'] : 'none'
            }}
            transition={{ 
              duration: 0.4 + Math.random() * 0.6, 
              delay: p.delay,
              ease: "circOut",
              times: [0, 0.2, 0.8, 1]
            }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: p.type !== 'text' ? p.width : 'auto',
              height: p.type !== 'text' ? p.height : 'auto',
              backgroundColor: p.type !== 'text' ? p.color : 'transparent',
              border: p.type === 'block' && p.color === '#000000' ? `4px solid #10b981` : 'none',
              color: p.color === '#000000' ? '#10b981' : p.color,
              fontFamily: 'monospace',
              fontWeight: '900',
              fontSize: Math.random() * 24 + 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              mixBlendMode: p.type === 'glitch' ? 'difference' : 'normal',
              textTransform: 'uppercase',
              letterSpacing: '0.2em'
            }}
          >
            {p.type === 'text' && p.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
