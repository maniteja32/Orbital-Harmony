//
//  OrbitalHarmonyApp.swift
//  OrbitalHarmony
//
//  MVP native iOS wrapper for the Orbital Harmony web app (see
//  ../orbital-harmony-app) — a WKWebView-based shell that loads the
//  bundled production build locally (see WebView.swift /
//  LocalFileSchemeHandler.swift), so the existing React + Three.js
//  experience runs as a real installable iOS app with no network
//  dependency for its core assets (fonts are the one exception — see
//  README "Known limitations").
//
import SwiftUI

@main
struct OrbitalHarmonyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
