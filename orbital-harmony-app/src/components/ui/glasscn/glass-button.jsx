"use client";;
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { Button } from "../button";
import { LiquidGlass } from "./liquid-glass";

// Monochromatic "ice-glass" tones — primary vs secondary is conveyed purely
// by light level (background brightness, specular-rim crispness, text
// opacity), no hue. We drive the differentiation through the LiquidGlass
// specular RIM (its signature refractive edge) rather than a flat CSS border,
// so the buttons keep the liquid-glass look instead of reading as flat frosted
// panels. NOTE: the app's unlayered `button { color: inherit }` reset beats
// Tailwind text-* utilities, so text colour must be applied via inline style.
const TONES = {
  primary: {
    glass: "bg-white/[0.12]",
    text: { color: "#ffffff" },
    rim: {
      "--liquid-glass-rim-width": "0.8px",
      "--liquid-glass-rim-light": "rgba(255,255,255,0.55)",
    },
  },
  secondary: {
    glass: "bg-white/[0.03]",
    text: { color: "rgba(255,255,255,0.6)" },
    rim: {
      "--liquid-glass-rim-width": "0.75px",
      "--liquid-glass-rim-light": "rgba(255,255,255,0.18)",
    },
  },
};

function GlassButton({
  className,
  tone,
  style,
  glassVariant = "liquid-refract",
  ...props
}) {
  const t = tone ? TONES[tone] : null;
  if (glassVariant === "liquid-refract") {
    return (
      <LiquidGlass className={t?.glass} style={t?.rim}>
        <Button
          data-slot="glass-button"
          data-glass-variant={glassVariant}
          className={cn(
            "text-foreground cursor-pointer bg-transparent border-0 shadow-none",
            className
          )}
          style={{ ...t?.text, ...style }}
          {...props} />
      </LiquidGlass>
    );
  }

  return (
    <Button
      data-slot="glass-button"
      data-glass-variant={glassVariant}
      className={cn(
        "text-foreground cursor-pointer",
        glassVariantStyles[glassVariant],
        className
      )}
      {...props} />
  );
}

export { GlassButton };
