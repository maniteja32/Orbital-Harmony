//
//  LiquidGlassButtonExamples.swift
//  OrbitalHarmony
//
//  Ready-made showcase of `LiquidGlassButton` in the four flavors this app
//  actually needs — Play, Restart, Rocket, Simulation — deliberately
//  mirroring the web app's own Simulation-screen icon row (play/pause,
//  reset, speed step, and a primary "run" action; see
//  orbital-harmony-app/src/screens/SimulationScreen.jsx). Not wired into
//  the live `ContentView`/`WebView` shell, since this app is a thin
//  WKWebView wrapper around that web UI — this view is a standalone,
//  runnable reference for any future native screen that wants these
//  controls, and doubles as a manual test bed for every interaction state
//  (press, active, hover-on-pointer-devices) at once.
//
import SwiftUI

struct LiquidGlassButtonExamples: View {
    @State private var isPlaying = false
    @State private var speedIndex = 0
    @State private var launchPulse = false
    @State private var restartSpinDegrees = 0.0

    private let speeds = ["1×", "2×", "5×", "10×"]

    var body: some View {
        ZStack {
            backdrop

            VStack(spacing: 40) {
                header

                HStack(spacing: 28) {
                    labeledButton("Play") {
                        LiquidGlassButton(
                            systemImage: isPlaying ? "pause.fill" : "play.fill",
                            label: isPlaying ? "Pause simulation" : "Play simulation",
                            size: 72,
                            tint: Color(red: 0.62, green: 0.86, blue: 0.72),
                            isActive: isPlaying
                        ) {
                            withAnimation(.easeOut(duration: 0.2)) { isPlaying.toggle() }
                        }
                    }

                    labeledButton("Restart") {
                        LiquidGlassButton(
                            systemImage: "arrow.counterclockwise",
                            label: "Restart simulation",
                            size: 72,
                            tint: Color(red: 0.85, green: 0.85, blue: 0.92)
                        ) {
                            withAnimation(.spring(response: 0.5, dampingFraction: 0.55)) {
                                restartSpinDegrees += 360
                            }
                        }
                        .rotationEffect(.degrees(restartSpinDegrees))
                    }
                }

                HStack(spacing: 28) {
                    labeledButton("Rocket") {
                        LiquidGlassButton(
                            systemImage: "rocket.fill",
                            label: "Simulation speed \(speeds[speedIndex]), tap to change",
                            size: 72,
                            tint: Color(red: 1.0, green: 0.68, blue: 0.48),
                            isActive: speedIndex > 0
                        ) {
                            withAnimation(.easeOut(duration: 0.2)) {
                                speedIndex = (speedIndex + 1) % speeds.count
                            }
                        }
                        .overlay(alignment: .topTrailing) {
                            Text(speeds[speedIndex])
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.black.opacity(0.55), in: Capsule())
                                .offset(x: 10, y: -6)
                        }
                    }

                    labeledButton("Simulation") {
                        LiquidGlassButton(
                            systemImage: "atom",
                            label: "Generate pattern",
                            size: 72,
                            tint: Color(red: 0.55, green: 0.6, blue: 1.0)
                        ) {
                            withAnimation(.spring(response: 0.4, dampingFraction: 0.5)) {
                                launchPulse.toggle()
                            }
                        }
                        .scaleEffect(launchPulse ? 1.06 : 1.0)
                    }
                }
            }
            .padding(32)
        }
    }

    private var header: some View {
        VStack(spacing: 6) {
            Text("Liquid Glass Controls")
                .font(.system(.title2, design: .rounded).weight(.bold))
                .foregroundStyle(.white)
            Text("Tap any button — press, active, and glow states are all live.")
                .font(.system(.footnote, design: .rounded))
                .foregroundStyle(.white.opacity(0.55))
                .multilineTextAlignment(.center)
        }
    }

    private func labeledButton(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(spacing: 12) {
            content()
            Text(title)
                .font(.system(.caption, design: .rounded).weight(.semibold))
                .foregroundStyle(.white.opacity(0.6))
        }
    }

    /// Same pitch-black-with-a-hint-of-violet backdrop as the web app
    /// (`--bg: #030308`, a soft accent-tinted radial glow) so this preview
    /// reads as part of the same product rather than a generic iOS demo.
    private var backdrop: some View {
        ZStack {
            Color(red: 3 / 255, green: 3 / 255, blue: 8 / 255)
            RadialGradient(
                colors: [Color(red: 0.35, green: 0.36, blue: 0.6).opacity(0.35), .clear],
                center: .center,
                startRadius: 10,
                endRadius: 420
            )
        }
        .ignoresSafeArea()
    }
}

#Preview {
    LiquidGlassButtonExamples()
}
