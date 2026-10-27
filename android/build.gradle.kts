// Feelivate — native Android client (Kotlin + Jetpack Compose).
// Talks to the same FastAPI backend as the web app; see app/src/main/java/com/june64/feelivate/data.
plugins {
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.1.10" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.10" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.10" apply false
}
