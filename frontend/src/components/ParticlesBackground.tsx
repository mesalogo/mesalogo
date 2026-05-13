import React, { useEffect, useRef } from 'react';

interface ParticlesBackgroundProps {
  isDark: boolean;
}

const ParticlesBackground: React.FC<ParticlesBackgroundProps> = ({ isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const particleColor = isDark 
      ? 'rgba(102, 126, 234, 0.8)' 
      : 'rgba(102, 126, 234, 0.6)';

    const particleList: Array<{ x: number; y: number; baseVx: number; baseVy: number; size: number }> = [];
    for (let i = 0; i < 80; i++) {
      const vx = (Math.random() - 0.5) * 0.5;
      const vy = (Math.random() - 0.5) * 0.5;
      particleList.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        baseVx: vx,
        baseVy: vy,
        size: Math.random() * 2 + 1,
      });
    }

    const mouseRadius = 150;
    const mouseStrength = 0.03;

    let frameId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      particleList.forEach((p, i) => {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let extraVx = 0;
        let extraVy = 0;
        if (dist < mouseRadius && dist > 0) {
          const force = (mouseRadius - dist) / mouseRadius;
          extraVx = (dx / dist) * force * mouseStrength * 10;
          extraVy = (dy / dist) * force * mouseStrength * 10;
        }

        p.x += p.baseVx + extraVx;
        p.y += p.baseVy + extraVy;
        
        if (p.x < 0 || p.x > canvas.width) p.baseVx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.baseVy *= -1;
        p.x = Math.max(0, Math.min(canvas.width, p.x));
        p.y = Math.max(0, Math.min(canvas.height, p.y));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = particleColor;
        ctx.fill();

        particleList.slice(i + 1).forEach((p2) => {
          const pdx = p.x - p2.x;
          const pdy = p.y - p2.y;
          const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pdist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const alpha = (isDark ? 0.3 : 0.2) * (1 - pdist / 120);
            ctx.strokeStyle = 'rgba(102, 126, 234, ' + alpha + ')';
            ctx.stroke();
          }
        });

        if (dist < mouseRadius) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          const alpha = (isDark ? 0.4 : 0.3) * (1 - dist / mouseRadius);
          ctx.strokeStyle = 'rgba(102, 126, 234, ' + alpha + ')';
          ctx.stroke();
        }
      });
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDark]);

  const bgColor = isDark ? '#1a1a2e' : '#f5f7fa';

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: bgColor,
      }}
    />
  );
};

export default ParticlesBackground;
