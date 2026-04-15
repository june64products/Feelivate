import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import ProblemStatement from '../components/ProblemStatement';
import SolutionFeatures from '../components/SolutionFeatures';
import Footer from '../components/Footer';

const LandingPage = () => {
    return (
        <>
            <Navbar />
            <main>
                <HeroSection />
                <ProblemStatement />
                <SolutionFeatures />
            </main>
            <Footer />
        </>
    );
};

export default LandingPage;
