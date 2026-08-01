"use client";;
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

import { Button } from "../button";
import { LiquidGlass } from "./liquid-glass";

// Monochromatic "ice-glass" tones — primary vs secondary is conveyed purely
// by light level (background brightness, border crispness, text opacity), no
// hue. The LiquidGlass gradient rim is neutralised (transparent) for these
// tones so the crisp solid border reads cleanly. NOTE: the app's unlayered
// `button { color: inherit }` reset beats Tailwind text-* utilities, so text
// colour must be applied via inline style, not a className.
const TONES = {
  primary: {
    glass: "bg-white/[0.12] border border-white/40",
    text: { color: "#ffffff" },
  },
  secondary: {
    glass: "bg-white/[0.03] border border-white/15",
    text: { color: "rgba(255,255,255,0.6)" },
  },
};

const RIM_OFF = {
  "--liquid-glass-rim-light": "transparent",
  "--liquid-glass-rim-dark": "transparent",
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
      <LiquidGlass className={t?.glass} style={t ? RIM_OFF : undefined}>
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
