import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export interface DinnerPollOption {
  id: string;
  name: string;
  emoji: string;
  prepTime: string;
  calories: number;
  votes: { voterName: string; voterEmoji: string }[];
}

export const DINNER_POLL_STORAGE_KEY = "consuela-dinner-poll";

export const DEFAULT_POLL_OPTIONS: DinnerPollOption[] = [
  {
    id: "poll-tacos",
    name: "Taco Fiesta",
    emoji: "🌮",
    prepTime: "25 min",
    calories: 580,
    votes: [],
  },
  {
    id: "poll-pizza",
    name: "Homemade Pizza",
    emoji: "🍕",
    prepTime: "30 min",
    calories: 640,
    votes: [],
  },
  {
    id: "poll-pasta",
    name: "Creamy Pesto Pasta",
    emoji: "🍝",
    prepTime: "20 min",
    calories: 540,
    votes: [],
  },
];

/**
 * Loads the current dinner poll options from AsyncStorage.
 * Seeds default options if storage is uninitialized or empty.
 */
export async function loadDinnerPoll(): Promise<DinnerPollOption[]> {
  try {
    const raw = await AsyncStorage.getItem(DINNER_POLL_STORAGE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(DINNER_POLL_STORAGE_KEY, JSON.stringify(DEFAULT_POLL_OPTIONS));
      return DEFAULT_POLL_OPTIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as DinnerPollOption[];
    }
    return DEFAULT_POLL_OPTIONS;
  } catch {
    return DEFAULT_POLL_OPTIONS;
  }
}

/**
 * Toggles a voter's vote on an option.
 * If voterName has already voted for this option, removes the vote;
 * otherwise appends the vote.
 */
export async function toggleDinnerVote(
  optionId: string,
  voterName: string,
  voterEmoji: string
): Promise<DinnerPollOption[]> {
  try {
    const current = await loadDinnerPoll();
    const updated = current.map((opt) => {
      if (opt.id !== optionId) return opt;
      const votes = opt.votes || [];
      const hasVoted = votes.some((v) => v.voterName === voterName);
      const newVotes = hasVoted
        ? votes.filter((v) => v.voterName !== voterName)
        : [...votes, { voterName, voterEmoji: voterEmoji || "🍽️" }];
      return { ...opt, votes: newVotes };
    });
    await AsyncStorage.setItem(DINNER_POLL_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_POLL_OPTIONS;
  }
}

/**
 * Adds a new custom dinner poll option.
 */
export async function addDinnerPollOption(
  name: string,
  emoji: string = "🍲"
): Promise<DinnerPollOption[]> {
  try {
    const current = await loadDinnerPoll();
    const newOption: DinnerPollOption = {
      id: `poll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      emoji: emoji.trim() || "🍲",
      prepTime: "25 min",
      calories: 550,
      votes: [],
    };
    const updated = [...current, newOption];
    await AsyncStorage.setItem(DINNER_POLL_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_POLL_OPTIONS;
  }
}

/**
 * Resets all votes across every dinner poll option to empty.
 */
export async function resetDinnerPollVotes(): Promise<DinnerPollOption[]> {
  try {
    const current = await loadDinnerPoll();
    const updated = current.map((opt) => ({ ...opt, votes: [] }));
    await AsyncStorage.setItem(DINNER_POLL_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_POLL_OPTIONS.map((opt) => ({ ...opt, votes: [] }));
  }
}

/**
 * Computes the leading option with the highest vote count.
 * Returns null if no option has any votes.
 */
export function computePollWinner(options: DinnerPollOption[]): DinnerPollOption | null {
  if (!options || options.length === 0) return null;
  let leader: DinnerPollOption | null = null;
  let maxVotes = 0;
  for (const opt of options) {
    const count = opt.votes ? opt.votes.length : 0;
    if (count > maxVotes) {
      maxVotes = count;
      leader = opt;
    }
  }
  return maxVotes > 0 ? leader : null;
}

/**
 * Test helper to wipe storage.
 */
export async function _resetDinnerPollForTest(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DINNER_POLL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * React hook to manage live dinner poll state.
 */
export function useDinnerPoll() {
  const [options, setOptions] = useState<DinnerPollOption[]>(DEFAULT_POLL_OPTIONS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await loadDinnerPoll();
    setOptions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadDinnerPoll().then((data) => {
      if (alive) {
        setOptions(data);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggleVote = useCallback(
    async (optionId: string, voterName: string, voterEmoji: string) => {
      const updated = await toggleDinnerVote(optionId, voterName, voterEmoji);
      setOptions(updated);
      return updated;
    },
    []
  );

  const addOption = useCallback(
    async (name: string, emoji?: string) => {
      const updated = await addDinnerPollOption(name, emoji);
      setOptions(updated);
      return updated;
    },
    []
  );

  const resetVotes = useCallback(async () => {
    const updated = await resetDinnerPollVotes();
    setOptions(updated);
    return updated;
  }, []);

  const winner = computePollWinner(options);

  return {
    options,
    loading,
    refresh,
    toggleVote,
    addOption,
    resetVotes,
    winner,
  };
}
