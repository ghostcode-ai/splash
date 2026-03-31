'use client';

import { useRef, useEffect, useState } from 'react';
import { SplashEngine } from '@/lib/engine';

export function SplashExperience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new SplashEngine(canvas);
    engine.init();

    // Start once fonts are ready — hide loading screen imperatively
    let started = false;
    document.fonts.ready.then(() => {
      if (started) return;
      started = true;
      engine.start();
      // Hide loading screen directly (React re-render may lag behind heavy animation)
      const loader = document.querySelector('.loading-screen');
      if (loader) {
        const el = loader as HTMLElement;
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        setTimeout(() => { el.style.display = 'none'; }, 1000);
      }
      setLoaded(true);
    });

    const handleResize = () => engine.init();
    window.addEventListener('resize', handleResize);

    return () => {
      started = true; // prevent late start
      window.removeEventListener('resize', handleResize);
      engine.destroy();
    };
  }, []);

  return (
    <>
      <div className={`loading-screen ${loaded ? '--hidden' : ''}`}>
        <div className="loading-text">ghostcode</div>
        <div className="loading-bar">
          <div className="loading-bar-fill" style={{ width: loaded ? '100%' : '30%' }} />
        </div>
      </div>
      <canvas ref={canvasRef} className="splash-canvas" />
    </>
  );
}
