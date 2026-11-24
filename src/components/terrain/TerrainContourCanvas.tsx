import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  speed: number;
  life: number;
  maxLife: number;
  length: number;
  alpha: number;
}

interface TerrainContourCanvasProps {
  className?: string;
  showCoordinates?: boolean;
}

export const TerrainContourCanvas: React.FC<TerrainContourCanvasProps> = ({
  className = '',
  showCoordinates = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number; elevation: number }>({
    x: 0,
    y: 0,
    elevation: 34.2,
  });
  const [flowActive, setFlowActive] = useState<boolean>(true);
  const [contourDensity, setContourDensity] = useState<'standard' | 'high'>('standard');
  const mousePosRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const animFrameId = useRef<number | null>(null);

  // Elevation calculation function: combination of 2D sin/cos harmonics to create realistic ridge/valley terrain
  const getElevation = useCallback((x: number, y: number, t: number) => {
    const scale = 0.0035;
    const wave1 = Math.sin(x * scale + 1.2) * Math.cos(y * scale + 0.8) * 22;
    const wave2 = Math.sin((x + y) * scale * 0.8 + t * 0.2) * 14;
    const wave3 = Math.cos((x * 1.5 - y) * scale * 0.5) * 8;
    // Base elevation datum (meters)
    return 20 + wave1 + wave2 + wave3;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initialize hydrological particle streams tracing downward gradients
    const particles: Particle[] = [];
    const maxParticles = 65;

    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 0.6 + Math.random() * 1.2,
        life: Math.random() * 200,
        maxLife: 150 + Math.random() * 120,
        length: 8 + Math.random() * 16,
        alpha: 0.15 + Math.random() * 0.45,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.005;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Technical Coordinate Grid
      const gridSize = 48;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 2. Draw Subtle Grid Intersections (Crosshairs)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
      for (let x = gridSize; x < width; x += gridSize * 2) {
        for (let y = gridSize; y < height; y += gridSize * 2) {
          ctx.fillRect(x - 2, y, 5, 1);
          ctx.fillRect(x, y - 2, 1, 5);
        }
      }

      // 3. Draw Topographic Contours using Horizontal Slice Scanning
      const stepY = contourDensity === 'high' ? 8 : 14;
      const stepX = 12;
      const contourInterval = contourDensity === 'high' ? 3.5 : 5.0;

      ctx.lineWidth = 1;

      // Scan rows to find and connect isolines
      for (let y = 0; y < height; y += stepY) {
        let inContour = false;
        ctx.beginPath();

        for (let x = 0; x < width; x += stepX) {
          // Interactive mouse elevation depression / pressure
          const distToMouse = Math.hypot(x - mousePosRef.current.x, y - mousePosRef.current.y);
          const mouseEffect = distToMouse < 180 ? Math.cos((distToMouse / 180) * (Math.PI / 2)) * 6 : 0;

          const elevation = getElevation(x, y, time) - mouseEffect;
          const isContourLine = Math.floor(elevation / contourInterval) % 2 === 0;
          const isMajorContour = Math.floor(elevation / (contourInterval * 3)) % 2 === 0;

          if (isContourLine) {
            if (!inContour) {
              ctx.moveTo(x, y);
              inContour = true;
            } else {
              ctx.lineTo(x, y);
            }
          } else {
            inContour = false;
          }

          // Occasionally render elevation text markers along contours
          if (x % 240 === 0 && y % 80 === 0) {
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.fillStyle = isMajorContour ? 'rgba(255, 94, 30, 0.45)' : 'rgba(148, 163, 184, 0.3)';
            ctx.fillText(`${elevation.toFixed(1)}m`, x + 4, y - 3);
          }
        }

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.stroke();
      }

      // 4. Hydrological Water Flow Particles (Streamlets)
      if (flowActive) {
        for (const p of particles) {
          p.life++;
          if (p.life > p.maxLife) {
            p.life = 0;
            p.x = Math.random() * width;
            p.y = Math.random() * height;
          }

          // Compute elevation gradient vector (finite differences)
          const delta = 4;
          const eCenter = getElevation(p.x, p.y, time);
          const eRight = getElevation(p.x + delta, p.y, time);
          const eDown = getElevation(p.x, p.y + delta, time);

          const gradX = -(eRight - eCenter) / delta;
          const gradY = -(eDown - eCenter) / delta;

          // Water flows down the gradient
          const length = Math.hypot(gradX, gradY) || 1;
          const dirX = (gradX / length) * p.speed * 1.5;
          const dirY = (gradY / length) * p.speed * 1.5 + 0.3; // Slight gravity bias

          p.x += dirX;
          p.y += dirY;

          // Wrap boundaries
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          // Draw streamlined water flow vector
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - dirX * (p.length * 0.8), p.y - dirY * (p.length * 0.8));
          ctx.strokeStyle = `rgba(2, 132, 199, ${p.alpha * 0.8})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Particle leading head
          ctx.fillStyle = 'rgba(255, 94, 30, 0.6)';
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        }
      }

      // 5. Draw Target Coordinate Crosshairs when mouse is over canvas
      if (mousePosRef.current.x > 0 && mousePosRef.current.y > 0) {
        const mx = mousePosRef.current.x;
        const my = mousePosRef.current.y;

        // Radial range indicator
        ctx.strokeStyle = 'rgba(255, 94, 30, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mx, my, 40, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 94, 30, 0.15)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(mx, my, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cross lines
        ctx.strokeStyle = 'rgba(255, 94, 30, 0.4)';
        ctx.beginPath();
        ctx.moveTo(mx - 20, my);
        ctx.lineTo(mx + 20, my);
        ctx.moveTo(mx, my - 20);
        ctx.lineTo(mx, my + 20);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#FF5E1E';
        ctx.beginPath();
        ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [flowActive, contourDensity, getElevation]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePosRef.current = { x, y };

    // Update real-time elevation reading
    const el = getElevation(x, y, 0);
    setCoords({ x: Math.round(x), y: Math.round(y), elevation: Number(el.toFixed(1)) });
  };

  const handleMouseLeave = () => {
    mousePosRef.current = { x: -1000, y: -1000 };
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full block cursor-crosshair"
      />

      {/* Floating Tactical Canvas HUD Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-onyx-900/90 backdrop-blur-md px-3 py-1.5 rounded border border-onyx-800 text-[11px] font-mono select-none z-10 shadow-tactical">
        <button
          onClick={() => setFlowActive(!flowActive)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
            flowActive
              ? 'bg-hydro-500/20 text-blue-300 border border-hydro-500/40'
              : 'text-storm-400 hover:text-storm-200'
          }`}
          title="Toggle Hydrological Surface Flow Vectors"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${flowActive ? 'bg-hydro-500 animate-pulse' : 'bg-storm-500'}`} />
          <span>FLOW VECTORS: {flowActive ? 'ACTIVE' : 'OFF'}</span>
        </button>

        <div className="w-[1px] h-3.5 bg-onyx-700" />

        <button
          onClick={() => setContourDensity(contourDensity === 'standard' ? 'high' : 'standard')}
          className="px-2 py-1 rounded text-storm-400 hover:text-storm-200 hover:bg-onyx-800 transition-colors"
          title="Toggle Topographic Contour Interval"
        >
          CONTOURS: {contourDensity.toUpperCase()}
        </button>
      </div>

      {/* Technical Coordinate & Hydrological Readout Strip */}
      {showCoordinates && (
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] font-mono text-storm-400 bg-onyx-950/85 backdrop-blur-sm px-3 py-1.5 rounded border border-onyx-800/80 pointer-events-none z-10">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-storm-300">
              <span className="w-1.5 h-1.5 rounded-full bg-safety-orange" />
              <span>TERRAIN DATUM: WGS84 / UTM-31N</span>
            </span>
            <span className="hidden sm:inline text-onyx-700">|</span>
            <span className="hidden sm:inline">
              X:{coords.x.toString().padStart(4, '0')} Y:{coords.y.toString().padStart(4, '0')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span>
              ELEVATION:{' '}
              <span className="text-safety-orange font-semibold">{coords.elevation.toFixed(1)}m</span>
            </span>
            <span className="text-onyx-700">|</span>
            <span className="text-storm-400">RESOLUTION: 1.0m DEM</span>
          </div>
        </div>
      )}
    </div>
  );
};
