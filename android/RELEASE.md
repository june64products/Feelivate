# Shipping the Android app

Everything in `android/` is built. What is left is account work that needs
your Google and Play logins — each item below says exactly which value to
fetch and where it goes, and nothing in the app breaks while they are missing.

---

## 1. Push notifications — two values

The code is complete on both sides. Push stays silently off until these exist.

### 1a. The app's Firebase values (so the phone can receive)

Firebase Console → **feelivate** → ⚙ Project settings → *Your apps* → the
Android app (`com.june64.feelivate`). Copy two strings:

| What it's called there | GitHub secret to create |
| --- | --- |
| App ID (`1:980030853864:android:…`) | `FIREBASE_APP_ID` *(already set — used by App Distribution)* |
| Web API Key | `FIREBASE_ANDROID_API_KEY` |

Add the secret at
`github.com/june64products/Feelivate/settings/secrets/actions`. The next cloud
build picks it up with no other change. Neither value is a credential — both
ship inside every APK — but they live in secrets so the repo carries no project
identifiers.

For a local build, put them in `android/secrets.properties` instead:

```properties
firebaseAppId=1:980030853864:android:…
firebaseApiKey=…
```

### 1b. The backend's FCM credential (so the server can send)

The scheduler authenticates to FCM with a Firebase service-account key, set on
Northflank as the secret **`FCM_SERVICE_ACCOUNT_JSON`** (the key file's
contents, raw JSON or base64 — both are accepted).

Creating that key is currently **blocked** by the june64.com organisation
policy that stopped the App Distribution key earlier
(`iam.disableServiceAccountKeyCreation`). As the org admin you can allow it for
this one project:

1. Google Cloud Console → **IAM & Admin → Organization policies**.
2. Find *Disable service account key creation*.
3. **Manage policy** → scope it to project `feelivate` → add an exception
   (Google calls it "Override parent's policy" → *Off*).
4. IAM & Admin → **Service accounts** →
   `firebase-adminsdk-fbsvc@feelivate.iam.gserviceaccount.com` → *Keys* → **Add
   key → Create new key → JSON**.
5. Paste the downloaded file's contents into Northflank as
   `FCM_SERVICE_ACCOUNT_JSON`, then redeploy.

Until step 5 the API logs `[Push] FCM_SERVICE_ACCOUNT_JSON is not set — push
notifications are off` once at startup and behaves exactly as it did before.

---

## 2. Google Sign-In — one OAuth client

`POST /auth/google/mobile` is implemented and deployed with the backend. The
remaining piece is the Android OAuth client, which is what makes Google trust
this particular APK:

Google Cloud Console → **APIs & Services → Credentials → Create credentials →
OAuth client ID → Android**:

- Package name: `com.june64.feelivate`
- SHA-1: `05:6E:A3:86:E8:67:35:D4:16:29:B2:01:4A:FD:D7:64:63:C6:98:EE`
  *(the shared debug keystore — the release keystore from §3 needs its own
  entry added the same way)*

No value from this client goes into the app: the app already sends the **web**
client ID (`GOOGLE_WEB_CLIENT_ID`), and the Android client exists only so
Google will issue a token for this package + signature.

---

## 3. The release build

`./gradlew :app:bundleRelease` produces the Play upload file. Signing is driven
by four properties — in `android/secrets.properties` locally, or as `-P` flags
in CI:

```properties
releaseStoreFile=/absolute/path/to/feelivate-upload.jks
releaseStorePassword=…
releaseKeyAlias=feelivate
releaseKeyPassword=…
```

With none of them set the release build still compiles — it just comes out
unsigned, which is enough to check that R8 hasn't broken anything.

Create the upload keystore once and **keep a backup somewhere you won't lose
it** — losing it means losing the ability to update the app:

```bash
keytool -genkeypair -v -keystore feelivate-upload.jks -alias feelivate -keyalg RSA -keysize 4096 -validity 10000
```

---

## 4. Play Console

Needs your account and the one-time $25 registration — nothing here can be
done from the repo.

**Store listing**

- App name: `Feelivate`
- Short description (80 max):
  `Your AI accountability partner: one locked 7-day plan, one task a day.`
- Full description:

  > Feelivate turns a goal you keep postponing into a plan you actually
  > follow.
  >
  > Tell it what you're trying to do. It asks the questions a good coach would,
  > then writes one 7-day plan — and locks it. No renegotiating on Wednesday
  > because Wednesday was hard. One task a day, and that's the whole ask.
  >
  > At night you leave a 60-second voice note about how the day really went.
  > Feelivate listens for what you actually said, not what you meant to say,
  > and keeps your streak honest — including the days you missed.
  >
  > When the week ends you get a review built from your own words: what moved,
  > what didn't, the pattern you couldn't see from inside it, and what next
  > week should change.
  >
  > • One locked weekly plan, one task a day
  > • Voice journalling with emotion tracking
  > • Streaks that survive a bad day, not a bad week
  > • An honest weekly review written from your own journals
  > • Your journals are yours: export or delete everything, any time
  >
  > Feelivate is not therapy and not a crisis service. If you are in danger,
  > please contact your local emergency number.

**Content rating** — answer the questionnaire honestly: no violence, no
gambling, no ads. The app does collect voice recordings and wellbeing-adjacent
text, which belongs in the Data safety form, not the rating.

**Data safety** — declare: email address, voice recordings, and
health/wellbeing text; collected and stored; used for app functionality; not
shared with third parties for advertising; encrypted in transit; deletable by
the user in-app (Profile → Delete account).

**Privacy policy URL** — `https://feelivate.com/privacy`
