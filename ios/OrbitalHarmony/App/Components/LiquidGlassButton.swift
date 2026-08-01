//
//  LiquidGlassButton.swift
//  OrbitalHarmony
//
//  A reusable, circular "Liquid Glass" control inspired by Apple's Liquid
//  Glass design language (WWDC 2025). Everything here is built from
//  standard, public SwiftUI materials/gradients/shadows/Canvas — no private
//  APIs and no dependency on the real `.glassEffect()` modifier (iOS 26+),
//  so it renders correctly all the way back to this app's iOS 16
//  deployment target while still reading as "real glass".
//
//  Layer stack (back to front), everything clipped to one perfect circle:
//    1. `.ultraThinMaterial` base — native background blur, the actual
//       frosted-glass "see-through" effect.
//    2. A faint tinted gradient wash blended with `.overlay` — lets the
//       button pick up a subtle brand color without losing translucency.
//    3. A soft top-left radial "inner highlight" — simulates light hitting
//       the inside of a curved glass dome.
//    4. A rim highlight — an angular gradient stroke, brightest where the
//       simulated light source grazes the curved edge, fading elsewhere.
//    5. A `Canvas`-drawn chromatic-dispersion fringe — three faint,
//       slightly-offset red/green/blue arcs along that same edge (real
//       glass/prism edges split light exactly like this).
//    6. The SF Symbol icon, centered, with its own subtle gradient + drop
//       shadow so it reads as sitting in front of the glass.
//  ...plus an ambient tint-colored glow shadow and a grounded black
//  "floating" shadow underneath the whole disc, both of which intensify on
//  press/active state.
//
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// MARK: - LiquidGlassButton

/// A perfectly circular, frosted-glass button — the shared building block
/// for every icon-only control in the app (play/pause, restart, simulation
/// speed, etc.). Sizing, tint, and active/pressed appearance are all
/// dynamic. See `LiquidGlassButtonExamples.swift` for ready-made Play /
/// Restart / Rocket / Simulation variants.
struct LiquidGlassButton: View {
    /// SF Symbol name rendered centered inside the glass disc.
    let systemImage: String
    /// Accessible name announced by VoiceOver. Falls back to `systemImage`
    /// when omitted — always pass a real label for shipped UI.
    var label: String? = nil
    /// Diameter of the circular button, in points. Defaults to a
    /// comfortable 64pt tap target; scales every internal layer (icon
    /// size, stroke widths, glow radii) proportionally.
    var size: CGFloat = 64
    /// Tint mixed into the glass wash, rim, and ambient glow — gives each
    /// button its own "flavor" while staying translucent. Defaults to the
    /// app's own near-white accent (`--accent` in the web app's CSS).
    var tint: Color = LiquidGlassButton.defaultTint
    /// Renders a brighter rim + stronger resting glow for a
    /// currently-selected/active control (e.g. "Play" while playing, or
    /// the current simulation-speed step) — persists independently of the
    /// momentary press state.
    var isActive: Bool = false
    let action: () -> Void

    static let defaultTint = Color(red: 234 / 255, green: 230 / 255, blue: 255 / 255)

    var body: some View {
        Button(action: triggerAction) {
            Image(systemName: systemImage)
        }
        .buttonStyle(LiquidGlassButtonStyle(size: size, tint: tint, isActive: isActive))
        .accessibilityLabel(label ?? systemImage)
    }

    private func triggerAction() {
        // A light haptic tick on every tap — small, but it's a big part of
        // why Apple's own glass controls feel "physical" rather than flat.
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        action()
    }
}

// MARK: - ButtonStyle

/// Drives the whole glass look plus the press/hover animation. Split out as
/// a `ButtonStyle` (rather than baked directly into `LiquidGlassButton`'s
/// own body) so `configuration.isPressed` — the correct, gesture-driven
/// source of truth for "is this button currently being pressed" — is
/// available for free, with no manual `DragGesture`/`onLongPressGesture`
/// bookkeeping.
private struct LiquidGlassButtonStyle: ButtonStyle {
    let size: CGFloat
    let tint: Color
    let isActive: Bool

    func makeBody(configuration: Configuration) -> some View {
        LiquidGlassButtonBody(configuration: configuration, size: size, tint: tint, isActive: isActive)
    }
}

/// The actual rendered glass disc. A separate `View` (rather than living
/// directly in `makeBody`) purely so it can hold its own `@State` for hover
/// tracking — `ButtonStyle` itself can't carry `@State`.
private struct LiquidGlassButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let size: CGFloat
    let tint: Color
    let isActive: Bool

    @State private var isHovering = false

    private var isPressed: Bool { configuration.isPressed }
    /// "Lit" = either being pressed right now, or persistently active —
    /// both cases get the brighter glass/rim/glow treatment.
    private var isLit: Bool { isPressed || isActive }

    var body: some View {
        ZStack {
            glassBase
            innerHighlight
            rimHighlight
            chromaticEdge
            icon
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .contentShape(Circle())
        .compositingGroup()
        // Grounded "floating" shadow — lifts the disc off the background;
        // sits and tightens slightly on press, as if settling under a
        // fingertip.
        .shadow(color: .black.opacity(isPressed ? 0.22 : 0.32), radius: isPressed ? 8 : 16, x: 0, y: isPressed ? 3 : 9)
        // Soft ambient glow in the button's own tint — the "soft glow
        // increase when pressed" spec, also used for the persistent
        // active state.
        .shadow(color: tint.opacity(isLit ? 0.55 : 0.22), radius: isLit ? 20 : 10, x: 0, y: 0)
        .scaleEffect(isPressed ? 0.90 : (isHovering ? 1.04 : 1.0))
        .animation(.spring(response: 0.32, dampingFraction: 0.55), value: isPressed)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovering)
        .animation(.easeOut(duration: 0.2), value: isActive)
        // Mostly relevant on iPad/trackpad+mouse (pointer interactions) or
        // Apple Pencil hover — a no-op tap-only iPhone still gets the rest
        // of the glass effect untouched, this is purely additive.
        .onHover { hovering in isHovering = hovering }
    }

    // MARK: Layers

    /// Base frosted material + a faint tinted wash, darkened slightly on
    /// press so the glass reads as "denser"/pushed-in rather than just
    /// smaller.
    private var glassBase: some View {
        ZStack {
            Circle().fill(.ultraThinMaterial)
            Circle()
                .fill(
                    LinearGradient(
                        colors: [tint.opacity(isLit ? 0.34 : 0.20), tint.opacity(0.04)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .blendMode(.overlay)
            Circle()
                .fill(Color.black.opacity(isPressed ? 0.16 : 0.05))
        }
    }

    /// Soft top-left radial highlight — the "light hitting curved glass"
    /// look; the single biggest contributor to the realistic-glass feel.
    private var innerHighlight: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [Color.white.opacity(isLit ? 0.65 : 0.5), Color.white.opacity(0)],
                    center: UnitPoint(x: 0.30, y: 0.24),
                    startRadius: 0,
                    endRadius: size * 0.62
                )
            )
            .blendMode(.plusLighter)
    }

    /// Thin bright rim — an angular gradient stroke, brightest where the
    /// simulated light source (top-left) grazes the curved edge, fading to
    /// near-invisible at the bottom before catching a second, dimmer
    /// highlight opposite it (secondary/ambient bounce light).
    private var rimHighlight: some View {
        Circle()
            .strokeBorder(
                AngularGradient(
                    colors: [
                        Color.white.opacity(0.05),
                        Color.white.opacity(isLit ? 1.0 : 0.85),
                        Color.white.opacity(0.35),
                        Color.white.opacity(0.05),
                        Color.white.opacity(0.05),
                        Color.white.opacity(0.4),
                    ],
                    center: .center,
                    startAngle: .degrees(200),
                    endAngle: .degrees(560)
                ),
                lineWidth: isPressed ? 1.6 : 1.1
            )
    }

    /// A faint prism-like fringe along that same highlighted edge — three
    /// near-transparent red/green/blue arcs, each nudged a fraction of a
    /// point apart, blended additively. Drawn with `Canvas` (instead of
    /// three stacked `Circle` strokes) so the sub-pixel offsets are exact,
    /// cheap, single-pass draws rather than three extra composited views.
    private var chromaticEdge: some View {
        Canvas { context, canvasSize in
            let rect = CGRect(origin: .zero, size: canvasSize)
            let lineWidth: CGFloat = 1.3
            let radius = min(rect.width, rect.height) / 2 - lineWidth
            let fringes: [(Color, CGPoint)] = [
                (.red.opacity(0.5), CGPoint(x: -0.55, y: -0.35)),
                (.green.opacity(0.35), CGPoint(x: 0, y: 0)),
                (.blue.opacity(0.55), CGPoint(x: 0.55, y: 0.35)),
            ]
            context.blendMode = .plusLighter
            for (color, offset) in fringes {
                var path = Path()
                path.addArc(
                    center: CGPoint(x: rect.midX + offset.x, y: rect.midY + offset.y),
                    radius: radius,
                    startAngle: .degrees(205),
                    endAngle: .degrees(325),
                    clockwise: false
                )
                context.stroke(path, with: .color(color), lineWidth: lineWidth)
            }
        }
        .allowsHitTesting(false)
    }

    /// The SF Symbol, centered, with a slight vertical gradient + hairline
    /// drop shadow so it reads as a solid object sitting in front of the
    /// glass rather than flat-printed on it.
    private var icon: some View {
        configuration.label
            .font(.system(size: size * 0.38, weight: .semibold))
            .foregroundStyle(
                LinearGradient(colors: [.white, .white.opacity(0.8)], startPoint: .top, endPoint: .bottom)
            )
            .shadow(color: .black.opacity(0.3), radius: 1.5, x: 0, y: 1)
            .scaleEffect(isPressed ? 0.92 : 1.0)
    }
}

// MARK: - Preview

#Preview("Sizes & tints") {
    ZStack {
        Color(red: 3 / 255, green: 3 / 255, blue: 8 / 255).ignoresSafeArea()
        HStack(spacing: 24) {
            LiquidGlassButton(systemImage: "play.fill", label: "Play", size: 44) {}
            LiquidGlassButton(systemImage: "play.fill", label: "Play", size: 64, isActive: true) {}
            LiquidGlassButton(
                systemImage: "heart.fill",
                label: "Favorite",
                size: 88,
                tint: Color(red: 1.0, green: 0.55, blue: 0.65)
            ) {}
        }
    }
}
