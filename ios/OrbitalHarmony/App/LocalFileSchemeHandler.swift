//
//  LocalFileSchemeHandler.swift
//  OrbitalHarmony
//
//  Serves the bundled web build (see Resources/www) through a custom
//  "orbital://app/..." URL scheme instead of a plain file:// load.
//
//  Why this is needed: the web app's data layer references several assets
//  by ABSOLUTE root path (e.g. `/textures/mercury.jpg`, see
//  orbital-harmony-app/src/data/planets.js) rather than relative imports —
//  fine on a normal web server (where `/` is the site root), but a plain
//  `file://.../www/index.html` load would resolve `/textures/mercury.jpg`
//  to the actual filesystem root (`file:///textures/mercury.jpg`), which
//  doesn't exist, silently breaking every planet texture.
//
//  Serving everything under a custom scheme with origin "orbital://app"
//  instead means `/textures/mercury.jpg` resolves to
//  `orbital://app/textures/mercury.jpg` — which THIS handler maps directly
//  back to the bundled `www/textures/mercury.jpg` file, regardless of
//  whether the original reference was absolute or relative. This is the
//  same technique hybrid-app frameworks (Capacitor, Cordova, etc.) use
//  under the hood, just implemented directly for this MVP.
//
import Foundation
import WebKit

final class LocalFileSchemeHandler: NSObject, WKURLSchemeHandler {
    /// The scheme this handler is registered for for (see WebView.swift).
    static let scheme = "orbital"
    /// The fixed host used as the app's "origin" — arbitrary, just needs
    /// to stay consistent between here and the initial page load URL.
    static let host = "app"

    private let rootURL: URL

    /// - Parameter rootURL: the on-disk directory the bundled web build
    ///   was copied into (see Resources/www in project.yml).
    init(rootURL: URL) {
        self.rootURL = rootURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        // Strip the scheme+host, keep just the path (e.g.
        // "orbital://app/textures/mercury.jpg" -> "textures/mercury.jpg").
        // An empty/"/" path means the initial page load -> index.html.
        var relativePath = url.path
        if relativePath.isEmpty || relativePath == "/" {
            relativePath = "/index.html"
        }
        // Drop the leading "/" so it composes cleanly under rootURL.
        let fileURL = rootURL.appendingPathComponent(String(relativePath.dropFirst()))

        guard FileManager.default.fileExists(atPath: fileURL.path),
              let data = try? Data(contentsOf: fileURL) else {
            let response = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didFinish()
            return
        }

        let mimeType = Self.mimeType(for: fileURL.pathExtension)
        let response = URLResponse(url: url, mimeType: mimeType, expectedContentLength: data.count, textEncodingName: "utf-8")
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Nothing to cancel — file reads above are synchronous/one-shot.
    }

    private static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html"
        case "js", "mjs": return "application/javascript"
        case "css": return "text/css"
        case "json": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ico": return "image/x-icon"
        default: return "application/octet-stream"
        }
    }
}
