import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TOKENS, ACCENTS } from "./tokens";

export type AccentName = string;
export type ThemeName = "light" | "dark";

export interface ThemeValue {
  theme: ThemeName;
  boost: boolean;
  accent: AccentName;
  /** Resolved flat color map: base theme + boost overrides + accent-selected. */
  colors: Record<string, string>;
  /** Selected accent color for the current theme (ACCENTS[theme][accent]). */
  accentColor: string;
  /** Android reduce-motion a11y setting (kills all scale/translate motion). */
  reduceMotion: boolean;
  setTheme: (t: ThemeName) => void;
  setBoost: (b: boolean) => void;
  setAccent: (a: AccentName) => void;
}

const Ctx = createContext<ThemeValue | null>(null);

const K_THEME = "consuela-theme";
const K_BOOST = "consuela-boost";
const K_ACCENT = "consuela-accent";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [theme, setThemeState] = useState<ThemeName>(system === "light" ? "light" : "dark");
  const [boost, setBoostState] = useState(false);
  const [accent, setAccentState] = useState<AccentName>("nori");
  const [reduceMotion, setReduceMotion] = useState(false);

  // Hydrate persisted device prefs (device prefs, NOT secrets — safe local state).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, b, a] = await Promise.all([
          AsyncStorage.getItem(K_THEME),
          AsyncStorage.getItem(K_BOOST),
          AsyncStorage.getItem(K_ACCENT),
        ]);
        if (!alive) return;
        if (t === "light" || t === "dark") setThemeState(t);
        if (b === "1" || b === "0") setBoostState(b === "1");
        if (a && (ACCENTS.dark[a] || ACCENTS.light[a])) setAccentState(a);
      } catch {
        // unreadable device prefs → keep defaults (honest degradation)
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Android reduce-motion accessibility setting, live.
  useEffect(() => {
    let alive = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then((v) => alive && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => setReduceMotion(!!v)
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    AsyncStorage.setItem(K_THEME, t).catch(() => {});
  };
  const setBoost = (b: boolean) => {
    setBoostState(b);
    AsyncStorage.setItem(K_BOOST, b ? "1" : "0").catch(() => {});
  };
  const setAccent = (a: AccentName) => {
    setAccentState(a);
    AsyncStorage.setItem(K_ACCENT, a).catch(() => {});
  };

  const value = useMemo<ThemeValue>(() => {
    const colors = {
      ...TOKENS[theme],
      ...(boost ? TOKENS.boost[theme] : {}),
    };
    return {
      theme,
      boost,
      accent,
      colors,
      accentColor: ACCENTS[theme][accent] ?? ACCENTS[theme].nori,
      reduceMotion,
      setTheme,
      setBoost,
      setAccent,
    };
  }, [theme, boost, accent, reduceMotion]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used within ThemeProvider");
  return v;
}
