//
//  ContentView.swift
//  OrbitalHarmony
//
import SwiftUI

struct ContentView: View {
    var body: some View {
        WebView()
            // Extends the webview under the status bar / home indicator —
            // paired with contentInsetAdjustmentBehavior = .never in
            // WebView.swift, this lets the page's own CSS
            // env(safe-area-inset-*) values (already used throughout the
            // app, e.g. `--safe-top`/`--safe-bottom`) do the actual safe
            // area spacing, matching how the app behaves in a real mobile
            // browser (viewport-fit=cover).
            .ignoresSafeArea()
            .background(Color(red: 3 / 255, green: 3 / 255, blue: 8 / 255))
            // Matches the web app's own pitch-black loading backdrop so
            // there's no visible seam while the webview finishes its
            // first paint.
            .statusBarHidden(false)
    }
}

#Preview {
    ContentView()
}
