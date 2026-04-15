"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import ProblemStatement from '@/components/ProblemStatement';
import SolutionFeatures from '@/components/SolutionFeatures';
import Footer from '@/components/Footer';

export default function Home() {
    return (
        <div style={{
            background: 'var(--bg-primary)',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <Navbar />
            <main>
                <HeroSection />
                <ProblemStatement />
                <SolutionFeatures />
            </main>
            <Footer />
        </div>
    );
}
