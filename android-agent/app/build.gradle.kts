plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.tecnopilot"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.tecnopilot"
        minSdk = 26
        targetSdk = 35
        // CI passes -PversionCode=<build number> so every published build is newer than the last.
        val build = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 1
        versionCode = build
        versionName = "1.$build"
    }

    signingConfigs {
        // A fixed key checked into the repo, so every CI build installs over the
        // previous one. It is a sideloading key, not a store key.
        create("sideload") {
            storeFile = file("sideload.jks")
            storePassword = "tecnopilot"
            keyAlias = "tecnopilot"
            keyPassword = "tecnopilot"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("sideload")
        }
        debug {
            signingConfig = signingConfigs.getByName("sideload")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += setOf(
                "META-INF/versions/**",
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE*",
                "META-INF/NOTICE*",
                "META-INF/INDEX.LIST",
                "META-INF/*.md",
            )
        }
    }
}

dependencies {
    implementation("com.anthropic:anthropic-java:2.34.0")
}
