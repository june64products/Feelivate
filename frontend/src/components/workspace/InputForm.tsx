import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { transcribeAudio } from '@/lib/api';

interface InputFormProps {
    onSubmit: (text: string) => void;
    isLoading: boolean;
}

export default function InputForm({ onSubmit, isLoading }: InputFormProps) {
    type Step = 'focus' | 'history' | 'vision' | 'review' | 'submitting';
    const [step, setStep] = useState<Step>('focus');
    
    const [focus, setFocus] = useState('');
    const [history, setHistory] = useState('');
    const [vision, setVision] = useState('');

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
                if (step === 'focus') {
                    setFocus(prev => prev + (prev ? '\n\n' : '') + data.raw_text);
                } else if (step === 'history') {
                    setHistory(prev => prev + (prev ? '\n\n' : '') + data.raw_text);
                } else if (step === 'vision') {
                    setVision(prev => prev + (prev ? '\n\n' : '') + data.raw_text);
                }
            }
        } catch (err: any) {
            setAudioError(err.message || 'Transcription failed.');
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        if (step === 'focus') setStep('history');
        else if (step === 'history') setStep('vision');
        else if (step === 'vision') setStep('review');
    };

    const finalizeInput = () => {
        setStep('submitting');
        const combined = `FOCUS_REQUEST: ${focus}\nHISTORY: ${history}\nVISION: ${vision}`;
        onSubmit(combined);
    };

    const getStepTitle = () => {
        if (step === 'focus') return "Step 1: The Focus";
        if (step === 'history') return "Step 2: The History";
        if (step === 'vision') return "Step 3: The Vision";
        if (step === 'review') return "Final Review";
        return "";
    };

    const getStepPrompt = () => {
        if (step === 'focus') return "What is the specific goal, problem, or pattern you want to orchestrate today?";
        if (step === 'history') return "What have you tried in the past regarding this, and why do you think it broke down?";
        if (step === 'vision') return "If we succeed in the next 6 months, what does your ideal reality look like?";
        return "Review your inputs before we generate the neural blueprint.";
    };

    const getCurrentValue = () => {
        if (step === 'focus') return focus;
        if (step === 'history') return history;
        if (step === 'vision') return vision;
        return "";
    };

    const setCurrentValue = (val: string) => {
        if (step === 'focus') setFocus(val);
        if (step === 'history') setHistory(val);
        if (step === 'vision') setVision(val);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto"
        >
            <div className="glass-panel p-8 md:p-12 w-full bg-black/40 rounded-3xl border border-white/5">
                <AnimatePresence mode="wait">
                    {step === 'review' || step === 'submitting' ? (
                        <motion.div
                            key="review"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col gap-8 w-full"
                        >
                            <h2 className="text-2xl font-bold text-white mb-2">Review Your Context</h2>
                            
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <span className="text-neon-cyan text-xs uppercase tracking-widest font-bold">1. Focus</span>
                                <p className="text-white mt-3 leading-relaxed whitespace-pre-wrap">{focus}</p>
                            </div>
                            
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <span className="text-neon-cyan text-xs uppercase tracking-widest font-bold">2. History</span>
                                <p className="text-white mt-3 leading-relaxed whitespace-pre-wrap">{history}</p>
                            </div>
                            
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <span className="text-neon-cyan text-xs uppercase tracking-widest font-bold">3. Vision</span>
                                <p className="text-white mt-3 leading-relaxed whitespace-pre-wrap">{vision}</p>
                            </div>

                            <div className="flex flex-col items-center gap-4 mt-4">
                                <button
                                    onClick={finalizeInput}
                                    disabled={isLoading || step === 'submitting'}
                                    className="w-full md:w-auto bg-gradient-to-r from-neon-cyan to-vivid-purple text-white px-10 py-4 rounded-xl font-bold text-lg hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? <><Loader2 className="animate-spin" size={24} /> Initiating 13 Agents</> : <><Sparkles size={24} /> Generate Strategic Blueprint</>}
                                </button>
                                
                                {step !== 'submitting' && !isLoading && (
                                    <button
                                        type="button"
                                        onClick={() => setStep('focus')}
                                        className="text-white/50 hover:text-white transition-colors text-sm"
                                    >
                                        Edit my answers
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col flex-grow"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-3xl font-bold text-white">
                                    {getStepTitle()}
                                </h2>
                                <span className="text-white/50 text-sm font-bold tracking-widest">
                                    {step === 'focus' ? '1' : step === 'history' ? '2' : '3'} / 3
                                </span>
                            </div>
                            <p className="text-white/60 mb-8 text-lg">
                                {getStepPrompt()}
                            </p>

                            <form onSubmit={handleNext} className="flex flex-col gap-6 flex-grow">
                                <div className="relative flex-grow min-h-[250px]">
                                    <textarea
                                        value={getCurrentValue()}
                                        onChange={(e) => setCurrentValue(e.target.value)}
                                        placeholder="Speak or type your answer..."
                                        className="w-full h-full bg-black/30 border border-white/10 rounded-2xl p-6 pb-20 text-white text-lg leading-relaxed focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan outline-none transition-all resize-none min-h-[250px]"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`absolute bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                            isRecording 
                                                ? 'bg-rose-pink/20 border border-rose-pink text-rose-pink' 
                                                : 'bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/20'
                                        }`}
                                        title={isRecording ? "Stop Recording" : "Speak Answer"}
                                    >
                                        {isTranscribing ? <Loader2 size={20} className="animate-spin" /> : isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
                                    </button>
                                </div>
                                <button
                                    type="submit"
                                    disabled={!getCurrentValue().trim()}
                                    className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 px-8 py-4 rounded-xl font-bold text-lg mt-4 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neon-cyan hover:text-black transition-all flex items-center justify-center gap-3 self-end"
                                >
                                    {step === 'vision' ? 'Review Answers' : 'Next Step'} <ArrowRight size={20} />
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {audioError && (
                <div className="mt-4 bg-rose-pink/10 border border-rose-pink text-rose-pink p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} /> {audioError}
                </div>
            )}
        </motion.div>
    );
}
