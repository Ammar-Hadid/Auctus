'use client';
import { useLayoutEffect, useRef } from 'react';

// Mobile browsers resize/pan the visual viewport independently when their
// keyboard or browser chrome opens. Keep both bottom surfaces on the same edge.
export function useBottomLayout() {
  const navigation = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const measure = () => {
      const height = navigation.current?.getBoundingClientRect().height ?? 0;
      const inset =
        viewport && viewport.scale === 1
          ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
          : 0;
      root.style.setProperty('--mobile-nav-height', `${height}px`);
      root.style.setProperty('--viewport-bottom-offset', `${inset}px`);
    };
    const observer = new ResizeObserver(measure);
    if (navigation.current) observer.observe(navigation.current);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    window.addEventListener('pageshow', measure);
    measure();
    return () => {
      observer.disconnect();
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pageshow', measure);
      root.style.removeProperty('--mobile-nav-height');
      root.style.removeProperty('--viewport-bottom-offset');
    };
  }, []);
  return navigation;
}
