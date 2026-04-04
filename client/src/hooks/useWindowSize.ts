import { useState, useEffect } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

export function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return size;
}

// Breakpoints matching professional standards
export const BREAKPOINTS = {
  mobile: 640,    // phones
  tablet: 1024,   // tablets / small laptops
  desktop: 1280,  // desktops
} as const;

export function useIsMobile() {
  const { width } = useWindowSize();
  return width < BREAKPOINTS.mobile;
}

export function useIsTablet() {
  const { width } = useWindowSize();
  return width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
}

export function useIsDesktop() {
  const { width } = useWindowSize();
  return width >= BREAKPOINTS.tablet;
}
