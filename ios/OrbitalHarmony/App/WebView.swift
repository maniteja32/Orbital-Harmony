//
//  WebView.swift
//  OrbitalHarmony
//
//  SwiftUI wrapper around a WKWebView that loads the bundled Orbital
//  Harmony web build (see Resources/www) through the custom "orbital://"
//  scheme handled by LocalFileSchemeHandler.
//
import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()

        guard let wwwRoot = Bundle.main.url(forResource: "www", withExtension: nil) else {
            fatalError("Bundled web build not found — expected a 'www' folder in the app bundle. Did you run the build script / copy dist into ios/OrbitalHarmony/Resources/www before generating the Xcode project? See ios/README.md.")
        }
        configuration.setURLSchemeHandler(
            LocalFileSchemeHandler(rootURL: wwwRoot),
            forURLScheme: LocalFileSchemeHandler.scheme
        )

        // The app is a WebGL-heavy, animation-driven single-page canvas
        // experience with no video/audio playback of its own — no special
        // media playback config needed beyond the defaults.
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        // Matches the web app's own --bg (#030308) so there's no white
        // flash before the page's own background paints.
        webView.backgroundColor = UIColor(red: 3 / 255, green: 3 / 255, blue: 8 / 255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        // The app is a fixed, non-scrolling full-viewport layout (see
        // `body { overflow: hidden }` in index.css) — disable the WKWebView
        // scroll view's own bounce/scroll so there's no rubber-banding
        // around the fixed app shell.
        webView.scrollView.bounces = false
        webView.scrollView.isScrollEnabled = false
        // Let the page's own CSS `env(safe-area-inset-*)` values (already
        // used throughout the app's CSS for notch/home-indicator spacing)
        // be computed against the FULL screen bounds rather than having
        // UIKit's automatic content-inset adjustment double-apply insets —
        // paired with .ignoresSafeArea() on the SwiftUI side (ContentView).
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator

        let initialURL = URL(string: "\(LocalFileSchemeHandler.scheme)://\(LocalFileSchemeHandler.host)/index.html")!
        webView.load(URLRequest(url: initialURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Static single-page app — nothing to push down from SwiftUI state.
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    /// Opens real external links (e.g. a future "Learn more" link) in
    /// Safari instead of navigating away inside the app's own webview —
    /// the bundled app itself never navigates elsewhere, this is just a
    /// safety net for any external `<a href="https://...">` added later.
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            if url.scheme == "http" || url.scheme == "https" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
