import os
import time
import json
import streamlit as st
import requests

# Helper to get config from env or secrets
def get_config(key, default):
    if key in st.secrets:
        return st.secrets[key]
    return os.getenv(key, default)

BASE = get_config("API_BASE_URL", "http://127.0.0.1:8000")


def post(path: str, payload: dict):
    try:
        r = requests.post(BASE + path, json=payload, timeout=60)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        st.error(f"⚠️ Cannot connect to backend at {BASE}. Make sure the API server is running.")
        return None
    except Exception as e:
        st.error(f"Error: {str(e)}")
        return None


def get(path: str):
    try:
        r = requests.get(BASE + path, timeout=60)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        st.error(f"⚠️ Cannot connect to backend at {BASE}. Make sure the API server is running.")
        return None
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            # Return a dict indicating processing status instead of None
            return {"error": "Result not ready yet. Still processing...", "status": "processing"}
        st.error(f"Error: {str(e)}")
        return None
    except Exception as e:
        st.error(f"Error: {str(e)}")
        return None


# Page Configuration
st.set_page_config(
    page_title="Imagination to Reality | Emotion Time Travel",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS for better styling
st.markdown("""
<style>
    .main-header {
        text-align: center;
        padding: 2rem 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 10px;
        margin-bottom: 2rem;
    }
    .step-card {
        background: #333333;
        color: white;
        padding: 1.5rem;
        border-radius: 10px;
        border-left: 4px solid #667eea;
        margin: 1rem 0;
    }
    .result-section {
        background: #333333;
        color: white;
        padding: 1.5rem;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)

# Header
st.markdown("""
<div class="main-header">
    <h1>🌟 Imagination to Reality</h1>
    <p style="font-size: 1.2rem; margin: 0;">Transform your thoughts and dreams into actionable plans</p>
</div>
""", unsafe_allow_html=True)

# Introduction
with st.expander("ℹ️ How does this work?", expanded=False):
    st.markdown("""
    **Emotion Time Travel** helps you turn your imagination into reality by:
    
    1. 🔍 **Analyzing Your Past** - Understanding patterns and experiences that shape your current state
    2. 🎯 **Assessing Your Present** - Identifying your current emotions, needs, and context
    3. 🚀 **Envisioning Your Future** - Creating actionable scenarios and plans
    4. ✨ **Integration** - Synthesizing everything into a coherent action plan
    
    Simply share your thoughts, dreams, or ideas, and we'll help you create a path to make them real.
    """)

# Initialize session state
if "user_id" not in st.session_state:
    st.session_state["user_id"] = ""
if "session_id" not in st.session_state:
    st.session_state["session_id"] = None
if "trace_id" not in st.session_state:
    st.session_state["trace_id"] = None
if "last_result" not in st.session_state:
    st.session_state["last_result"] = None

# Step 1: User Identification
st.markdown("### 👤 Step 1: Identify Yourself")
user_id = st.text_input(
    "Enter your name or identifier",
    value=st.session_state.get("user_id", ""),
    placeholder="e.g., John Doe or user123",
    help="This helps us personalize your experience and track your journey"
)
if user_id:
    st.session_state["user_id"] = user_id

# Step 2: Create Session
if user_id:
    st.markdown("### 🎬 Step 2: Start Your Journey")
    col1, col2 = st.columns([1, 2])
    
    with col1:
        if st.button("🚀 Create New Session", type="primary", use_container_width=True):
            res = post("/session", {"user_id": user_id})
            if res:
                st.session_state["session_id"] = res["session_id"]
                st.success("✅ Session created successfully!")
                st.balloons()
    
    with col2:
        session_id = st.session_state.get("session_id")
        if session_id:
            st.info(f"📋 Active Session: `{session_id}`")

# Step 3: Share Your Imagination
if st.session_state.get("session_id"):
    st.markdown("### 💭 Step 3: Share Your Thoughts & Imagination")
    
    st.markdown("""
    <div class="step-card">
    <strong>What to write:</strong>
    <ul>
        <li>Your dreams, goals, or aspirations</li>
        <li>Ideas you want to bring to life</li>
        <li>Current challenges you're facing</li>
        <li>How you're feeling and what you envision for yourself</li>
    </ul>
    </div>
    """, unsafe_allow_html=True)
    
    entry = st.text_area(
        "Write your thoughts here",
        height=200,
        placeholder="Example: I've been dreaming about starting my own business. I love design and want to create a brand that helps people express themselves. I'm excited but also nervous about taking the first step...",
        help="Be honest and detailed. The more you share, the better insights we can provide."
    )
    
    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("✨ Transform My Imagination", type="primary", use_container_width=True, disabled=not entry):
            with st.spinner("🔮 Analyzing your journey through time..."):
                res = post("/ingest", {
                    "text": entry,
                    "user_id": user_id,
                    "session_id": st.session_state["session_id"]
                })
                if res:
                    st.session_state["trace_id"] = res["trace_id"]
                    st.session_state["processing"] = True
                    st.session_state["auto_refresh"] = True
                    st.success("✅ Processing your imagination! Auto-checking results...")
                    time.sleep(2)
                    st.rerun()

# Step 4: View Results
if st.session_state.get("trace_id"):
    st.markdown("### 🎯 Step 4: Your Personalized Journey")
    
    # Auto-check results if processing
    if st.session_state.get("processing", False) and st.session_state.get("auto_refresh", False):
        with st.spinner("🔄 Auto-checking results..."):
            res = get(f"/result/{st.session_state['trace_id']}")
            if res:
                if "error" in res and res.get("status") == "error":
                    st.session_state["last_result"] = res
                    st.session_state["processing"] = False
                    st.session_state["auto_refresh"] = False
                elif "error" in res and res.get("status") == "processing":
                    st.session_state["processing"] = True
                elif "past" in res or "present" in res or "future" in res:
                    st.session_state["last_result"] = res
                    st.session_state["processing"] = False
                    st.session_state["auto_refresh"] = False
                    st.success("✅ Results ready!")
                    st.balloons()
    
    col1, col2 = st.columns([1, 3])
    with col1:
        if st.button("🔍 Get My Results", type="primary"):
            with st.spinner("Fetching your personalized insights..."):
                res = get(f"/result/{st.session_state['trace_id']}")
                if res:
                    if "error" in res and res.get("status") == "error":
                        # Actual error occurred
                        st.error(f"❌ Error: {res.get('error', 'Unknown error')}")
                        st.session_state["last_result"] = res
                        st.session_state["processing"] = False
                        st.session_state["auto_refresh"] = False
                    elif "error" in res and res.get("status") == "processing":
                        # Still processing
                        st.session_state["processing"] = True
                        st.session_state["auto_refresh"] = True
                        st.warning("⏳ Still processing... Auto-refresh enabled.")
                    elif "past" in res or "present" in res or "future" in res:
                        # Success - we have results
                        st.session_state["last_result"] = res
                        st.session_state["processing"] = False
                        st.session_state["auto_refresh"] = False
                        st.success("✅ Results ready!")
                    else:
                        # Unknown response format
                        st.warning(f"⚠️ Unexpected response format: {res}")
                        st.session_state["last_result"] = res
                        st.session_state["processing"] = False
                        st.session_state["auto_refresh"] = False
                else:
                    st.error("❌ Failed to fetch results. Please check if the backend is running.")
    
    with col2:
        if st.session_state.get("processing", False):
            st.info("💡 The AI is analyzing your past, present, and future using Gemini. This may take 30-60 seconds for quality insights!")
            
            # Auto-refresh option
            auto_refresh = st.checkbox("🔄 Auto-refresh every 3 seconds", value=st.session_state.get("auto_refresh", False))
            st.session_state["auto_refresh"] = auto_refresh
            
            if auto_refresh:
                time.sleep(3)
                st.rerun()
            
            if st.button("🔄 Check Again Now"):
                with st.spinner("Checking..."):
                    res = get(f"/result/{st.session_state['trace_id']}")
                    if res:
                        if "error" in res and res.get("status") == "error":
                            st.error(f"❌ Error: {res.get('error', 'Unknown error')}")
                            st.session_state["last_result"] = res
                            st.session_state["processing"] = False
                            st.session_state["auto_refresh"] = False
                        elif "error" in res and res.get("status") == "processing":
                            st.warning("⏳ Still processing...")
                        elif "past" in res or "present" in res or "future" in res:
                            st.session_state["last_result"] = res
                            st.session_state["processing"] = False
                            st.session_state["auto_refresh"] = False
                            st.success("✅ Results ready!")
                            st.rerun()
                        else:
                            st.session_state["last_result"] = res
                            st.session_state["processing"] = False
                            st.session_state["auto_refresh"] = False
                            st.rerun()
    
    # Display Results
    if st.session_state.get("last_result"):
        result = st.session_state["last_result"]
        
        # Show error if there's one
        if "error" in result and result.get("status") == "error":
            st.error(f"❌ **Error occurred:** {result['error']}")
            if "details" in result:
                with st.expander("🔍 Error Details"):
                    st.code(result["details"], language="text")
            st.info("💡 **Troubleshooting:**\n- Check if GEMINI_API_KEY is set in .env file\n- Verify the API key is valid\n- Check backend logs for more details")
        elif "error" in result and result.get("status") == "processing":
            # Still processing, don't show results yet
            pass
        elif "past" in result or "present" in result or "future" in result:
            # Success - show results
            # Create tabs for different time periods
            tab1, tab2, tab3, tab4 = st.tabs(["🔍 Past Analysis", "🎯 Present State", "🚀 Future Vision", "✨ Action Plan"])
            
            with tab1:
                if "past" in result:
                    past = result["past"]
                    st.markdown("#### Understanding Your Roots")
                    st.write(past.get("analysis_summary", "No summary available"))
                    
                    col1, col2 = st.columns(2)
                    with col1:
                        if "dominant_emotions" in past and past["dominant_emotions"]:
                            st.markdown("**🎭 Dominant Emotions:**")
                            for emotion in past["dominant_emotions"]:
                                st.write(f"• {emotion}")
                    
                    with col2:
                        if "triggers" in past and past["triggers"]:
                            st.markdown("**⚡ Key Triggers:**")
                            for trigger in past["triggers"]:
                                st.write(f"• {trigger}")
            
            with tab2:
                if "present" in result:
                    present = result["present"]
                    st.markdown("#### Your Current State")
                    st.write(present.get("state_summary", "No summary available"))
                    
                    if "emotions" in present and present["emotions"]:
                        st.markdown("**😊 Current Emotions:**")
                        for emotion in present["emotions"]:
                            st.progress(emotion.get("intensity", 0) / 10)
                            st.write(f"{emotion.get('name', 'Unknown')}: {emotion.get('intensity', 0)}/10")
                    
                    if "recommended_actions" in present and present["recommended_actions"]:
                        st.markdown("**💡 Recommended Actions:**")
                        for action in present["recommended_actions"]:
                            with st.expander(f"✅ {action.get('action', 'Action')}"):
                                st.write(action.get('rationale', 'No rationale provided'))
            
            with tab3:
                if "future" in result:
                    future = result["future"]
                    st.markdown("#### Your Future Possibilities")
                    st.write(future.get("projection_summary", "No summary available"))
                    
                    if "scenarios" in future and future["scenarios"]:
                        st.markdown("**🎲 Possible Scenarios:**")
                        for scenario in future["scenarios"]:
                            likelihood = scenario.get("likelihood", 0)
                            st.write(f"**{scenario.get('scenario', 'Scenario')}**")
                            st.progress(likelihood)
                            st.write(f"Likelihood: {likelihood * 100:.0f}%")
                            st.divider()
                    
                    col1, col2 = st.columns(2)
                    with col1:
                        if "opportunities" in future and future["opportunities"]:
                            st.markdown("**🌟 Opportunities:**")
                            for opp in future["opportunities"]:
                                st.write(f"• {opp}")
                    
                    with col2:
                        if "risks" in future and future["risks"]:
                            st.markdown("**⚠️ Potential Risks:**")
                            for risk in future["risks"]:
                                st.write(f"• {risk}")
            
            with tab4:
                if "integration" in result:
                    integration = result["integration"]
                    st.markdown("#### Your Integrated Action Plan")
                    st.write(integration.get("integrated_summary", "No summary available"))
                    
                    if "plan" in integration and integration["plan"]:
                        st.markdown("**📋 Action Steps:**")
                        for i, step in enumerate(integration["plan"], 1):
                            st.markdown(f"""
                            <div class="result-section">
                                <strong>Step {i}: {step.get('step', 'Action step')}</strong><br>
                                ⏰ Timeframe: {step.get('timeframe', 'Not specified')}
                            </div>
                            """, unsafe_allow_html=True)
                    
                    if "themes" in integration and integration["themes"]:
                        st.markdown("**🎨 Key Themes:**")
                        theme_cols = st.columns(len(integration["themes"]))
                        for i, theme in enumerate(integration["themes"]):
                            with theme_cols[i]:
                                st.info(theme)

# Step 5: Feedback
if st.session_state.get("last_result") and st.session_state.get("trace_id"):
    st.markdown("### 💬 Step 5: Share Your Feedback")
    
    col1, col2 = st.columns([1, 2])
    with col1:
        rating = st.select_slider(
            "How helpful was this?",
            options=[1, 2, 3, 4, 5],
            value=4,
            format_func=lambda x: "⭐" * x
        )
    
    with col2:
        comments = st.text_input(
            "Any thoughts to share?",
            placeholder="Optional: Tell us what you think..."
        )
    
    if st.button("📤 Submit Feedback", type="secondary"):
        res = post("/eval", {
            "trace_id": st.session_state["trace_id"],
            "user_id": user_id,
            "rating": int(rating),
            "comments": comments
        })
        if res:
            st.success("🙏 Thank you for your feedback!")
            st.balloons()

# Footer
st.markdown("---")
st.markdown("""
<div style="text-align: center; color: #666; padding: 1rem;">
    <p>💡 <strong>Emotion Time Travel</strong> - Turning imagination into reality, one step at a time.</p>
</div>
""", unsafe_allow_html=True)