import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// Non-secret config that still shouldn't live in git (android/secrets.properties, gitignored).
// CI passes the same keys as -P properties instead (see .github/workflows/android.yml).
val secrets = Properties().apply {
    val f = rootProject.file("secrets.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun conf(key: String, default: String = ""): String =
    (project.findProperty(key) as String?)?.takeIf { it.isNotBlank() } ?: secrets.getProperty(key, default)

android {
    namespace = "com.june64.feelivate"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.june64.feelivate"
        minSdk = 29
        targetSdk = 35
        // CI stamps every build with the run number so the phone sees each one as an update.
        versionCode = conf("versionCode", "1").toInt()
        versionName = conf("versionName", "0.1.0")
        // The production API. Override with -PapiBase=... for a local backend.
        val apiBase = conf("apiBase", "https://p01--emotion-time-travel--gtj4tlnzj5vy.code.run")
        buildConfigField("String", "API_BASE", "\"$apiBase\"")
        buildConfigField("String", "WEB_BASE", "\"https://feelivate.com\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${conf("googleWebClientId")}\"")
        // Push: Firebase is configured from these rather than a google-services.json,
        // so a checkout without Firebase values still builds — push is simply off.
        buildConfigField("String", "FIREBASE_APP_ID", "\"${conf("firebaseAppId")}\"")
        buildConfigField("String", "FIREBASE_API_KEY", "\"${conf("firebaseApiKey")}\"")
        buildConfigField("String", "FIREBASE_SENDER_ID", "\"${conf("firebaseSenderId", "980030853864")}\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"${conf("firebaseProjectId", "feelivate")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.browser:browser:1.8.0")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Continue with Google (Credential Manager + Google ID)
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // Push notifications (FCM). No google-services plugin: Firebase is
    // initialised in code from the build properties above.
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
}
