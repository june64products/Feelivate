import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sparkles, Droplets, HeartHandshake, Wine, Waves } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export const HorizontalScrollText = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const container = containerRef.current;
    const text = textRef.current;
    
    if (!container || !text) return;

    const getScrollAmount = () => {
      let textWidth = text.scrollWidth;
      return -(textWidth - window.innerWidth);
    };

    const tween = gsap.to(text, {
      x: getScrollAmount,
      ease: "none",
    });

    ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: () => `+=${getScrollAmount() * -1}`,
      pin: true,
      animation: tween,
      scrub: 1,
      invalidateOnRefresh: true,
    });
    
    return () => {
      tween.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, { scope: containerRef });

  return (
    <div 
      ref={containerRef} 
      style={{ 
        overflow: 'hidden', 
        background: '#111111', 
        color: '#f2f2f2', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div 
        ref={textRef}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4vw', 
          whiteSpace: 'nowrap', 
          padding: '0 5vw',
          fontSize: 'clamp(48px, 8vw, 140px)',
          fontWeight: 700,
          fontFamily: "'Clash Display', 'Inter', sans-serif",
          letterSpacing: '-0.03em',
        }}
      >
        <span>In every</span>
        <Wine size={80} strokeWidth={1.5} color="#b6b5b5" style={{ flexShrink: 0 }} />
        <span>bottle,</span>
        
        <span>discover the</span>
        <Sparkles size={80} strokeWidth={1.5} color="#b6b5b5" style={{ flexShrink: 0 }} />
        <span>undeniable</span>
        
        <span style={{ 
          fontStyle: 'italic', 
          fontFamily: "'Georgia', 'Times New Roman', serif", 
          fontWeight: 400,
          color: '#838282',
          padding: '0 2vw'
        }}>
          Real Magic
        </span>
        
        <span>of sharing</span>
        <HeartHandshake size={80} strokeWidth={1.5} color="#b6b5b5" style={{ flexShrink: 0 }} />
        <span>pure</span>
        
        <span>Refreshment</span>
        <Droplets size={80} strokeWidth={1.5} color="#b6b5b5" style={{ flexShrink: 0 }} />
        
        <span>that brings us</span>
        <Waves size={80} strokeWidth={1.5} color="#b6b5b5" style={{ flexShrink: 0 }} />
        <span>Together</span>
      </div>
    </div>
  );
};
