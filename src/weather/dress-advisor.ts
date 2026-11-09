import { AQI_META, type WeatherSnapshot } from "./data";

export interface DressAdviceItem {
  id: string;
  category: "outfit" | "outerwear" | "gear" | "play";
  title: string;
  subtitle: string;
  emoji: string;
  tone: "amber" | "mint" | "cyan" | "lavender" | "coral";
}

export interface WeatherDressSummary {
  headline: string;
  summaryLine: string;
  items: DressAdviceItem[];
}

const WET_WMO_CODES = [51, 53, 55, 61, 63, 65, 66, 67, 71, 73, 75, 80, 81, 82, 85, 86, 95, 96, 99];

/**
 * Computes kid-friendly dress and gear advice from a weather snapshot.
 * Evaluates temperature/feels-like for outfit/outerwear, precipitation & UV
 * for gear, and air quality & wind for outdoor play.
 */
export function computeWeatherDressAdvice(data: WeatherSnapshot): WeatherDressSummary {
  const temp = data.feelsLikeF ?? data.tempF ?? data.highF ?? 65;

  // 1. Outfit / Outerwear rule
  let outfit: DressAdviceItem;
  if (temp <= 38) {
    outfit = {
      id: "heavy-coat",
      category: "outerwear",
      title: "Heavy Winter Coat & Hat",
      subtitle: "Bundle up warm — gloves & winter boots",
      emoji: "🧥",
      tone: "cyan",
    };
  } else if (temp <= 58) {
    outfit = {
      id: "hoodie-jacket",
      category: "outerwear",
      title: "Hoodie or Light Jacket",
      subtitle: "Great for layering this morning",
      emoji: "🧥",
      tone: "lavender",
    };
  } else if (temp <= 75) {
    outfit = {
      id: "comfy-layers",
      category: "outfit",
      title: "T-Shirt & Comfy Pants",
      subtitle: "Mild & comfortable all day",
      emoji: "👕",
      tone: "mint",
    };
  } else {
    outfit = {
      id: "warm-weather",
      category: "outfit",
      title: "Shorts & Breathable Tee",
      subtitle: "Warm day — pack extra cold water",
      emoji: "🩳",
      tone: "amber",
    };
  }

  // 2. Rain / Snow / Sun Gear rule
  const isWet = (data.precipTodayPct ?? 0) >= 40 || WET_WMO_CODES.includes(data.code ?? -1);
  let gear: DressAdviceItem;
  if (isWet) {
    const pct = data.precipTodayPct ?? 50;
    gear = {
      id: "rain-gear",
      category: "gear",
      title: "Pack Umbrella & Rain Boots",
      subtitle: `${pct}% chance of precipitation`,
      emoji: "☂️",
      tone: "cyan",
    };
  } else if ((data.uvIndex ?? 0) >= 5) {
    gear = {
      id: "sun-gear",
      category: "gear",
      title: "Sunglasses & Sunscreen",
      subtitle: `UV index ${data.uvIndex} — bright sun today`,
      emoji: "🕶️",
      tone: "amber",
    };
  } else {
    gear = {
      id: "shoes-ready",
      category: "gear",
      title: "Sneakers Ready",
      subtitle: "Dry skies for walking & recess",
      emoji: "👟",
      tone: "mint",
    };
  }

  // 3. Outdoor Play / Wind / Air rule
  let play: DressAdviceItem;
  if (
    data.air &&
    (data.air.category === "unhealthy" ||
      data.air.category === "veryUnhealthy" ||
      data.air.category === "hazardous")
  ) {
    const airLabel =
      (data.air as { label?: string }).label ??
      AQI_META[data.air.category]?.label ??
      data.air.category;
    play = {
      id: "indoor-play",
      category: "play",
      title: "Indoor Play Day",
      subtitle: `Air quality is ${airLabel.toLowerCase()}`,
      emoji: "🏠",
      tone: "coral",
    };
  } else if ((data.windMph ?? 0) >= 20) {
    play = {
      id: "windy-play",
      category: "play",
      title: "Breezy Outside",
      subtitle: `${data.windMph} mph wind — hold onto hats!`,
      emoji: "💨",
      tone: "amber",
    };
  } else {
    play = {
      id: "outdoor-play",
      category: "play",
      title: "Great for Recess & Park",
      subtitle: "Conditions look wonderful outside",
      emoji: "🛝",
      tone: "mint",
    };
  }

  // Derived headline and summary line
  let headline = "Comfortable & Mild";
  let summaryLine = "Mild temperatures for regular clothes and outdoor adventures.";

  if (temp <= 38) {
    headline = "Bundle Up Warm";
    summaryLine = "Freezing temperatures — dress in cozy layers and heavy outerwear.";
  } else if (temp <= 58) {
    headline = "Cool & Crisp";
    summaryLine = "Chilly morning — grab a hoodie or light jacket before heading out.";
  } else if (temp > 75) {
    headline = "Warm Day Ahead";
    summaryLine = "Sunny and warm — light clothes, cool drinks, and sun protection.";
  }

  return {
    headline,
    summaryLine,
    items: [outfit, gear, play],
  };
}
