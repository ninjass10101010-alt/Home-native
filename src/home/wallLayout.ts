import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ALL_WIDGETS,
  WALL_CONFIGURABLE_WIDGETS,
  WALL_DEFAULT_HIDDEN_WIDGETS,
  WALL_LOCKED_HIDDEN_WIDGETS,
  WALL_SHAPES,
  WALL_SPANS,
  shapeCells,
  visibleOnWall,
  wallPlacements,
  type WallShape,
  type WidgetId,
  type WallSpan,
} from "./widgets";

export const WALL_LAYOUT_STORAGE_KEY = "consuela-wall-layout";
export const WALL_LAYOUT_VERSION = 3;
export const WALL_CELLS = 12;

export interface WallLayout {
  version: number;
  spans: Partial<Record<WidgetId, WallSpan>>;
  shapes?: Partial<Record<WidgetId, WallShape>>;
  hidden: WidgetId[];
  autoArrange?: boolean;
}

const ALL_IDS = new Set<WidgetId>(ALL_WIDGETS.map((widget) => widget.id));
const CONFIGURABLE_IDS = new Set<WidgetId>(WALL_CONFIGURABLE_WIDGETS);

function defaultShapes(): Partial<Record<WidgetId, WallShape>> {
  const shapes: Partial<Record<WidgetId, WallShape>> = {};
  for (const id of WALL_CONFIGURABLE_WIDGETS) {
    const shape = WALL_SHAPES[id];
    if (shape) shapes[id] = shape;
  }
  return shapes;
}

function defaultSpans(): Partial<Record<WidgetId, WallSpan>> {
  const spans: Partial<Record<WidgetId, WallSpan>> = {};
  for (const id of WALL_CONFIGURABLE_WIDGETS) {
    const span = WALL_SPANS[id];
    if (span) spans[id] = span;
  }
  return spans;
}

function cloneDefaultLayout(): WallLayout {
  return {
    version: WALL_LAYOUT_VERSION,
    spans: defaultSpans(),
    shapes: defaultShapes(),
    hidden: [...WALL_DEFAULT_HIDDEN_WIDGETS],
  };
}

export const DEFAULT_WALL_LAYOUT: WallLayout = cloneDefaultLayout();

/** Full 12/12 Smart Home preset: swaps Daily Schedule out for Home Climate + Home Lights. */
export const SMART_HOME_WALL_LAYOUT: WallLayout = {
  version: WALL_LAYOUT_VERSION,
  spans: {
    photos: 2,
    weather: 2,
    music: 2,
  },
  shapes: {
    photos: "1x2",
    weather: "1x2",
    music: "2x1",
  },
  hidden: ["schedule", "morningBriefing", "homeSecurity"],
};

export function layoutWidgets(layout: WallLayout): WidgetId[] {
  const hidden = new Set<WidgetId>([
    ...layout.hidden,
    ...WALL_LOCKED_HIDDEN_WIDGETS,
  ]);
  return WALL_CONFIGURABLE_WIDGETS.filter((id) => !hidden.has(id));
}

export function layoutShape(layout: WallLayout, id: WidgetId): WallShape {
  const explicitShape = layout.shapes?.[id];
  if (explicitShape === "1x1" || explicitShape === "1x2" || explicitShape === "2x1") {
    return explicitShape;
  }
  const explicitSpan = layout.spans[id];
  if (explicitSpan === 1) return "1x1";
  if (explicitSpan === 2) return WALL_SHAPES[id] ?? "1x2";
  return WALL_SHAPES[id] ?? "1x1";
}

export function layoutSpan(layout: WallLayout, id: WidgetId): WallSpan {
  return shapeCells(layoutShape(layout, id));
}

export function layoutCells(layout: WallLayout): { used: number; free: number } {
  const used = layoutWidgets(layout).reduce(
    (total, id) => total + layoutSpan(layout, id),
    0,
  );
  return { used, free: Math.max(0, WALL_CELLS - used) };
}

export function layoutFits(layout: WallLayout): boolean {
  if (layoutCells(layout).used > WALL_CELLS) return false;
  const visibleDefs = visibleOnWall([
    ...layout.hidden,
    ...WALL_LOCKED_HIDDEN_WIDGETS,
  ]);
  const shapes: Partial<Record<WidgetId, WallShape>> = {};
  for (const def of visibleDefs) {
    shapes[def.id] = layoutShape(layout, def.id);
  }
  return wallPlacements(visibleDefs, shapes, { strict: true }).fitsAll;
}

function repairLayout(raw: unknown): WallLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as {
    version?: unknown;
    spans?: unknown;
    shapes?: unknown;
    hidden?: unknown;
  };
  if (candidate.version !== WALL_LAYOUT_VERSION) return null;

  const spans: Partial<Record<WidgetId, WallSpan>> = {};
  if (candidate.spans && typeof candidate.spans === "object") {
    const rawSpans = candidate.spans as Record<string, unknown>;
    for (const [id, span] of Object.entries(rawSpans)) {
      if (!ALL_IDS.has(id as WidgetId)) continue;
      if (span !== 1 && span !== 2) continue;
      spans[id as WidgetId] = span;
    }
  }

  const shapes: Partial<Record<WidgetId, WallShape>> = {};
  if (candidate.shapes && typeof candidate.shapes === "object") {
    const rawShapes = candidate.shapes as Record<string, unknown>;
    for (const [id, shape] of Object.entries(rawShapes)) {
      if (!ALL_IDS.has(id as WidgetId)) continue;
      if (shape !== "1x1" && shape !== "1x2" && shape !== "2x1") continue;
      shapes[id as WidgetId] = shape;
      spans[id as WidgetId] = shapeCells(shape);
    }
  } else {
    for (const [id, span] of Object.entries(spans) as [WidgetId, WallSpan][]) {
      shapes[id] = span === 1 ? "1x1" : (WALL_SHAPES[id] ?? "1x2");
    }
  }

  const hiddenIds = new Set<WidgetId>();
  if (Array.isArray(candidate.hidden)) {
    for (const id of candidate.hidden) {
      if (typeof id !== "string") continue;
      if (!CONFIGURABLE_IDS.has(id as WidgetId)) continue;
      hiddenIds.add(id as WidgetId);
    }
  }

  const hasAutoArrange = typeof (candidate as { autoArrange?: unknown }).autoArrange === "boolean";
  const autoArrange = hasAutoArrange ? (candidate as { autoArrange: boolean }).autoArrange : undefined;

  const layout: WallLayout = {
    version: WALL_LAYOUT_VERSION,
    spans,
    ...(Object.keys(shapes).length > 0 ? { shapes } : {}),
    hidden: WALL_CONFIGURABLE_WIDGETS.filter((id) => hiddenIds.has(id)),
    ...(hasAutoArrange ? { autoArrange } : {}),
  };
  return layoutFits(layout) ? layout : null;
}

export function normalizeWallLayout(raw: unknown): WallLayout {
  return repairLayout(raw) ?? cloneDefaultLayout();
}

function persistLayout(layout: WallLayout): void {
  void AsyncStorage.setItem(
    WALL_LAYOUT_STORAGE_KEY,
    JSON.stringify(layout),
  ).catch(() => {});
}

let memoryCachedLayout: WallLayout | null = null;

export function _resetWallLayoutMemoryForTest(): void {
  memoryCachedLayout = null;
}

export function resetWallLayout(): WallLayout {
  const layout = cloneDefaultLayout();
  memoryCachedLayout = layout;
  persistLayout(layout);
  return layout;
}

export function useWallLayout() {
  const [layout, setLayoutState] = useState<WallLayout>(
    () => memoryCachedLayout ?? cloneDefaultLayout(),
  );

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(WALL_LAYOUT_STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        let parsed: unknown = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = null;
        }
        const normalized = normalizeWallLayout(parsed);
        memoryCachedLayout = normalized;
        setLayoutState((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev;
          return normalized;
        });
        const serialized = JSON.stringify(normalized);
        if (raw !== serialized) persistLayout(normalized);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = cloneDefaultLayout();
        memoryCachedLayout = fallback;
        setLayoutState((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(fallback)) return prev;
          return fallback;
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLayout = useCallback((next: WallLayout): boolean => {
    const repaired = repairLayout(next);
    if (!repaired) return false;
    memoryCachedLayout = repaired;
    setLayoutState(repaired);
    persistLayout(repaired);
    return true;
  }, []);

  const reset = useCallback(() => {
    setLayoutState(resetWallLayout());
  }, []);

  return useMemo(
    () => ({ layout, setLayout, reset }),
    [layout, reset, setLayout],
  );
}
