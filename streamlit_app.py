import os
import time
import uuid
import streamlit as st
import requests

# Helper to get config from env or secrets
def get_config(key, default):
    try:
        if key in st.secrets:
            return st.secrets[key]
    except Exception:
        pass
    return os.getenv(key, default)

BASE = get_config("API_BASE_URL", "http://127.0.0.1:8000")

# --- CSS Styling ---
STYLING = """
<style>
    .main-header {
        background: linear-gradient(135deg, #1e1e2f 0%, #252540 100%);
        padding: 2rem;
        border-radius: 12px;
        color: white;
        text-align: center;
        margin-bottom: 2rem;
    }
    .card-past {
        border-left: 4px solid #ff7b7b;
        background: #2b2b3b;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
    }
    .card-present {
        border-left: 4px solid #f9d71c;
        background: #2b2b3b;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
    }
    .card-future {
        border-left: 4px solid #82caff;
        background: #2b2b3b;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
    }
    .card-action {
        border: 2px solid #50fa7b;
        background: #1e1e2f;
        padding: 1.5rem;
        border-radius: 12px;
        text-align: center;
    }
    .metric-value {
        font-size: 2rem;
        font-weight: bold;
    }
</style>
"""

def post(path: str, payload: dict):
    try:
        r = requests.post(BASE + path, json=payload, timeout=60)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        st.error(f"Error connecting to backend: {e}")
        return None

def get(path: str):
    try:
        r = requests.get(BASE + path, timeout=60)
        return r.json()
    except Exception:
        return None

# --- Main App ---

st.set_page_config(page_title="Emotion Time Travel v2", layout="wide")
st.markdown(STYLING, unsafe_allow_html=True)

# Session State Init
if "user_id" not in st.session_state:
    st.session_state["user_id"] = "user_" + str(uuid.uuid4())[:8]
if "trace_id" not in st.session_state:
    st.session_state["trace_id"] = None
if "processing" not in st.session_state:
    st.session_state["processing"] = False
if "result" not in st.session_state:
    st.session_state["result"] = None

# Input Fields State (for Auto-fill)
if "input_focus" not in st.session_state:
    st.session_state["input_focus"] = ""
if "input_history" not in st.session_state:
    st.session_state["input_history"] = ""
if "input_vision" not in st.session_state:
    st.session_state["input_vision"] = ""


# Header
st.markdown("""
<div class="main-header">
    <h1>🕰️ Emotion Time Travel</h1>
    <p>Behavioral Architecture Engine v2.0</p>
</div>
""", unsafe_allow_html=True)


# Sidebar (Identity)
with st.sidebar:
    st.header("👤 Identity")
    uid_input = st.text_input("User ID", value=st.session_state["user_id"])
    if uid_input:
        st.session_state["user_id"] = uid_input
    
    st.info("Input friction reduced. Session is auto-managed.")
    if st.button("Reset Session"):
        st.session_state["trace_id"] = None
        st.session_state["result"] = None
        st.session_state["processing"] = False
        st.session_state["input_focus"] = ""
        st.session_state["input_history"] = ""
        st.session_state["input_vision"] = ""
        st.rerun()


# Main Content
if not st.session_state["processing"] and not st.session_state["result"]:
    # --- INPUT PHASE ---
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("Step 1: The Context")
        # Linked to session_state for auto-fill capability
        focus = st.text_area("1. Focus (Present)", value=st.session_state["input_focus"], placeholder="What is the single biggest goal or problem?", height=100)
        history = st.text_area("2. History (Past)", value=st.session_state["input_history"], placeholder="What has stopped you in the past?", height=100)
        vision = st.text_area("3. Vision (Future)", value=st.session_state["input_vision"], placeholder="What is the 6-month dream?", height=100)
        
        # Update state on manual edit (optional, but good practice if we allow mixed input)
        st.session_state["input_focus"] = focus
        st.session_state["input_history"] = history
        st.session_state["input_vision"] = vision
    
    with col2:
        st.subheader("Context Upload")
        st.info("🎙️ Audio Input enabled via Groq Whisper")
        
        # Audio input
        audio_value = st.audio_input("Record Voice Note")
        
        if audio_value:
            if st.button("Transcribe & Smart-Fill"):
                with st.spinner("Transcribing & Structuring (Groq)..."):
                    try:
                        files = {"file": ("recording.wav", audio_value, "audio/wav")}
                        res = requests.post(BASE + "/transcribe", files=files)
                        
                        if res.status_code == 200:
                            data = res.json()
                            if "focus" in data:
                                st.success("Analysis Complete! Auto-filling forms...")
                                # Auto-fill values
                                st.session_state["input_focus"] = data.get("focus", "")
                                st.session_state["input_history"] = data.get("history", "")
                                st.session_state["input_vision"] = data.get("vision", "")
                                st.rerun()
                            else:
                                st.error("No structured data returned.")
                        else:
                            st.error(f"Error: {res.text}")
                    except Exception as e:
                        st.error(f"Transcription failed: {e}")

    if st.button("🚀 Analyze Behavioral Patterns", type="primary", use_container_width=True):
        if not focus or not history:
            st.error("Please fill in at least Focus and History.")
        else:
            with st.spinner("Encrypting and sending to Behavioral Engine..."):
                payload = {
                    "user_id": st.session_state["user_id"],
                    "focus": focus,
                    "history": history,
                    "vision": vision or "No specific vision provided."
                }
                res = post("/ingest", payload)
                if res and "trace_id" in res:
                    st.session_state["trace_id"] = res["trace_id"]
                    st.session_state["processing"] = True
                    st.rerun()

elif st.session_state["processing"]:
    # --- PROCESSING PHASE (Polling) ---
    
    st.markdown("### 🧠 The Agents are thinking...")
    
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    steps = [
        "🔍 Accessing Vector Memory (Qdrant)...",
        "🕵️ PastPatternAgent is scanning for contradictions...",
        "🛑 PresentConstraintAgent is checking energy levels...",
        "🎲 FutureSimulatorAgent is running pre-mortems...",
        "🏗️ IntegrationAgent is building your Micro-Plan..."
    ]
    
    # Poll for result
    max_retries = 20
    for i in range(max_retries):
        # Fake progress animation
        stage = i % len(steps)
        status_text.text(steps[stage])
        progress_bar.progress((i + 1) * 5)
        
        # Check backend
        res = get(f"/result/{st.session_state['trace_id']}")
        if res and "integration" in res:
            st.session_state["result"] = res
            st.session_state["processing"] = False
            st.rerun()
        
        time.sleep(1.5)
    
    st.error("Timed out waiting for agents. Please try again.")
    if st.button("Retry"):
        st.session_state["processing"] = False
        st.rerun()

elif st.session_state["result"]:
    # --- RESULT PHASE ---
    
    res = st.session_state["result"]
    past = res.get("past", {})
    present = res.get("present", {})
    future = res.get("future", {})
    integration = res.get("integration", {})
    
    st.markdown("## 🧬 Your Behavioral Blueprint")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown('<div class="card-past">', unsafe_allow_html=True)
        st.markdown("#### 🕵️ Past Pattern")
        st.write(past.get("pattern_detected", "No pattern detected."))
        
        if "predicted_context" in past:
            st.markdown("---")
            st.caption("**🕵️ Detective's Insight:**")
            st.info(past["predicted_context"])
            
        st.caption(f"Confidence: {past.get('confidence', 0.0)}")
        st.markdown('</div>', unsafe_allow_html=True)
        
    with col2:
        st.markdown('<div class="card-present">', unsafe_allow_html=True)
        st.markdown("#### 🛑 Present Constraint")
        st.write(present.get("primary_constraint", "None detected."))
        st.write(f"**Energy:** {present.get('energy_level', 'Unknown')}")
        st.markdown('</div>', unsafe_allow_html=True)
        
    with col3:
        st.markdown('<div class="card-future">', unsafe_allow_html=True)
        st.markdown("#### 🎲 Future Risk")
        st.write(future.get("failure_simulation", "No simulation."))
        st.markdown('</div>', unsafe_allow_html=True)
    
    st.divider()
    
    st.markdown('<div class="card-action">', unsafe_allow_html=True)
    st.markdown("### 🚀 The Dopamine Hit")
    
    # Display Mentor Persona & Emotion
    if "mentor_persona" in integration and "detected_emotion" in integration:
        col_p1, col_p2 = st.columns(2)
        with col_p1:
            st.info(f"**Detector:** {integration['detected_emotion']}")
        with col_p2:
            st.success(f"**Mentor Mode:** {integration['mentor_persona']}")
    
    # NEW: Message from Mentor (The "Proper Answer")
    if "message_from_mentor" in integration:
        st.markdown(f"### 💬 Message from your Mentor")
        st.write(integration["message_from_mentor"])
        st.markdown("---")

    st.subheader(integration.get("impact_statement", "Loading plan..."))
    
    # Micro Task Display
    if "micro_task" in integration:
        mt = integration["micro_task"]
        st.info(f"👉 **{mt.get('title', 'Task')}**")
        st.write(mt.get("description", ""))
        st.caption(f"🎁 **Reward:** {mt.get('reward', 'Satisfaction')}")
    
    # Roadmap Dislay
    if "roadmap" in integration and integration["roadmap"]:
        st.markdown("---")
        with st.expander("🗺️ See Your Hyper-Realistic 6-Month Path"):
            roadmap = integration["roadmap"]
            for phase in roadmap:
                # Month Header
                st.markdown(f"### 🚩 {phase.get('phase')} - *{phase.get('theme')}*")
                if "expected_result" in phase:
                    st.caption(f"🏁 **Goal:** {phase['expected_result']}")
                
                # Weeks
                for week in phase.get("weeks", []):
                    st.markdown(f"- **{week.get('week')}**: {week.get('focus')}")
                    if "outcome" in week:
                        st.caption(f"  *Result: {week['outcome']}*")
                
                st.write("") # Spacer

    if "next_check_in" in integration:
        st.caption(f"Next Check-in: {integration['next_check_in']}")
        
    st.markdown('</div>', unsafe_allow_html=True)
    
    # Feedback Section
    with st.expander("Give Feedback on this Plan"):
        f_rating = st.slider("Was this helpful?", 1, 5, 3)
        f_text = st.text_input("Comments")
        if st.button("Submit Feedback"):
            try:
                # trace_id is stored in session state but we need to ensure it's passed correctly
                tid = st.session_state["trace_id"]
                requests.post(BASE + "/feedback", json={
                    "trace_id": tid,
                    "rating": f_rating,
                    "comment": f_text
                })
                st.success("Feedback Received!")
            except Exception as e:
                st.error(f"Failed to send feedback: {e}")
    
    if st.button("Start New Analysis"):
        st.session_state["trace_id"] = None
        st.session_state["result"] = None
        st.rerun()