import os
import io
from groq import Groq
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

class AudioTranscriber:
    def __init__(self):
        if GROQ_API_KEY:
            self.client = Groq(api_key=GROQ_API_KEY)
            self.enabled = True
        else:
            self.client = None
            self.enabled = False
            logger.warning("GROQ_API_KEY missing. Audio transcription disabled.")

    def transcribe(self, audio_file) -> str:
        """
        Transcribes audio file-like object using Groq Whisper.
        Returns the text string.
        """
        if not self.enabled:
            return "[Error: Groq API Key missing]"

        try:
            # Ensure the file is at the start
            audio_file.seek(0)
            
            # Call Groq API (whisper-large-v3-turbo is faster)
            transcription = self.client.audio.transcriptions.create(
                file=("input.wav", audio_file.read()), # Groq expects filename/bytes tuple
                model="whisper-large-v3-turbo",
                response_format="text"
            )
            return transcription
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return f"[Error: {str(e)}]"

# Singleton
transcriber = AudioTranscriber()
