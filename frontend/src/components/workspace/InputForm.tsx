import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { transcribeAudio, generateQuestions } from '../../api';

interface InputFormProps {
    onSubmit: (text: string) => void;
    isLoading: boolean;
}

const InputForm = ({ onSubmit, isLoading }: InputFormProps) => {
    type Step = 'initial' | 'generating' | 'questions';
    const [step, setStep] = useState<Step>('initial');
    const [initialGoal, setInitialGoal] = useState('');
    const [questions, setQuestions] = useState<string[]>([]);
    const [answers, setAnswers] = useState<string[]>([]);

    // Audio State
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [audioError, setAudioError] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);

    const startRecording = async () => {
        try {
            setAudioError('');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Failed to access microphone:", error);
            setAudioError('Microphone access denied or unavailable.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                // Stop all tracks to release microphone
                mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

                await handleTranscription(audioBlob);
            };
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleTranscription = async (audioBlob: Blob) => {
        setIsTranscribing(true);
        try {
            const data = await transcribeAudio(audioBlob);
            if (data.raw_text) {
                // Populate the single textbox with the raw transcription
                setInitialGoal(prev => prev + (prev ? '\n\n' : '') + data.raw_text);
            }
        } catch (err: any) {
            setAudioError(err.message || 'Transcription failed.');
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleInitialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialGoal.trim()) return;

        setStep('generating');
        try {
            const generated = await generateQuestions(initialGoal);
            if (generated && generated.length > 0) {
                setQuestions(generated);
                setAnswers(new Array(generated.length).fill(''));
                setStep('questions');
            } else {
                // Fallback
                onSubmit(`Goal: ${initialGoal}`);
                setStep('initial');
            }
        } catch (error) {
            console.error("Failed to generate questions:", error);
            onSubmit(`Goal: ${initialGoal}`);
            setStep('initial');
        }
    };

    const handleFinalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const combined = `Goal: ${initialGoal}\n\n` + questions.map((q, i) => `Q: ${q}\nA: ${answers[i]}`).join('\n\n');
        onSubmit(combined);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="input-form-container"
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
                gap: '32px',
                maxWidth: '1200px',
                margin: '0 auto',
                alignItems: 'start'
            }}
        >
            {/* Left Pane: The Form */}
            <div className="glass-panel" style={{ padding: 'clamp(24px, 5vw, 40px)', display: 'flex', flexDirection: 'column' }}>
                <AnimatePresence mode="wait">
                    {step === 'initial' && (
                        <motion.div
                            key="initial"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}
                        >
                            <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
                                Step 1: The Context
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                                Tell us what you want to achieve today. We'll ask you a few targeted questions to understand your situation perfectly.
                            </p>

                            <form onSubmit={handleInitialSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1 }}>
                                <div className="input-group" style={{ flexGrow: 1 }}>
                                    <textarea
                                        value={initialGoal}
                                        onChange={(e) => setInitialGoal(e.target.value)}
                                        placeholder="I want to build a SaaS, but I feel stuck..."
                                        className="premium-input text-entry"
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '12px',
                                            padding: '24px',
                                            color: 'var(--text-primary)',
                                            minHeight: '250px',
                                            fontSize: '1.1rem',
                                            lineHeight: '1.6',
                                            resize: 'vertical',
                                            fontFamily: 'inherit',
                                            transition: 'all 0.3s ease'
                                        }}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!initialGoal.trim()}
                                    className="premium-button"
                                    style={{
                                        background: 'var(--accent-primary)',
                                        color: 'white',
                                        padding: '16px 32px',
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        fontSize: '1.1rem',
                                        marginTop: '16px',
                                        opacity: !initialGoal.trim() ? 0.5 : 1,
                                        cursor: !initialGoal.trim() ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.3s ease',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    Next <ArrowRight size={20} />
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {step === 'generating' && (
                        <motion.div
                            key="generating"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}
                        >
                            <Loader2 className="spinner" size={48} color="var(--accent-glow)" style={{ marginBottom: '24px' }} />
                            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>Formulating Context...</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>Generating specific questions based on your goal.</p>
                        </motion.div>
                    )}

                    {step === 'questions' && (
                        <motion.div
                            key="questions"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}
                        >
                            <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
                                Step 2: The Deep Dive
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                                Answer these specific questions so the AI can build a highly customized strategy.
                            </p>

                            <form onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1 }}>
                                {questions.map((q, i) => (
                                    <div key={i} className="input-group">
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--accent-glow)', fontWeight: 500 }}>
                                            {q}
                                        </label>
                                        <textarea
                                            value={answers[i]}
                                            onChange={(e) => {
                                                const newAnswers = [...answers];
                                                newAnswers[i] = e.target.value;
                                                setAnswers(newAnswers);
                                            }}
                                            placeholder="Your answer..."
                                            className="premium-input text-entry"
                                            style={{
                                                width: '100%',
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '12px',
                                                padding: '16px',
                                                color: 'var(--text-primary)',
                                                minHeight: '100px',
                                                fontSize: '1rem',
                                                lineHeight: '1.5',
                                                resize: 'vertical',
                                                fontFamily: 'inherit',
                                                transition: 'all 0.3s ease'
                                            }}
                                            required
                                        />
                                    </div>
                                ))}

                                <button
                                    type="submit"
                                    disabled={isLoading || answers.some(a => !a.trim())}
                                    className="premium-button"
                                    style={{
                                        background: 'var(--accent-primary)',
                                        color: 'white',
                                        padding: '16px 32px',
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        fontSize: '1.1rem',
                                        marginTop: '16px',
                                        opacity: (isLoading || answers.some(a => !a.trim())) ? 0.5 : 1,
                                        cursor: (isLoading || answers.some(a => !a.trim())) ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.3s ease',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    {isLoading ? <><Loader2 className="spinner" size={20} /> Encrypting Context...</> : '🚀 Analyze Behavioral Patterns'}
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Right Pane: Audio Recorder & Smart Fill */}
            <div className="glass-panel audio-pane" style={{
                padding: 'clamp(24px, 5vw, 40px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: '100%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)',
                border: isRecording ? '1px solid var(--accent-glow)' : '1px solid var(--border-color)',
                boxShadow: isRecording ? '0 0 30px rgba(130, 202, 255, 0.2)' : 'none',
                transition: 'all 0.4s ease'
            }}>
                <div style={{
                    background: 'rgba(130, 202, 255, 0.1)',
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px'
                }}>
                    <Mic size={32} color="var(--accent-glow)" />
                </div>

                <h3 style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Voice Context Upload</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', maxWidth: '300px', lineHeight: 1.6 }}>
                    Speak naturally about your problem, your past attempts, and your dreams. Our AI will automatically structure it into the required fields.
                </p>

                <AnimatePresence mode="wait">
                    {isTranscribing ? (
                        <motion.div
                            key="transcribing"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--accent-glow)' }}
                        >
                            <Loader2 size={40} className="spinner" />
                            <span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>TRANSCRIBING & STRUCTURING...</span>
                        </motion.div>
                    ) : isRecording ? (
                        <motion.button
                            key="stop"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={stopRecording}
                            className="recording-pulse"
                            style={{
                                background: 'rgba(255, 75, 75, 0.1)',
                                border: '1px solid #ff4b4b',
                                color: '#ff4b4b',
                                padding: '16px 32px',
                                borderRadius: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <Square size={20} fill="currentColor" /> Stop Recording
                        </motion.button>
                    ) : (
                        <motion.button
                            key="start"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={startRecording}
                            style={{
                                background: 'var(--text-primary)',
                                color: 'var(--bg-primary)',
                                border: 'none',
                                padding: '16px 32px',
                                borderRadius: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(255, 255, 255, 0.15)'
                            }}
                        >
                            <Sparkles size={20} /> Start Smart-Fill
                        </motion.button>
                    )}
                </AnimatePresence>

                {audioError && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            marginTop: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#ff7b7b',
                            background: 'rgba(255, 123, 123, 0.1)',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            fontSize: '0.9rem'
                        }}
                    >
                        <AlertCircle size={16} />
                        {audioError}
                    </motion.div>
                )}
            </div>

            <style>{`
                .premium-input:focus {
                    outline: none;
                    border-color: var(--accent-glow) !important;
                    box-shadow: 0 0 15px rgba(130, 202, 255, 0.1);
                }
                .premium-button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 20px rgba(100, 100, 255, 0.4);
                }
                .spinner {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .recording-pulse {
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0.4); }
                    70% { box-shadow: 0 0 0 15px rgba(255, 75, 75, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0); }
                }
            `}</style>
        </motion.div>
    );
};

export default InputForm;
