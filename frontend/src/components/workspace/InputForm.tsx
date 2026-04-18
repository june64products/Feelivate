import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Sparkles, AlertCircle, ArrowRight, BrainCircuit } from 'lucide-react';
import { transcribeAudio, generateQuestion, detectContradiction } from '../../api';

interface InputFormProps {
    onSubmit: (text: string) => void;
    isLoading: boolean;
}

const InputForm = ({ onSubmit, isLoading }: InputFormProps) => {
    type Step = 'initial' | 'generating' | 'question' | 'contradiction' | 'submitting';
    const [step, setStep] = useState<Step>('initial');
    const [initialGoal, setInitialGoal] = useState('');

    // Sequential Q&A State
    const [qaHistory, setQaHistory] = useState<{ q: string, a: string }[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [questionCount, setQuestionCount] = useState(0);
    const MAX_QUESTIONS = 2; // Exact 4 steps: Initial -> Q1 -> Q2 -> Contradiction

    // Quality Check State
    const [qualityWarning, setQualityWarning] = useState('');

    // Contradiction State
    const [contradictionQuestion, setContradictionQuestion] = useState('');
    const [contradictionAnswer, setContradictionAnswer] = useState('');

    // Audio State
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [audioError, setAudioError] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);

    // VAD State (Voice Activity Detection)
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceStartRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const SILENCE_THRESHOLD = 50; 
    const SILENCE_DURATION = 1500; 

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

            // --- VAD Initialization ---
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            audioContextRef.current = audioCtx;
            analyserRef.current = analyser;
            silenceStartRef.current = null;

            const checkSpeech = () => {
                if (!analyserRef.current) return;
                const bufferLength = analyserRef.current.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyserRef.current.getByteTimeDomainData(dataArray);

                let maxVal = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const val = Math.abs(dataArray[i] - 128);
                    if (val > maxVal) maxVal = val;
                }

                if (maxVal < SILENCE_THRESHOLD) {
                    if (silenceStartRef.current === null) {
                        silenceStartRef.current = Date.now();
                    } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
                        console.log("VAD: Silence detected. Auto-stopping.");
                        stopRecording();
                        return;
                    }
                } else {
                    silenceStartRef.current = null;
                }

                animationFrameRef.current = requestAnimationFrame(checkSpeech);
            };

            animationFrameRef.current = requestAnimationFrame(checkSpeech);

        } catch (error) {
            console.error("Failed to access microphone:", error);
            setAudioError('Microphone access denied or unavailable.');
        }
    };

    const stopRecording = () => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
            analyserRef.current = null;
        }

        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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
                if (step === 'initial') {
                    setInitialGoal(prev => prev + (prev ? '\n\n' : '') + data.raw_text);
                } else if (step === 'question') {
                    setCurrentAnswer(prev => prev + (prev ? ' ' : '') + data.raw_text);
                } else if (step === 'contradiction') {
                    setContradictionAnswer(prev => prev + (prev ? ' ' : '') + data.raw_text);
                }
            }
        } catch (err: any) {
            setAudioError(err.message || 'Transcription failed.');
        } finally {
            setIsTranscribing(false);
        }
    };

    const buildHistoryString = () => {
        return qaHistory.map(item => `Q: ${item.q}\nA: ${item.a}`).join('\n\n');
    };

    const fetchNextQuestion = async (historyStr: string = '') => {
        setStep('generating');
        try {
            const nextQ = await generateQuestion(initialGoal, historyStr);
            if (nextQ) {
                setCurrentQuestion(nextQ);
                setCurrentAnswer('');
                setQualityWarning('');
                setStep('question');
            } else {
                finalizeInput();
            }
        } catch (error) {
            console.error("Failed to generate question:", error);
            finalizeInput();
        }
    };

    const handleInitialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialGoal.trim()) return;
        setQaHistory([]);
        setQuestionCount(0);
        await fetchNextQuestion();
    };

    const handleAnswerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const wordCount = currentAnswer.trim().split(/\s+/).length;
        if (wordCount < 5) {
            setQualityWarning("Elaborate slightly—patterns emerge in the details.");
            return;
        }

        const updatedHistory = [...qaHistory, { q: currentQuestion, a: currentAnswer }];
        setQaHistory(updatedHistory);
        const newCount = questionCount + 1;
        setQuestionCount(newCount);

        if (newCount >= MAX_QUESTIONS) {
            checkForContradictions(updatedHistory);
        } else {
            const historyStr = updatedHistory.map(item => `Q: ${item.q}\nA: ${item.a}`).join('\n\n');
            await fetchNextQuestion(historyStr);
        }
    };

    const checkForContradictions = async (history: { q: string, a: string }[]) => {
        setStep('generating');
        try {
            const historyStr = history.map(item => `Q: ${item.q}\nA: ${item.a}`).join('\n\n');
            const res = await detectContradiction(initialGoal, historyStr);

            if (res.has_contradiction && res.tension_question) {
                setContradictionQuestion(res.tension_question);
                setContradictionAnswer('');
                setStep('contradiction');
            } else {
                finalizeInput(historyStr);
            }
        } catch (error) {
            console.error("Contradiction check failed:", error);
            const historyStr = history.map(item => `Q: ${item.q}\nA: ${item.a}`).join('\n\n');
            finalizeInput(historyStr);
        }
    };

    const handleContradictionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!contradictionAnswer.trim()) return;

        const historyStr = qaHistory.map(item => `Q: ${item.q}\nA: ${item.a}`).join('\n\n')
            + `\n\nQ: ${contradictionQuestion}\nA: ${contradictionAnswer}`;

        finalizeInput(historyStr);
    };

    const finalizeInput = (historyStr: string = buildHistoryString()) => {
        setStep('submitting');
        const combined = `Goal: ${initialGoal}\n\n${historyStr}`;
        onSubmit(combined);
    };

    // --- Build The Stacked Deck ---
    const buildDeck = () => {
        const deck = [];
        
        // Card 0: Initial Synthesis
        if (step === 'initial') {
            deck.push({ id: 'initial-active', type: 'initial-active' });
            return deck;
        } else {
            deck.push({ id: 'initial-done', type: 'completed', stepNum: 1, title: "The Synthesis", q: "What do you want to achieve today?", a: initialGoal });
        }

        // Cards for Q&A History
        qaHistory.forEach((item, i) => {
            deck.push({ id: `history-${i}`, type: 'completed', stepNum: i + 2, title: i === 0 ? "Behavioral Deep Dive" : "Pattern Extraction", q: item.q, a: item.a });
        });

        // The Current Active Card
        if (step === 'generating') {
            deck.push({ id: 'generating', type: 'generating' });
        } else if (step === 'question') {
            deck.push({ id: 'current-question', type: 'question', stepNum: qaHistory.length + 2, q: currentQuestion });
        } else if (step === 'contradiction') {
            deck.push({ id: 'contradiction', type: 'contradiction', stepNum: 4, q: contradictionQuestion });
        }

        return deck;
    };

    const deck = buildDeck();
    const activeIndex = deck.length - 1;

    return (
        <div style={{
            display: 'flex',
            gap: '40px',
            maxWidth: '1200px',
            margin: '0 auto',
            alignItems: 'stretch',
            flexDirection: 'row'
        }}>
            {/* Left Pane: Stacked Cards Container */}
            <div style={{ 
                flex: '1 1 60%', 
                position: 'relative', 
                minHeight: '600px',
                perspective: '1000px'
            }}>
                <AnimatePresence mode="popLayout">
                    {deck.map((card, index) => {
                        const offset = activeIndex - index;
                        // Keep max 3 cards visible to prevent too much clutter
                        if (offset > 2) return null;

                        const scale = 1 - (offset * 0.05);
                        const y = offset * -28;
                        const zIndex = 10 - offset;
                        const opacity = offset === 0 ? 1 : offset === 1 ? 0.6 : 0.2;
                        const isInteractive = offset === 0;

                        return (
                            <motion.div
                                key={card.id}
                                layout
                                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                                animate={{ opacity, y, scale, zIndex }}
                                exit={{ opacity: 0, scale: 0.9, y: -50 }}
                                transition={{ duration: 0.6, ease: [0.19, 1.0, 0.22, 1.0] }}
                                className="glass-panel"
                                style={{
                                    position: offset === 0 ? 'relative' : 'absolute',
                                    top: 0, left: 0, right: 0,
                                    padding: 'clamp(32px, 4vw, 48px)',
                                    pointerEvents: isInteractive ? 'auto' : 'none',
                                    filter: offset > 0 ? `blur(${offset * 1}px)` : 'none',
                                    boxShadow: offset === 0 ? '0 20px 40px rgba(0,0,0,0.4)' : 'none',
                                    border: offset === 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.02)',
                                    background: offset === 0 ? 'linear-gradient(145deg, rgba(20,20,20,0.8) 0%, rgba(10,10,10,0.95) 100%)' : 'rgba(10,10,10,0.9)',
                                    transformOrigin: 'top center'
                                }}
                            >
                                {/* Card Body based on Type */}
                                {card.type === 'initial-active' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                            <div style={{ background: 'rgba(130, 202, 255, 0.1)', color: '#82caff', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                                                STEP 1
                                            </div>
                                            <h2 style={{ fontSize: '1.75rem', color: 'var(--text-primary)', margin: 0 }}>The Synthesis</h2>
                                        </div>
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '1.05rem' }}>
                                            Define your current state and target objective. Our behavioral agents will architect the context.
                                        </p>
                                        <form onSubmit={handleInitialSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1 }}>
                                            <textarea
                                                value={initialGoal}
                                                onChange={(e) => setInitialGoal(e.target.value)}
                                                placeholder="e.g., I want to launch my SaaS in 30 days, but I am struggling with consistent focus..."
                                                className="premium-input text-entry"
                                                style={{
                                                    width: '100%',
                                                    background: 'rgba(0,0,0,0.4)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: '16px',
                                                    padding: '24px',
                                                    color: 'var(--text-primary)',
                                                    minHeight: '220px',
                                                    fontSize: '1.1rem',
                                                    lineHeight: '1.7',
                                                    resize: 'none',
                                                    fontFamily: 'inherit',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                required
                                            />
                                            <button
                                                type="submit"
                                                disabled={!initialGoal.trim()}
                                                className="premium-button"
                                                style={{
                                                    background: 'var(--text-primary)',
                                                    color: 'var(--bg-primary)',
                                                    padding: '16px 32px',
                                                    borderRadius: '12px',
                                                    fontWeight: 600,
                                                    fontSize: '1.1rem',
                                                    marginTop: 'auto',
                                                    opacity: !initialGoal.trim() ? 0.5 : 1,
                                                    cursor: !initialGoal.trim() ? 'not-allowed' : 'pointer',
                                                    border: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '12px'
                                                }}
                                            >
                                                Initialize Core <ArrowRight size={20} />
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {card.type === 'completed' && (
                                    <div style={{ filter: 'brightness(0.7)' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>
                                            STEP {card.stepNum}: {card.title?.toUpperCase()}
                                        </div>
                                        <div style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '16px', fontWeight: 500 }}>
                                            {card.q}
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontStyle: 'italic', borderLeft: '2px solid rgba(130, 202, 255, 0.3)', paddingLeft: '16px' }}>
                                            {card.a.substring(0, 80)}{card.a.length > 80 ? '...' : ''}
                                        </div>
                                    </div>
                                )}

                                {card.type === 'generating' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                                        <BrainCircuit size={48} color="var(--accent-glow)" className="pulse-icon" style={{ marginBottom: '24px' }} />
                                        <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>Agent Syncing...</h2>
                                        <p style={{ color: 'var(--text-secondary)' }}>Extracting psychological vectors.</p>
                                    </div>
                                )}

                                {card.type === 'question' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <div style={{ background: 'rgba(130, 202, 255, 0.1)', color: '#82caff', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                                                STEP {card.stepNum}
                                            </div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                                                DEEP DIVE
                                            </span>
                                        </div>
                                        <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', lineHeight: 1.5, marginBottom: '32px', fontWeight: 500 }}>
                                            {card.q}
                                        </h3>

                                        <form onSubmit={handleAnswerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1 }}>
                                            <div style={{ position: 'relative', flexGrow: 1 }}>
                                                <textarea
                                                    value={currentAnswer}
                                                    onChange={(e) => {
                                                        setCurrentAnswer(e.target.value);
                                                        if (qualityWarning) setQualityWarning('');
                                                    }}
                                                    placeholder="Inject your context..."
                                                    className="premium-input text-entry"
                                                    style={{
                                                        width: '100%',
                                                        background: 'rgba(0,0,0,0.4)',
                                                        border: qualityWarning ? '1px solid #ff7b7b' : '1px solid rgba(255,255,255,0.05)',
                                                        borderRadius: '16px',
                                                        padding: '24px',
                                                        paddingRight: '64px',
                                                        color: 'var(--text-primary)',
                                                        minHeight: '200px',
                                                        fontSize: '1.1rem',
                                                        lineHeight: '1.6',
                                                        resize: 'none',
                                                        fontFamily: 'inherit'
                                                    }}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={isRecording ? stopRecording : startRecording}
                                                    className="mic-button"
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '24px',
                                                        right: '24px',
                                                        background: isRecording ? 'rgba(255, 75, 75, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                        border: isRecording ? '1px solid #ff4b4b' : '1px solid rgba(255,255,255,0.1)',
                                                        color: isRecording ? '#ff4b4b' : 'var(--text-secondary)',
                                                        borderRadius: '50%',
                                                        width: '44px',
                                                        height: '44px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {isTranscribing ? <Loader2 size={18} className="spinner" /> : isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={20} />}
                                                </button>
                                            </div>
                                            <AnimatePresence>
                                                {qualityWarning && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        style={{ color: '#ffb86c', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                    >
                                                        <Sparkles size={16} color="#ffb86c" />
                                                        <span>{qualityWarning}</span>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                            <button
                                                type="submit"
                                                disabled={!currentAnswer.trim()}
                                                className="premium-button"
                                                style={{
                                                    background: 'var(--text-primary)',
                                                    color: 'var(--bg-primary)',
                                                    padding: '16px 32px',
                                                    borderRadius: '12px',
                                                    fontWeight: 600,
                                                    fontSize: '1.1rem',
                                                    marginTop: 'auto',
                                                    opacity: !currentAnswer.trim() ? 0.5 : 1,
                                                    cursor: !currentAnswer.trim() ? 'not-allowed' : 'pointer',
                                                    border: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '12px'
                                                }}
                                            >
                                                Proceed <ArrowRight size={20} />
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {card.type === 'contradiction' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                            <div style={{ background: 'rgba(249, 215, 28, 0.1)', padding: '8px', borderRadius: '50%' }}>
                                                <AlertCircle size={24} color="#f9d71c" />
                                            </div>
                                            <h2 style={{ fontSize: '1.75rem', color: 'var(--text-primary)', margin: 0 }}>
                                                Friction Analysis
                                            </h2>
                                            <div style={{ marginLeft: 'auto', background: 'rgba(249, 215, 28, 0.1)', color: '#f9d71c', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                STEP 4
                                            </div>
                                        </div>

                                        <div style={{ background: 'rgba(249, 215, 28, 0.05)', padding: '24px', borderRadius: '16px', borderLeft: '3px solid #f9d71c', marginBottom: '32px' }}>
                                            <p style={{ color: 'var(--text-primary)', fontSize: '1.15rem', lineHeight: 1.6, fontStyle: 'italic' }}>
                                                "{card.q}"
                                            </p>
                                        </div>

                                        <form onSubmit={handleContradictionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1 }}>
                                            <div style={{ position: 'relative', flexGrow: 1 }}>
                                                <textarea
                                                    value={contradictionAnswer}
                                                    onChange={(e) => setContradictionAnswer(e.target.value)}
                                                    placeholder="Resolve the tension..."
                                                    className="premium-input text-entry"
                                                    style={{
                                                        width: '100%',
                                                        background: 'rgba(0,0,0,0.4)',
                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                        borderRadius: '16px',
                                                        padding: '24px',
                                                        paddingRight: '64px',
                                                        color: 'var(--text-primary)',
                                                        minHeight: '160px',
                                                        fontSize: '1.1rem',
                                                        lineHeight: '1.6',
                                                        resize: 'none',
                                                        fontFamily: 'inherit'
                                                    }}
                                                    required
                                                />
                                                 <button
                                                    type="button"
                                                    onClick={isRecording ? stopRecording : startRecording}
                                                    className="mic-button"
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '24px',
                                                        right: '24px',
                                                        background: isRecording ? 'rgba(255, 75, 75, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                        border: isRecording ? '1px solid #ff4b4b' : '1px solid rgba(255,255,255,0.1)',
                                                        color: isRecording ? '#ff4b4b' : 'var(--text-secondary)',
                                                        borderRadius: '50%',
                                                        width: '44px',
                                                        height: '44px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {isTranscribing ? <Loader2 size={18} className="spinner" /> : isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={20} />}
                                                </button>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={!contradictionAnswer.trim() || isLoading}
                                                className="premium-button"
                                                style={{
                                                    background: 'var(--accent-glow)',
                                                    color: '#000',
                                                    padding: '16px 32px',
                                                    borderRadius: '12px',
                                                    fontWeight: 700,
                                                    fontSize: '1.1rem',
                                                    marginTop: 'auto',
                                                    opacity: (!contradictionAnswer.trim() || isLoading) ? 0.5 : 1,
                                                    cursor: (!contradictionAnswer.trim() || isLoading) ? 'not-allowed' : 'pointer',
                                                    border: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '12px',
                                                    boxShadow: '0 0 20px rgba(130, 202, 255, 0.3)'
                                                }}
                                            >
                                                {isLoading ? <><Loader2 className="spinner" size={20} /> Generating Blueprint...</> : 'Synthesize Behavioral Plan'}
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Right Pane: Audio Recorder & Branding (Visible in Initial Setup) */}
            <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column' }}>
                 <div className="glass-panel" style={{
                    padding: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minHeight: '100%',
                    background: 'rgba(10,10,10,0.4)',
                    border: isRecording ? '1px solid var(--accent-glow)' : '1px solid rgba(255,255,255,0.02)',
                    boxShadow: isRecording ? '0 0 40px rgba(130, 202, 255, 0.1)' : 'none',
                    transition: 'all 0.5s ease',
                    borderRadius: '24px'
                }}>
                    <motion.div 
                        animate={isRecording ? { scale: [1, 1.1, 1] } : {}} 
                        transition={{ repeat: Infinity, duration: 2 }}
                        style={{
                            background: isRecording ? 'rgba(255, 75, 75, 0.1)' : 'rgba(130, 202, 255, 0.05)',
                            border: isRecording ? '1px solid rgba(255, 75, 75, 0.3)' : '1px solid rgba(130, 202, 255, 0.2)',
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '32px',
                            position: 'relative'
                        }}
                    >
                        {isRecording && (
                            <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: '1px solid #ff4b4b', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                        )}
                        <Mic size={36} color={isRecording ? '#ff4b4b' : "var(--accent-glow)"} />
                    </motion.div>

                    <h3 style={{ fontSize: '1.6rem', marginBottom: '16px', color: 'var(--text-primary)', fontWeight: 600 }}>Vocal Context Stream</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '48px', lineHeight: 1.6, fontSize: '1.05rem' }}>
                        Bypass typing entirely. Speak your unstructured thoughts, constraints, and macro goals. Our neural layer will auto-structure the input across all stages.
                    </p>

                    <AnimatePresence mode="popLayout">
                        {isTranscribing ? (
                            <motion.div
                                key="transcribing"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--accent-glow)' }}
                            >
                                <Loader2 size={32} className="spinner" />
                                <span style={{ fontWeight: 600, letterSpacing: '0.1em', fontSize: '0.85rem' }}>PROCESSING AUDIO...</span>
                            </motion.div>
                        ) : isRecording ? (
                            <motion.button
                                key="stop"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                onClick={stopRecording}
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
                                    cursor: 'pointer',
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                <Square size={20} fill="currentColor" /> Stop Stream
                            </motion.button>
                        ) : (
                            <motion.button
                                key="start"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                onClick={startRecording}
                                className="premium-button"
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '16px 32px',
                                    borderRadius: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    fontSize: '1.1rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                <Mic size={20} /> Initialize Audio
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
            </div>

            <style>{`
                .premium-input:focus {
                    outline: none;
                    border-color: var(--accent-glow) !important;
                    box-shadow: 0 0 25px rgba(130, 202, 255, 0.05);
                }
                .premium-button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
                }
                .mic-button:hover {
                    background: rgba(255,255,255,0.1) !important;
                    transform: scale(1.05);
                }
                .spinner {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .pulse-icon {
                    animation: op-pulse 2s infinite alternate;
                }
                @keyframes op-pulse {
                    from { opacity: 0.6; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1.05); }
                }
                @keyframes ping {
                    75%, 100% {
                        transform: scale(1.5);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default InputForm;
