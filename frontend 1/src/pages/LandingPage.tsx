import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import ProblemStatement from '../components/ProblemStatement';
import SolutionFeatures from '../components/SolutionFeatures';
import Footer from '../components/Footer';

const LandingPage = () => {
    return (
        <div className="zoom-90">
            <Navbar />
            <main>
                <HeroSection />
                <ProblemStatement />
                <SolutionFeatures />
            </main>
            <Footer />
        </div>
    );
};

export default LandingPage;
