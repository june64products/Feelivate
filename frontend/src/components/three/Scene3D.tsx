import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { MotionValue } from 'framer-motion';
import * as THREE from 'three';

/**
 * Scattered particles (scattered intentions / chaos) COLLAPSE into a clean,
 * structured grid as you scroll — what Feelivate does to a fuzzy goal: turn it
 * into a locked, structured plan. Monochrome, Swiss.
 * Enhancements: staggered (organic) collapse, mouse parallax, living drift.
 */
function OrderField({ progress, count, isMobile }: { progress: MotionValue<number>; count: number; isMobile: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const parallax = useRef({ x: 0, y: 0 });
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const MAX_DELAY = 0.34;

  const { chaos, order, delay, live } = useMemo(() => {
    const chaos = new Float32Array(count * 3);
    const order = new Float32Array(count * 3);
    const delay = new Float32Array(count);
    const cols = isMobile ? 28 : 48;
    const rows = Math.ceil(count / cols);
    const spacing = (isMobile ? 9 : 15) / cols;

    for (let i = 0; i < count; i++) {
      chaos[i * 3] = (Math.random() - 0.5) * 20;
      chaos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      chaos[i * 3 + 2] = (Math.random() - 0.5) * 14;
      const cx = i % cols;
      const cy = Math.floor(i / cols);
      order[i * 3] = (cx - cols / 2 + 0.5) * spacing;
      order[i * 3 + 1] = (cy - rows / 2 + 0.5) * spacing;
      order[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      delay[i] = Math.random() * MAX_DELAY; // each particle arrives a little differently
    }
    return { chaos, order, delay, live: chaos.slice() };
  }, [count, isMobile]);

  useFrame((state) => {
    const p = progress.get();
    const raw = Math.min(p / 0.62, 1);
    const tm = state.clock.elapsedTime;

    // smooth mouse parallax
    parallax.current.x += (mouse.current.x - parallax.current.x) * 0.04;
    parallax.current.y += (mouse.current.y - parallax.current.y) * 0.04;

    const geo = ref.current?.geometry;
    if (geo) {
      const arr = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        // staggered per-particle progress
        const lr = Math.min(Math.max((raw - delay[i]) / (1 - MAX_DELAY), 0), 1);
        const ti = lr * lr * (3 - 2 * lr);
        const drift = (1 - ti) * Math.sin(chaos[ix] * 0.2 + tm * 0.5 + i) * 0.12; // scattered breathes
        const wave = ti * Math.sin(order[ix] * 0.5 + order[ix + 1] * 0.5 + tm * 0.8) * 0.14; // ordered ripples
        arr[ix] = chaos[ix] + (order[ix] - chaos[ix]) * ti;
        arr[ix + 1] = chaos[ix + 1] + (order[ix + 1] - chaos[ix + 1]) * ti + drift;
        arr[ix + 2] = chaos[ix + 2] + (order[ix + 2] - chaos[ix + 2]) * ti + wave;
      }
      geo.attributes.position.needsUpdate = true;
    }

    if (ref.current) {
      ref.current.rotation.y = tm * 0.04 + p * 0.7 + parallax.current.x * 0.35;
      ref.current.rotation.x = -0.3 + Math.sin(tm * 0.12) * 0.05 - parallax.current.y * 0.2;
      ref.current.position.y = -p * 1.2;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[live, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#eaeaea" size={0.034} sizeAttenuation transparent opacity={0.78} depthWrite={false} />
    </points>
  );
}

export default function Scene3D({ progress, isMobile }: { progress: MotionValue<number>; isMobile: boolean }) {
  return (
    <Canvas
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      camera={{ position: [0, 0, 9], fov: 42 }}
      dpr={[1, isMobile ? 1.4 : 2]}
      gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 9, 21]} />
      <OrderField progress={progress} count={isMobile ? 900 : 2200} isMobile={isMobile} />
    </Canvas>
  );
}
