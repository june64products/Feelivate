"""
The voice of the emails — written by a person, picked by the data.

Zomato and Swiggy's notifications work because they sound like a friend who
knows what you did last week, not a brand; Duolingo's work because they
rotate the hook (streak, progress, loss, reward) so no nerve is hit twice
in a row. This module is that: a library of lines, one situation each, in
Hinglish for people in India and English elsewhere, with slots for the
person's own numbers. The model never writes these; it only adds the one
line that reads last night's note.

The voice is a strict mentor's: pointed every day, dark when the
person slips — a missed day, a skipped note, a streak about to die, a week
with more misses than days done. The dark lines name the avoidance and
the excuse ("you weren't busy", "you chose something else"); they never
go after the person's body, mind or worth.

Every pick is remembered on the user row so a line is not repeated within
two weeks and the same hook is not used two mornings running.
"""
import json
import re
from datetime import date, timedelta
from typing import List, Optional

HI_ZONES = ("Asia/Kolkata", "Asia/Calcutta")
RECENT_DAYS = 14
RECENT_MAX = 40
MILESTONES = (7, 14, 21, 30, 45, 60, 90, 100)


HINGLISH = False  # the user wants every email in English; the Hinglish lines stay for later


def lang_for(timezone: Optional[str]) -> str:
    """English for everyone (Hinglish for people in India only when HINGLISH is on)."""
    return "hi" if HINGLISH and (timezone or "") in HI_ZONES else "en"


def short_task(title: str, limit: int = 64) -> str:
    """
    The task as a phrase: the leading "After breakfast —" style stage
    direction dropped, the first clause kept, cut at a word.
    """
    t = " ".join((title or "").split())
    t = re.sub(r"^(after|before|post|pre)\s+\w+\s*[—–:-]\s*", "", t, flags=re.I)
    t = re.sub(r"^(morning|evening|tonight|today)\s*[—–:-]\s*", "", t, flags=re.I)
    t = re.split(r"[.;]\s|\s[—–]\s|\s\(", t, maxsplit=1)[0].strip().rstrip(".,:;")
    if len(t) > limit:
        cut = t[:limit].rsplit(" ", 1)[0].rstrip(",;:")
        t = (cut or t[:limit]) + "…"
    return t[:1].upper() + t[1:] if t else "today's task"


def task_noun(title: str) -> str:
    """A two-to-three word noun for a subject line: "piano", "the run", "push-ups"."""
    t = short_task(title, 40).lower()
    t = re.sub(r"^(warm[- ]?up with|warm[- ]?up:?|practice|do|play|learn|try|work on|complete|finish|start)\s+", "", t)
    t = re.sub(r"\b(\d+|a|an|the|your|for|of|with|and|then|minutes?|mins?|min)\b", " ", t)
    words = [w for w in re.sub(r"[^\w\s'-]", " ", t).split() if w]
    return " ".join(words[:3]) or "the task"


class _Slots(dict):
    def __missing__(self, key):
        return ""


def _fmt(text: str, ctx: dict) -> str:
    return " ".join(text.format_map(_Slots(ctx)).split()).replace(" ,", ",").replace(" .", ".")


def _e(sit, lang, s, h, l, cta, req=()):
    return {"sit": sit, "lang": lang, "s": s, "h": h, "l": l, "cta": cta, "req": tuple(req)}


# ─── the library ─────────────────────────────────────────────────────────────
# Slots: {name} {task} {task_noun} {streak} {next} {score} {emotion} {day} {week}
# {idx} {total} {done} {past} {status_line} {badge} {headline} {teaser}
# {their_words}. Subjects stay under ~48 characters so a phone shows them whole.

MORNING: List[dict] = [
    # first day of a week
    _e("first_day", "hi", "Day 1, {name}. Pehla din sabse aasaan.", "Aaj sirf shuru karna hai. Bas.", "{task}. Done ka matlab done, perfect nahi.", "Chalo, shuru"),
    _e("first_day", "hi", "Week {week} ka pehla din. Halka rakho.", "Pehla din halka, baaki hafta aasaan.", "Aaj: {task}. Itna hi.", "Aaj ka task dekho"),
    _e("first_day", "hi", "{name}, aaj se ginti shuru.", "Day 1 of {total}. Yahin se chain banti hai.", "{task} — aur aaj raat ek minute bol dena kaisa gaya.", "Shuru karo"),
    _e("first_day", "en", "Day 1, {name}. Everyone starts. Few come back.", "Starting is the easy part. Prove the second day.", "{task}. Done, not pretty.", "Start"),
    _e("first_day", "en", "Week {week}, Day 1. No excuses on file yet.", "Clean slate. Don't waste it.", "Today: {task}. Then tonight, say it out loud.", "Open day one"),
    _e("first_day", "en", "Day 1 of {total}, {name}. The excuse list is empty.", "Let's see which list grows: days done, or reasons.", "{task}. One minute tonight on how it went.", "Let's go"),
    # a streak milestone (7, 14, 21…)
    _e("milestone", "hi", "{streak} din. Ab yeh habit hai, {name}.", "{streak} din lagataar. Yeh luck nahi hai.", "Shield unlock: ek bura din ab streak nahi todega. Aaj: {task}.", "Dekho kya unlock hua"),
    _e("milestone", "hi", "Ek hafta poora. Kam log yahan tak aate hain.", "{streak} days. Aise hi log goal poora karte hain.", "Aaj: {task}. Routine ab tumhari hai.", "Aage badho"),
    _e("milestone", "en", "{streak} days. Don't get comfortable, {name}.", "{streak} straight. This is where people relax and lose it.", "Shield unlocked: one bad day won't kill it now. Today: {task}.", "See what unlocked"),
    _e("milestone", "en", "A full week. Most people quit on day 3.", "{streak} days running. The real test is day {next}.", "Today: {task}. The routine is yours now. Don't drop it.", "Keep the run"),
    # last night was rough (score ≤ 4)
    _e("after_low", "hi", "Kal {score}/10 tha. Aaj sirf 2 minute.", "Bura din tha. Aaj chhota din rakho.", "Bare minimum ready hai: {task} ka 2-minute version, bas.", "2 minute version dekho"),
    _e("after_low", "hi", "Kal {emotion}. Aaj halka, {name}.", "Kal thak gaye the. Aaj sirf dikhna hai.", "{task} — jitna ho sake. Chain zinda rakhni hai, record nahi banana.", "Halka din kholo"),
    _e("after_low", "hi", "{score}/10 ke baad agla din sabse important.", "Ek bura din kuch nahi. Do, aadat.", "Aaj: {task}. Chhota, par aaj.", "Aaj ka din bachao"),
    _e("after_low", "en", "Yesterday was a {score}/10. Still no excuse.", "Rough night. Tiny day. But a day.", "The bare-minimum version is ready: {task}, two minutes, done.", "Take the tiny day"),
    _e("after_low", "en", "{emotion} yesterday. Showing up anyway, {name}?", "Bad days are where this gets decided.", "{task} — as much as you've got. The chain only needs a tick.", "Show up anyway"),
    _e("after_low", "en", "After a {score}/10, today's the one that counts.", "One bad day is weather. Two is climate.", "Today: {task}. Small, but today.", "Save today"),
    # last night was good (score ≥ 7)
    _e("after_high", "hi", "Kal {score}/10. Wahi feeling aaj dobara?", "Kal jo chala, aaj repeat.", "Tumne kaha tha: “{their_words}”. Aaj: {task}.", "Repeat karo", req=("their_words",)),
    _e("after_high", "hi", "Kal {emotion} the. Aaj usi ko kharch karo.", "Momentum hai. Bachao mat, use karo.", "{task} — kal wale time par.", "Aaj ka task"),
    _e("after_high", "hi", "Kal ka din achha tha. Aaj usse jodo.", "Achhe din akele nahi aate. Jod ke aate hain.", "Aaj: {task}.", "Jodo"),
    _e("after_high", "en", "Yesterday was a {score}/10. Don't waste it.", "Good days are easy to squander.", "You said: “{their_words}”. Today: {task}.", "Encore", req=('their_words',)),
    _e("after_high", "en", "{emotion} yesterday. Watch it fade by noon.", "Momentum is perishable. Use it before it goes.", "{task} — same slot as yesterday.", "Use it"),
    _e("after_high", "en", "Good day yesterday. One doesn't count.", "Two makes a pattern. One is a fluke.", "Today: {task}.", "Make it two"),
    # yesterday got a tick but no note
    _e("no_note", "hi", "Kal tick to laga, bola kuch nahi.", "Mentor ko box dikha, din nahi.", "Aaj raat 1 minute bol dena. Aaj: {task}.", "Aaj ka task"),
    _e("no_note", "en", "Ticked the box. Said nothing. Convenient.", "A tick with no words is a tick you can't back up.", "Tonight, one minute, the real version. Today: {task}.", "Today's task"),
    # two or more misses this week already (yesterday itself was done, or the recovery email would have gone)
    _e("slipping", "en", "{misses} days of 'tomorrow', {name}.", "You're not busy. You're avoiding it.", "{done} of {past} done. Today: {task}. No speech, just the task.", "Stop avoiding it"),
    _e("slipping", "en", "One more skip and this becomes a story.", "The one you tell about the time you tried.", "Today is where it turns, or doesn't: {task}.", "Turn it"),
    _e("slipping", "en", "{done} for {past}. You know what that looks like.", "The plan isn't the problem, {name}.", "{task}. Ten minutes. Then argue with me tonight.", "Do the ten"),
    # the last day of the week
    _e("last_day", "hi", "Aaj last din. Shaam ko report card banega.", "Hafte ka aakhri task. Phir hisaab.", "{task}. Raat ko mentor poora hafta padhega.", "Hafta khatam karo"),
    _e("last_day", "en", "Last day. Tonight the week gets graded.", "No hiding from the report card.", "{task}. Tonight your mentor reads all seven days.", "Finish the week"),
    # weekday moments
    _e("monday", "hi", "Monday ka sach: 10 min {task_noun} > 60 min guilt.", "Hafta yahin se banta hai.", "Aaj ka task Monday-proof hai: {task}.", "Monday jeeto"),
    _e("monday", "hi", "Monday, {name}. Hafte ko pehle din pakdo.", "Monday jo karta hai, Sunday woh dikhata hai.", "{task}. Itna hi.", "Shuru"),
    _e("monday", "en", "Monday math: 10 min {task_noun} > 60 min guilt.", "Skip today and the whole week knows.", "Today's task is Monday-proof: {task}.", "Win Monday"),
    _e("monday", "en", "Monday, {name}. Don't make it the usual story.", "What Monday does, Sunday shows.", "{task}. That's the whole Monday.", "Start"),
    _e("wednesday", "hi", "Aadha hafta. {done}/{past} done. Just saying.", "Midweek check: {status_line}", "Aaj nikal gaya toh weekend aasaan: {task}.", "Aaj nikaalo"),
    _e("wednesday", "en", "Halfway. {done}/{past} done. Just saying.", "Midweek check: {status_line}", "Clear today, or the weekend becomes catch-up again: {task}.", "Clear today"),
    _e("friday", "hi", "Friday hai. Weekend ko batao hafta jeeta.", "Aaj kar lo, weekend guilt-free.", "{task}. Phir Saturday tumhari.", "Friday clear karo"),
    _e("friday", "en", "It's Friday. The weekend is watching.", "Skip now, pay Sunday.", "{task}. Then Saturday is yours, guilt-free.", "Clear Friday"),
    # a streak running (2–6)
    _e("streak", "hi", "{streak} din ho gaye. Aaj rukne ka mann? Nahi na.", "{streak} in a row. Chain mat todo.", "Aaj: {task}. Kal se chhota lagega, promise.", "Chain jaari rakho"),
    _e("streak", "hi", "{streak} din. Ab toh aadat ban rahi hai, {name}.", "{streak} din lagataar. Aaj {next}.", "{task}. Streak khud nahi chalti, tum chalate ho.", "Day {idx} karo"),
    _e("streak", "hi", "Streak {streak}. Just saying.", "{streak} din se tum dikh rahe ho.", "Aaj bhi dikho: {task}.", "Aaj ka 10 minute"),
    _e("streak", "en", "{streak} days in. Don't you dare stop now, {name}.", "{streak} in a row. Break it and it was for nothing.", "Today: {task}. Smaller than it looks.", "Keep the chain"),
    _e("streak", "en", "{streak} days. Starting to look like a habit.", "{streak} straight. Day {next} is where most people blink.", "{task}. Streaks don't run themselves.", "Do day {idx}"),
    _e("streak", "en", "Streak: {streak}. Easy to lose. Just saying.", "You've shown up {streak} days running. Today decides {next}.", "Show up again: {task}.", "Today's ten minutes"),
    # nothing special about today
    _e("default", "hi", "Day {idx} of {total}, {name}. Ek kaam.", "Aaj ka ek kaam. Bas ek.", "{task}.", "Dekho"),
    _e("default", "hi", "{day}: {task_noun}. Itna hi.", "Ek task, ek din. Simple.", "{task}.", "Aaj ka task"),
    _e("default", "hi", "{name}, aaj ka hisaab chhota hai.", "Ek kaam, phir free.", "{task}. Shaam ko ek minute.", "Kar lo"),
    _e("default", "en", "Day {idx} of {total}, {name}. One thing. No excuses.", "One task. One day. No negotiating.", "{task}.", "Do it"),
    _e("default", "en", "{day}: {task_noun}. That's it. That's the email.", "Today's bill is small. Pay it.", "{task}. One minute tonight.", "Pay it"),
    _e("default", "en", "{name}, your to-do list has one item.", "Nobody's going to do it for you.", "{task}.", "Today's task"),
]

RECOVERY: List[dict] = [
    _e("missed", "hi", "Kal gaya. Aaj nahi jaayega.", "Ek din miss = kuch nahi. Do din = aadat tooti.", "Aaj ka chhota version ready hai: {task}.", "Wapas aao"),
    _e("missed", "hi", "{name}, kal chhoot gaya. Theek hai. Aaj?", "Kal ka hisaab nahi. Aaj ka hai.", "2-minute version chalega. Bas aaj: {task}.", "Aaj karo"),
    _e("missed", "en", "You quit yesterday, {name}. Just for a day.", "But you did.", "Quitting for a day is how quitting starts. Today: {task}.", "Un-quit"),
    _e("missed", "en", "You'll say you were busy. You weren't.", "Nobody noticed you skipped. That's the problem.", "No one is watching this but you. Today: {task}.", "Show up"),
    _e("missed", "en", "This is exactly how it went last time.", "A skipped day, a good reason, then nothing.", "Break the script today: {task}. The small version counts.", "Break the script"),
    _e("missed", "en", "Yesterday you chose something else.", "Say it out loud. Then fix it.", "Today's version is small on purpose: {task}.", "Fix it today"),
]

EVENING: List[dict] = [
    _e("sunday_last", "hi", "Hafte ki aakhri note. Report card adhoora.", "Sunday ki note, poore hafte ka hisaab.", "Mentor raat ko hafta padhega. Aaj ka din bhi dena.", "Note do"),
    _e("sunday_last", "en", "Last note of the week. Don't duck the report card.", "Sunday's note closes the week. Or leaves a hole in it.", "Your mentor reads the whole week tonight. Don't leave today blank.", "Give it"),
    _e("streak_risk", "hi", "{streak} din ki streak, 11:59 pe gayab.", "1 minute mein bacha lo.", "Bas bol do aaj kaisa gaya. Itna hi.", "Streak bachao"),
    _e("streak_risk", "hi", "{streak} din ka kaam, aaj raat ka ek minute.", "Streak ko sirf ek minute chahiye.", "Note record karo, din done.", "1 minute"),
    _e("streak_risk", "en", "{streak} days, and tonight you let it die.", "Not lose it. Let it.", "One minute saves it. Say how today went.", "Save it"),
    _e("streak_risk", "en", "{streak}-day streak. Gone at 11:59. Your call.", "You built it. You're the one walking away.", "Record the note. Day's done.", "One minute"),
    _e("journal", "hi", "Ek minute, {name}. Aaj kaisa gaya?", "Bolo, kal subah mentor ko kya batau?", "Done, aadha, ya kuch nahi. Sab chalega, chup nahi.", "1 minute bolo"),
    _e("journal", "hi", "Aaj ka din bina note ke so jaayega?", "Din gaya, note baaki.", "Aaj tha: {task}. Kaisa gaya, 60 second mein.", "Record karo"),
    _e("journal", "hi", "{name}, din ka last kaam. Sabse chhota.", "Bol ke so jao.", "Kal ka plan isi ek minute se banta hai.", "Bolo"),
    _e("journal", "en", "Another day you'd rather not talk about?", "Silence. So it didn't happen.", "Done, half, or nothing — say it. Not saying it is its own answer.", "Say it"),
    _e("journal", "en", "You're about to sleep on a blank day.", "The day's done. The note isn't.", "Today was: {task}. Sixty seconds. Then sleep.", "Record it"),
    _e("journal", "en", "One minute, {name}. Or did you skip that too?", "Last job of the day. The smallest one.", "Tomorrow's plan is built from this minute. Skip it and tomorrow is a guess.", "One minute"),
]

REVIEW: List[dict] = [
    _e("quiet", "hi", "Hafta khamosh gaya. Koi lecture nahi.", "Restart, same level.", "Mentor ne kuch maana nahi, sirf note kiya.", "Restart"),
    _e("quiet", "en", "Seven days. Zero notes. That's a choice, {name}.", "A week of nothing.", "No lecture — just this: the restart is the same plan, and it's waiting.", "Restart"),
    _e("quiet", "en", "You went quiet. The goal didn't.", "Week {week}: nothing recorded.", "Same level, fresh start. Show up this time.", "Restart"),
    _e("weak", "en", "{done} days. You planned {total}, {name}.", "{done}/{total}. {badge}.", "{teaser}", "Face the report card", req=('badge',)),
    _e("weak", "en", "{misses_total} days you chose something else.", "{headline}", "{teaser}", "See the damage"),
    _e("review", "hi", "Report card aa gaya. Mummy ko mat dikhana 😄", "{done}/{total}. {badge}.", "{teaser}", "Report card dekho", req=("badge",)),
    _e("review", "hi", "Week {week} ka hisaab ready hai, {name}.", "{headline}", "{teaser}", "Poora dekho"),
    _e("review", "hi", "{badge}. Yeh kaise mila, andar hai.", "{headline}", "{teaser}", "Dekho kyun", req=("badge",)),
    _e("review", "en", "Report card's in. Read it before you spin it.", "{done}/{total}. {badge}.", "{teaser}", "Face it", req=('badge',)),
    _e("review", "en", "Week {week} is in, {name}. No sugar on it.", "{headline}", "{teaser}", "See it all"),
    _e("review", "en", "{badge}. Read how you actually earned it.", "{headline}", "{teaser}", "See why", req=('badge',)),
]

for _lib in (MORNING, RECOVERY, EVENING, REVIEW):
    _counts: dict = {}
    for _entry in _lib:
        key = (_entry["sit"], _entry["lang"])
        _counts[key] = _counts.get(key, 0) + 1
        _entry["id"] = f"{_entry['sit']}.{_entry['lang']}.{_counts[key]}"

ONE_OFFS = {"first_day", "milestone", "missed", "last_day", "quiet", "weak"}


# ─── remembering what went out ───────────────────────────────────────────────

def recent_for(user) -> list:
    """[{"id", "sit", "d"}, ...], newest first, from the user row."""
    try:
        items = json.loads(getattr(user, "email_copy_recent", None) or "[]")
    except (TypeError, ValueError):
        items = []
    return [i for i in items if isinstance(i, dict) and i.get("id")]


def remember(user, copy: dict, today_iso: str) -> None:
    """Record a pick on the user row (newest first, capped)."""
    items = [{"id": copy["id"], "sit": copy["sit"], "d": today_iso}] + recent_for(user)
    user.email_copy_recent = json.dumps(items[:RECENT_MAX])


def _recent_ids(recent: list, today_iso: str) -> set:
    try:
        today = date.fromisoformat(today_iso)
    except (TypeError, ValueError):
        return {r["id"] for r in recent}
    out = set()
    for r in recent:
        try:
            if (today - date.fromisoformat(r.get("d", ""))).days <= RECENT_DAYS:
                out.add(r["id"])
        except (TypeError, ValueError):
            out.add(r["id"])
    return out


def _yesterdays_hook(recent: list, today_iso: str, kind_prefix: str) -> Optional[str]:
    """The situation used the previous day for this kind of email, if any."""
    try:
        y = (date.fromisoformat(today_iso) - timedelta(days=1)).isoformat()
    except (TypeError, ValueError):
        return None
    for r in recent:
        if r.get("d") == y and r.get("id", "").startswith(kind_prefix):
            return r.get("sit")
    return None


def _pick(library: List[dict], order: List[str], lang: str, ctx: dict, recent: list, today_iso: str, avoid_sit: Optional[str] = None) -> dict:
    used = _recent_ids(recent, today_iso)
    eligible_by_sit = {}
    for sit in order:
        pool = [e for e in library if e["sit"] == sit and e["lang"] == lang and all(ctx.get(k) for k in e["req"])]
        if not pool and lang != "en":
            pool = [e for e in library if e["sit"] == sit and e["lang"] == "en" and all(ctx.get(k) for k in e["req"])]
        if pool:
            eligible_by_sit[sit] = pool
    chosen_sit = None
    for sit in order:
        if sit not in eligible_by_sit:
            continue
        if sit == avoid_sit and sit not in ONE_OFFS and any(s in eligible_by_sit for s in order[order.index(sit) + 1:]):
            continue  # the same hook as yesterday — let another one through
        chosen_sit = sit
        break
    if chosen_sit is None:
        chosen_sit = next(iter(eligible_by_sit)) if eligible_by_sit else None
    if chosen_sit is None:
        return {"id": "none", "sit": "none", "subject": _fmt("{task}", ctx) or "Today", "headline": "", "line": "", "cta": "Open Feelivate"}
    pool = eligible_by_sit[chosen_sit]
    fresh = [e for e in pool if e["id"] not in used]
    if fresh:
        entry = fresh[0]
    else:
        # Everything in this situation went out recently: the one that went out longest ago.
        last_seen = {r["id"]: r.get("d", "") for r in reversed(recent)}
        entry = min(pool, key=lambda e: last_seen.get(e["id"], ""))
    return {
        "id": entry["id"], "sit": entry["sit"],
        "subject": _fmt(entry["s"], ctx), "headline": _fmt(entry["h"], ctx),
        "line": _fmt(entry["l"], ctx), "cta": _fmt(entry["cta"], ctx),
    }


# ─── the public picks ────────────────────────────────────────────────────────

def _base_ctx(ctx: dict) -> dict:
    c = dict(ctx)
    c["name"] = (c.get("name") or "there").split()[0]
    c["task"] = short_task(c.get("task_title") or c.get("task") or "")
    c["task_noun"] = task_noun(c.get("task_title") or c.get("task") or "")
    if c.get("streak"):
        c["next"] = int(c["streak"]) + 1
    misses = max(0, int(c.get("past") or 0) - int(c.get("done") or 0))
    c["misses"], c["misses_next"] = misses, misses + 1
    c["misses_total"] = max(0, int(c.get("total") or 0) - int(c.get("done") or 0))
    return c


def pick_morning(ctx: dict, lang: str, recent: list, today_iso: str) -> dict:
    """
    ctx: name, task_title, streak, idx, total, done, past, day (weekday
    name), week, and from last night: score, emotion, their_words, noted
    (bool), ticked (bool — a check-in without a note).
    """
    c = _base_ctx(ctx)
    streak = int(c.get("streak") or 0)
    score = c.get("score")
    idx, total = c.get("idx"), c.get("total")
    done, past = int(c.get("done") or 0), int(c.get("past") or 0)
    c["status_line"] = ("tum aage ho." if lang == "hi" else "you're ahead.") if past and done >= past - 1 else ("wapas aane ka din." if lang == "hi" else "you're behind, and you know it.")
    weekday = (c.get("day") or "").lower()
    order: List[str] = []
    if idx == 1:
        order.append("first_day")
    if streak in MILESTONES:
        order.append("milestone")
    if c.get("noted") and isinstance(score, (int, float)) and score <= 4:
        order.append("after_low")
    if c.get("noted") and isinstance(score, (int, float)) and score >= 7:
        order.append("after_high")
    if past - done >= 2 and idx != 1:
        order.append("slipping")
    if c.get("ticked") and not c.get("noted") and idx != 1:
        order.append("no_note")
    if idx and total and idx == total:
        order.append("last_day")
    if weekday == "monday" and idx != 1:
        order.append("monday")
    if weekday == "wednesday":
        order.append("wednesday")
    if weekday == "friday":
        order.append("friday")
    if 2 <= streak <= 6:
        order.append("streak")
    order.append("default")
    avoid = _yesterdays_hook(recent, today_iso, "")
    return _pick(MORNING, order, lang, c, recent, today_iso, avoid_sit=avoid)


def pick_recovery(ctx: dict, lang: str, recent: list, today_iso: str) -> dict:
    return _pick(RECOVERY, ["missed"], lang, _base_ctx(ctx), recent, today_iso)


def pick_evening(ctx: dict, lang: str, recent: list, today_iso: str) -> dict:
    """ctx: name, task_title, streak (the one at risk tonight, else 0), last_day (bool)."""
    c = _base_ctx(ctx)
    order: List[str] = []
    if c.get("last_day"):
        order.append("sunday_last")
    if int(c.get("streak") or 0) >= 2:
        order.append("streak_risk")
    order.append("journal")
    avoid = _yesterdays_hook(recent, today_iso, "streak_risk")
    return _pick(EVENING, order, lang, c, recent, today_iso, avoid_sit=avoid)


def pick_review(ctx: dict, lang: str, recent: list, today_iso: str) -> dict:
    """ctx: name, week, done, total, badge, headline, teaser, quiet (bool)."""
    c = _base_ctx(ctx)
    done, total = int(c.get("done") or 0), int(c.get("total") or 7)
    if c.get("quiet"):
        order = ["quiet"]
    elif total and done / total < 0.5:
        order = ["weak", "review"]
    else:
        order = ["review"]
    return _pick(REVIEW, order, lang, c, recent, today_iso)
