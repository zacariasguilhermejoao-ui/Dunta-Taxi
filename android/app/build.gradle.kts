plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android { namespace = "com.dunta.taxi"; compileSdk = 35
    defaultConfig { applicationId = "com.dunta.taxi"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "1.0.0" }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

// The complete web interface lives at the repository root. Copy it into the APK
// on every build so the interface is available even with no mobile data/Wi-Fi.
val syncWebAssets by tasks.registering(Copy::class) {
    val webRoot = rootProject.projectDir.parentFile
    from(webRoot) {
        include("index.html")
        include("manifest.webmanifest")
        include("sw.js")
        include("apple-touch-icon.png")
        include("icon-192.png")
        include("icon-512.png")
    }
    into(layout.projectDirectory.dir("src/main/assets"))
}

tasks.named("preBuild") { dependsOn(syncWebAssets) }

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
