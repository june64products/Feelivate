import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from loguru import logger

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from .llm import call_llm

class GoogleCalendarService:
    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        self.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
        self.scopes = ['https://www.googleapis.com/auth/calendar.events']

    def get_auth_url(self) -> str:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=self.scopes,
            redirect_uri=self.redirect_uri
        )
        auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
        return auth_url

    def exchange_code(self, code: str) -> Dict[str, Any]:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=self.scopes,
            redirect_uri=self.redirect_uri
        )
        flow.fetch_token(code=code)
        credentials = flow.credentials
        return {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes
        }

    async def generate_motivation(self, day_action: str, focus: str, history: str) -> str:
        """Generates a high-energy, personalized motivational message in English."""
        prompt = f"""
        Act as a high-performance execution coach.
        User's Core Goal: {focus}
        User's Past Struggles: {history}
        Today's Task: {day_action}

        Requirement: Write a 2-line punchy, emotionally resonant notification description in English.
        Make the user feel like their future self is counting on them.
        MUST end with a variation of: "Now, let's get today's work done!" or "Today's action determines your future."
        Do NOT use corporate talk. Use direct, powerful language.
        NO HINGLISH. PURE ENGLISH ONLY.
        """
        try:
            # We use the fast Llama model for this as it's a repetitive task
            message = await asyncio.to_thread(call_llm, prompt, model_override="llama-3.3-70b-versatile")
            return message.strip()
        except Exception as e:
            logger.error(f"Failed to generate motivation: {e}")
            return f"Today's mission: {day_action}. Let's make it happen!"

    async def sync_roadmap_to_calendar(self, user_refresh_token: str, roadmap_data: Dict[str, Any], user_context: Dict[str, str], preferred_time: str = "08:00"):
        """Syncs the entire 6-month roadmap to Google Calendar with specific time."""
        creds = Credentials(
            None,
            refresh_token=user_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=self.scopes
        )

        if not creds.valid:
            creds.refresh(Request())

        service = build('calendar', 'v3', credentials=creds)

        roadmap = roadmap_data.get("integration", {}).get("roadmap", [])
        if not roadmap:
            logger.warning("No roadmap found in data to sync.")
            return

        # Parse preferred time
        try:
            hour, minute = map(int, preferred_time.split(':'))
        except:
            hour, minute = 8, 0

        for month in roadmap:
            for week in month.get("weeks", []):
                for day in week.get("days", []):
                    day_str = day.get("day_name", "")
                    action = day.get("action", "Time Travel Task")
                    
                    motivation = await self.generate_motivation(
                        action, 
                        user_context.get("focus", ""), 
                        user_context.get("history", "")
                    )

                    date_iso = self._parse_to_iso_date(day_str)
                    
                    # Create start/end date-time based on user preference
                    # We create a 1-hour window for the task
                    start_time = f"{date_iso}T{hour:02d}:{minute:02d}:00"
                    end_time = f"{date_iso}T{(hour+1)%24:02d}:{minute:02d}:00"

                    event = {
                        'summary': f'🚀 {action}',
                        'description': f'{motivation}\n\nEmotion Time Travel: Behavioral Architecture Engine.',
                        'start': {
                            'dateTime': start_time,
                            'timeZone': 'UTC', # Use UTC or local, but we'll try to stick to generic to avoid confusion
                        },
                        'end': {
                            'dateTime': end_time,
                            'timeZone': 'UTC',
                        },
                        'reminders': {
                            'useDefault': False,
                            'overrides': [
                                {'method': 'popup', 'minutes': 0}, 
                                {'method': 'popup', 'minutes': 30},
                            ],
                        },
                    }

                    try:
                        service.events().insert(calendarId='primary', body=event).execute()
                        logger.info(f"Synced day: {day_str} at {preferred_time}")
                    except Exception as e:
                        logger.error(f"Failed to sync day {day_str}: {e}")

    async def clear_roadmap_events(self, user_refresh_token: str):
        """Removes all future 'Emotion Time Travel' events from the calendar."""
        creds = Credentials(
            None,
            refresh_token=user_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=self.scopes
        )
        if not creds.valid:
            creds.refresh(Request())

        service = build('calendar', 'v3', credentials=creds)
        
        # Find events with our signature in description
        now = datetime.utcnow().isoformat() + 'Z'
        events_result = service.events().list(calendarId='primary', timeMin=now, q='Emotion Time Travel').execute()
        events = events_result.get('items', [])

        for event in events:
            try:
                service.events().delete(calendarId='primary', eventId=event['id']).execute()
                logger.info(f"Deleted event: {event.get('summary')}")
            except Exception as e:
                logger.error(f"Failed to delete event: {e}")

    def _parse_to_iso_date(self, day_str: str) -> str:
        """Helper to convert various AI date formats to YYYY-MM-DD."""
        # AI format: "Apr 22 (Wed)" -> This is missing year in the prompt often, but the orchestrator includes %Y
        # Based on orchestrator.py: month_start_date.strftime("%b %d, %Y (%A)")
        # Example: "Apr 25, 2026 (Sat)"
        try:
            # Try parsing with year and day name
            dt = datetime.strptime(day_str.split(' (')[0], "%b %d, %Y")
            return dt.strftime("%Y-%m-%d")
        except:
            try:
                # If it's just "Apr 22" or similar
                dt = datetime.strptime(day_str.split(' (')[0], "%b %d")
                # Assume current or next year based on month
                now = datetime.now()
                year = now.year
                if dt.month < now.month - 1:
                    year += 1
                return dt.replace(year=year).strftime("%Y-%m-%d")
            except:
                # Fallback to today if all else fails
                return datetime.now().strftime("%Y-%m-%d")

calendar_service = GoogleCalendarService()
