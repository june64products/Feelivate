"""
The voice of the emails — written by a person, picked by the data.

Zomato and Swiggy's notifications work because they sound like a friend who
knows what you did last week, not a brand; Duolingo's work because they
rotate the hook (streak, progress, loss, reward) so no nerve is hit twice
in a row. This module is that: a library of lines, one situation each, in
Hinglish for people in India and English elsewhere, with slots for the
person's own numbers. The model never writes these; it only adds the one
line that reads last night's note.

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


def lang_for(timezone: Optional[str]) -> str:
    """Hinglish for people in India, English for everyone else."""
    return "hi" if (timezone or "") in HI_ZONES else "en"


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
    _e("first_day", "en", "Day 1, {name}. The easy one.", "Today you only have to start.", "{task}. Done means done, not perfect.", "Start today"),
    _e("first_day", "en", "Week {week} starts now. Keep it light.", "A light day one makes a light week.", "Today: {task}. That's all.", "See today's task"),
    _e("first_day", "en", "{name}, the count starts today.", "Day 1 of {total}. Chains start here.", "{task}, then one minute tonight on how it went.", "Let's go"),

    # a streak milestone (7, 14, 21…)
    _e("milestone", "hi", "{streak} din. Ab yeh habit hai, {name}.", "{streak} din lagataar. Yeh luck nahi hai.", "Shield unlock: ek bura din ab streak nahi todega. Aaj: {task}.", "Dekho kya unlock hua"),
    _e("milestone", "hi", "Ek hafta poora. Kam log yahan tak aate hain.", "{streak} days. Aise hi log goal poora karte hain.", "Aaj: {task}. Routine ab tumhari hai.", "Aage badho"),
    _e("milestone", "en", "{streak} days. That's a habit now, {name}.", "{streak} straight days. That isn't luck.", "Shield unlocked: one bad day won't break the chain now. Today: {task}.", "See what unlocked"),
    _e("milestone", "en", "A full week. Most people don't get here.", "{streak} days. This is how goals actually get done.", "Today: {task}. The routine is yours now.", "Keep going"),

    # last night was rough (score ≤ 4)
    _e("after_low", "hi", "Kal {score}/10 tha. Aaj sirf 2 minute.", "Bura din tha. Aaj chhota din rakho.", "Bare minimum ready hai: {task} ka 2-minute version, bas.", "2 minute version dekho"),
    _e("after_low", "hi", "Kal {emotion}. Aaj halka, {name}.", "Kal thak gaye the. Aaj sirf dikhna hai.", "{task} — jitna ho sake. Chain zinda rakhni hai, record nahi banana.", "Halka din kholo"),
    _e("after_low", "hi", "{score}/10 ke baad agla din sabse important.", "Ek bura din kuch nahi. Do, aadat.", "Aaj: {task}. Chhota, par aaj.", "Aaj ka din bachao"),
    _e("after_low", "en", "Yesterday was a {score}/10. Today asks for 2 min.", "Rough day. Make today a small one.", "The bare minimum is ready: a 2-minute version of {task}.", "See the 2-minute version"),
    _e("after_low", "en", "Yesterday: {emotion}. Today: light, {name}.", "You were drained. Today you only have to show up.", "{task} — as much as you can. Keep the chain, skip the record.", "Open the light day"),
    _e("after_low", "en", "After a {score}/10, the next day matters most.", "One bad day is nothing. Two is a habit.", "Today: {task}. Small, but today.", "Save today"),

    # last night was good (score ≥ 7)
    _e("after_high", "hi", "Kal {score}/10. Wahi feeling aaj dobara?", "Kal jo chala, aaj repeat.", "Tumne kaha tha: “{their_words}”. Aaj: {task}.", "Repeat karo", req=("their_words",)),
    _e("after_high", "hi", "Kal {emotion} the. Aaj usi ko kharch karo.", "Momentum hai. Bachao mat, use karo.", "{task} — kal wale time par.", "Aaj ka task"),
    _e("after_high", "hi", "Kal ka din achha tha. Aaj usse jodo.", "Achhe din akele nahi aate. Jod ke aate hain.", "Aaj: {task}.", "Jodo"),
    _e("after_high", "en", "Yesterday was a {score}/10. Same again today?", "What worked yesterday, repeat today.", "You said: “{their_words}”. Today: {task}.", "Repeat it", req=("their_words",)),
    _e("after_high", "en", "You were {emotion} yesterday. Spend it today.", "You've got momentum. Use it, don't save it.", "{task} — same time as yesterday.", "Today's task"),
    _e("after_high", "en", "Good day yesterday. Stack another on it.", "Good days come in stacks.", "Today: {task}.", "Stack it"),

    # yesterday got a tick but no note
    _e("no_note", "hi", "Kal tick to laga, bola kuch nahi.", "Mentor ko box dikha, din nahi.", "Aaj raat 1 minute bol dena. Aaj: {task}.", "Aaj ka task"),
    _e("no_note", "en", "Yesterday got a tick, not a word.", "Your mentor saw the box, not the day.", "One minute tonight. Today: {task}.", "Today's task"),

    # the last day of the week
    _e("last_day", "hi", "Aaj last din. Shaam ko report card banega.", "Hafte ka aakhri task. Phir hisaab.", "{task}. Raat ko mentor poora hafta padhega.", "Hafta khatam karo"),
    _e("last_day", "en", "Last day. The report card comes tonight.", "One more task, then the week gets read.", "{task}. Tonight your mentor reads the whole week.", "Finish the week"),

    # weekday moments
    _e("monday", "hi", "Monday ka sach: 10 min {task_noun} > 60 min guilt.", "Hafta yahin se banta hai.", "Aaj ka task Monday-proof hai: {task}.", "Monday jeeto"),
    _e("monday", "hi", "Monday, {name}. Hafte ko pehle din pakdo.", "Monday jo karta hai, Sunday woh dikhata hai.", "{task}. Itna hi.", "Shuru"),
    _e("monday", "en", "Monday truth: 10 min {task_noun} > 60 min guilt.", "The week is built right here.", "Today's task is Monday-proof: {task}.", "Win Monday"),
    _e("monday", "en", "Monday, {name}. Catch the week on day one.", "What Monday does, Sunday shows.", "{task}. That's all.", "Start"),
    _e("wednesday", "hi", "Aadha hafta. {done}/{past} done. Just saying.", "Midweek check: {status_line}", "Aaj nikal gaya toh weekend aasaan: {task}.", "Aaj nikaalo"),
    _e("wednesday", "en", "Halfway. {done}/{past} done. Just saying.", "Midweek check: {status_line}", "Get today done and the weekend is easy: {task}.", "Get it done"),
    _e("friday", "hi", "Friday hai. Weekend ko batao hafta jeeta.", "Aaj kar lo, weekend guilt-free.", "{task}. Phir Saturday tumhari.", "Friday clear karo"),
    _e("friday", "en", "It's Friday. Tell the weekend you won the week.", "Do it today, the weekend is guilt-free.", "{task}. Then Saturday is yours.", "Clear Friday"),

    # a streak running (2–6)
    _e("streak", "hi", "{streak} din ho gaye. Aaj rukne ka mann? Nahi na.", "{streak} in a row. Chain mat todo.", "Aaj: {task}. Kal se chhota lagega, promise.", "Chain jaari rakho"),
    _e("streak", "hi", "{streak} din. Ab toh aadat ban rahi hai, {name}.", "{streak} din lagataar. Aaj {next}.", "{task}. Streak khud nahi chalti, tum chalate ho.", "Day {idx} karo"),
    _e("streak", "hi", "Streak {streak}. Just saying.", "{streak} din se tum dikh rahe ho.", "Aaj bhi dikho: {task}.", "Aaj ka 10 minute"),
    _e("streak", "en", "{streak} days in. Don't break it today, {name}.", "{streak} in a row. Keep the chain.", "Today: {task}. It'll feel smaller than yesterday.", "Keep the chain"),
    _e("streak", "en", "{streak} days. This is becoming a habit.", "{streak} straight. Make it {next}.", "{task}. Streaks don't run themselves.", "Do day {idx}"),
    _e("streak", "en", "Streak: {streak}. Just saying.", "You've shown up {streak} days running.", "Show up again: {task}.", "Today's ten minutes"),

    # nothing special about today
    _e("default", "hi", "Day {idx} of {total}, {name}. Ek kaam.", "Aaj ka ek kaam. Bas ek.", "{task}.", "Dekho"),
    _e("default", "hi", "{day}: {task_noun}. Itna hi.", "Ek task, ek din. Simple.", "{task}.", "Aaj ka task"),
    _e("default", "hi", "{name}, aaj ka hisaab chhota hai.", "Ek kaam, phir free.", "{task}. Shaam ko ek minute.", "Kar lo"),
    _e("default", "en", "Day {idx} of {total}, {name}. One thing.", "Today's one thing. Just one.", "{task}.", "See it"),
    _e("default", "en", "{day}: {task_noun}. That's it.", "One task, one day. Simple.", "{task}.", "Today's task"),
    _e("default", "en", "{name}, today's bill is small.", "One thing, then you're free.", "{task}. One minute tonight.", "Do it"),
]

RECOVERY: List[dict] = [
    _e("missed", "hi", "Kal gaya. Aaj nahi jaayega.", "Ek din miss = kuch nahi. Do din = aadat tooti.", "Aaj ka chhota version ready hai: {task}.", "Wapas aao"),
    _e("missed", "hi", "{name}, kal chhoot gaya. Theek hai. Aaj?", "Kal ka hisaab nahi. Aaj ka hai.", "2-minute version chalega. Bas aaj: {task}.", "Aaj karo"),
    _e("missed", "en", "Yesterday's gone. Today isn't.", "One miss is nothing. Two is a habit.", "The small version of today is ready: {task}.", "Come back"),
    _e("missed", "en", "{name}, yesterday slipped. Fine. Today?", "No bill for yesterday. Only for today.", "The 2-minute version counts. Just today: {task}.", "Do today"),
]

EVENING: List[dict] = [
    _e("sunday_last", "hi", "Hafte ki aakhri note. Report card adhoora.", "Sunday ki note, poore hafte ka hisaab.", "Mentor raat ko hafta padhega. Aaj ka din bhi dena.", "Note do"),
    _e("sunday_last", "en", "Last note of the week. The report needs it.", "Sunday's note closes the week.", "Your mentor reads the week tonight. Give it today too.", "Give it"),
    _e("streak_risk", "hi", "{streak} din ki streak, 11:59 pe gayab.", "1 minute mein bacha lo.", "Bas bol do aaj kaisa gaya. Itna hi.", "Streak bachao"),
    _e("streak_risk", "hi", "{streak} din ka kaam, aaj raat ka ek minute.", "Streak ko sirf ek minute chahiye.", "Note record karo, din done.", "1 minute"),
    _e("streak_risk", "en", "{streak}-day streak, gone at 11:59.", "Save it in one minute.", "Just say how today went. That's it.", "Save the streak"),
    _e("streak_risk", "en", "{streak} days of work, one minute tonight.", "The streak only needs a minute.", "Record the note, the day's done.", "One minute"),
    _e("journal", "hi", "Ek minute, {name}. Aaj kaisa gaya?", "Bolo, kal subah mentor ko kya batau?", "Done, aadha, ya kuch nahi. Sab chalega, chup nahi.", "1 minute bolo"),
    _e("journal", "hi", "Aaj ka din bina note ke so jaayega?", "Din gaya, note baaki.", "Aaj tha: {task}. Kaisa gaya, 60 second mein.", "Record karo"),
    _e("journal", "hi", "{name}, din ka last kaam. Sabse chhota.", "Bol ke so jao.", "Kal ka plan isi ek minute se banta hai.", "Bolo"),
    _e("journal", "en", "One minute, {name}. How did today go?", "Tell me — what do I tell your mentor tomorrow?", "Done, half, or not at all. All fine. Silence isn't.", "Say it in a minute"),
    _e("journal", "en", "Letting today sleep without a note?", "Day's done, note isn't.", "Today was: {task}. How it went, in 60 seconds.", "Record it"),
    _e("journal", "en", "{name}, last job of the day. The smallest.", "Say it, then sleep.", "Tomorrow's plan comes out of this one minute.", "Say it"),
]

REVIEW: List[dict] = [
    _e("quiet", "hi", "Hafta khamosh gaya. Koi lecture nahi.", "Restart, same level.", "Mentor ne kuch maana nahi, sirf note kiya.", "Restart"),
    _e("quiet", "en", "A quiet week. No lecture.", "Restart, same level.", "Your mentor assumed nothing. It just took note.", "Restart"),
    _e("review", "hi", "Report card aa gaya. Mummy ko mat dikhana 😄", "{done}/{total}. {badge}.", "{teaser}", "Report card dekho", req=("badge",)),
    _e("review", "hi", "Week {week} ka hisaab ready hai, {name}.", "{headline}", "{teaser}", "Poora dekho"),
    _e("review", "hi", "{badge}. Yeh kaise mila, andar hai.", "{headline}", "{teaser}", "Dekho kyun", req=("badge",)),
    _e("review", "en", "Report card's in. Don't show your mom 😄", "{done}/{total}. {badge}.", "{teaser}", "See the report card", req=("badge",)),
    _e("review", "en", "Week {week} is in, {name}.", "{headline}", "{teaser}", "See it all"),
    _e("review", "en", "{badge}. How you earned it is inside.", "{headline}", "{teaser}", "See why", req=("badge",)),
]

for _lib in (MORNING, RECOVERY, EVENING, REVIEW):
    _counts: dict = {}
    for _entry in _lib:
        key = (_entry["sit"], _entry["lang"])
        _counts[key] = _counts.get(key, 0) + 1
        _entry["id"] = f"{_entry['sit']}.{_entry['lang']}.{_counts[key]}"

ONE_OFFS = {"first_day", "milestone", "missed", "last_day", "quiet"}


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
    c["status_line"] = ("tum aage ho." if lang == "hi" else "you're ahead.") if past and done >= past - 1 else ("wapas aane ka din." if lang == "hi" else "today's the comeback.")
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
    order = ["quiet"] if c.get("quiet") else ["review"]
    return _pick(REVIEW, order, lang, c, recent, today_iso)
