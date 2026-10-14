// Home-native/src/weather/conditions.ts
import type { ConditionCode } from "./language";

/** WMO weather_code → ConditionCode. Bands mirror Home-ai weather-live.ts WMO
 *  map + the WxToys Condition icon set; a missing code is a neutral cloud —
 *  art defaults are not fabricated data. */
export function conditionCode(wmo: number | undefined, isDay: boolean): ConditionCode {
  if (wmo == null) return "cloudy";
  if (wmo <= 1) return isDay ? "clear" : "night";
  if (wmo === 2) return isDay ? "partly" : "partly-night";
  if (wmo === 3) return "cloudy";
  if (wmo === 45 || wmo === 48) return "fog";
  if (wmo >= 95) return "storm";
  if ((wmo >= 71 && wmo <= 77) || wmo === 85 || wmo === 86) return "snow";
  return "rain"; // 51-67 drizzle/rain + 80-82 showers
}
