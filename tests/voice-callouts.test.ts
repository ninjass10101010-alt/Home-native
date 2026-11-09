import {
  resolveVoiceCallout,
  VOICE_CALLOUT_KEYS,
  VOICE_CALLOUT_ASSETS,
  VOICE_CALLOUT_DESCRIPTIONS,
  playNotificationAudio,
  voiceCalloutPlayer,
} from "../src/native/voiceCallouts";
import * as soundEffects from "../src/native/soundEffects";

describe("voiceCallouts", () => {
  let playToneSpy: jest.SpyInstance;
  let playVoiceSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    playToneSpy = jest
      .spyOn(soundEffects, "playNotificationSound")
      .mockImplementation(async () => {});
    playVoiceSpy = jest
      .spyOn(voiceCalloutPlayer, "playVoiceCallout")
      .mockImplementation(async () => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    playToneSpy.mockRestore();
    playVoiceSpy.mockRestore();
  });

  describe("Asset & Description Integrity", () => {
    it("has audio assets for every declared voice call-out key", () => {
      expect(VOICE_CALLOUT_KEYS.length).toBe(18);
      for (const key of VOICE_CALLOUT_KEYS) {
        expect(VOICE_CALLOUT_ASSETS[key]).toBeDefined();
        expect(typeof VOICE_CALLOUT_ASSETS[key]).toBe("number");
        expect(VOICE_CALLOUT_DESCRIPTIONS[key]).toBeDefined();
        expect(VOICE_CALLOUT_DESCRIPTIONS[key].label).toBeTruthy();
        expect(VOICE_CALLOUT_DESCRIPTIONS[key].text).toBeTruthy();
      }
    });
  });

  describe("resolveVoiceCallout mapping", () => {
    it("resolves meal and dinner announcements", () => {
      expect(resolveVoiceCallout("general", "Dinner Time", "Dinner is ready!")).toBe("dinner_ready");
      expect(resolveVoiceCallout("general", "¡A comer!", "La cena está servida")).toBe("dinner_ready");
      expect(resolveVoiceCallout("routines", "⏰ Routine Soon", "Lunch! starts in 15 minutes.")).toBe("routine_lunch");
      expect(resolveVoiceCallout("routines", "Hora de comer", "Almuerzo para la familia")).toBe("routine_lunch");
      expect(resolveVoiceCallout("routines", "⏰ Routine Soon", "Breakfast is ready!")).toBe("routine_breakfast");
      expect(resolveVoiceCallout("routines", "Desayuno", "A desayunar en familia")).toBe("routine_breakfast");
    });

    it("resolves family schedule routines", () => {
      expect(resolveVoiceCallout("routines", "Routine", "PAPÁ gets home from work")).toBe("routine_papa");
      expect(resolveVoiceCallout("routines", "Routine", "Papa ya viene en camino")).toBe("routine_papa");
      expect(resolveVoiceCallout("routines", "Routine", "PAPA Leaving to work!!")).toBe("routine_papa_leave");
      expect(resolveVoiceCallout("routines", "Routine", "Get Kids From School")).toBe("routine_school");
      expect(resolveVoiceCallout("routines", "Routine", "Leaving for School")).toBe("routine_school_leave");
      expect(resolveVoiceCallout("routines", "Routine", "The Littles Get Ready For School")).toBe("routine_school_prep");
      expect(resolveVoiceCallout("routines", "Routine", "BIG's get ready for school")).toBe("routine_school_prep");
      expect(resolveVoiceCallout("routines", "Routine", "Take Dogs Out!")).toBe("routine_dogs");
      expect(resolveVoiceCallout("routines", "Routine", "Snack Time")).toBe("routine_snack");
      expect(resolveVoiceCallout("routines", "Routine", "MOM out of work")).toBe("routine_mom");
      expect(resolveVoiceCallout("routines", "Routine", "Rebecca Gets Home From Work")).toBe("routine_mom");
      expect(resolveVoiceCallout("routines", "Routine", "Bedtime reading and wind-down")).toBe("routine_bedtime");
      expect(resolveVoiceCallout("routines", "Daily Schedule", "Today's daily schedule summary")).toBe("routine_schedule_summary");
    });

    it("does not falsely map wake-up routines to Papa Coming Home", () => {
      expect(resolveVoiceCallout("routines", "🔔 Routine Starting", "PAPA Wake up!")).toBeNull();
      expect(resolveVoiceCallout("routines", "⏰ Routine Soon", "Papa wake up in 15 minutes")).toBeNull();
      expect(resolveVoiceCallout("routines", "Despertar", "Dad wake up")).toBeNull();
    });

    it("resolves chore and task reminders", () => {
      expect(resolveVoiceCallout("tasks", "Task Due", "Unload Dishwasher")).toBe("task_dishwasher");
      expect(resolveVoiceCallout("tasks", "Task Due", "Make your Bed")).toBe("task_bed");
      expect(resolveVoiceCallout("tasks", "Task Due", "Take out trash")).toBe("task_generic");
    });

    it("resolves calendar events and weather alerts", () => {
      expect(resolveVoiceCallout("calendar", "📅 Upcoming Event", "Soccer practice at Elm Park")).toBe("calendar_event");
      expect(resolveVoiceCallout("calendar", "🔔 Event Starting Now", "Gymnastics recital")).toBe("calendar_event");
      expect(resolveVoiceCallout("weather", "⛈️ Weather Advisory", "Thunderstorm warning")).toBe("weather_alert");
      expect(resolveVoiceCallout("general", "Clima", "Aviso importante de nieve")).toBe("weather_alert");
    });
  });

  describe("playNotificationAudio modes", () => {
    it("tone_only mode plays alert sound and does not trigger voice", async () => {
      await playNotificationAudio({
        sound: "chime",
        volume: 0.7,
        soundMode: "tone_only",
        category: "calendar",
        title: "Calendar Reminder",
        body: "Event starting",
      });

      expect(playToneSpy).toHaveBeenCalledWith("chime", 0.7);
      jest.advanceTimersByTime(2000);
      expect(playVoiceSpy).not.toHaveBeenCalled();
    });

    it("voice_only mode triggers voice call-out immediately without tone", async () => {
      await playNotificationAudio({
        sound: "bell",
        volume: 0.8,
        soundMode: "voice_only",
        category: "general",
        title: "Dinner",
        body: "Dinner is ready",
      });

      expect(playToneSpy).not.toHaveBeenCalled();
      expect(playVoiceSpy).toHaveBeenCalledWith("dinner_ready", 0.8);
    });

    it("tone_and_voice mode (default) plays tone first, then triggers voice announcement after delay", async () => {
      await playNotificationAudio({
        sound: "beacon",
        volume: 0.75,
        soundMode: "tone_and_voice",
        category: "routines",
        title: "Routine Starting",
        body: "PAPÁ gets home from work",
      });

      // Tone plays immediately so user is gently alerted
      expect(playToneSpy).toHaveBeenCalledWith("beacon", 0.75);
      expect(playVoiceSpy).not.toHaveBeenCalled();

      // Voice triggers after 750ms so family is not spooked
      jest.advanceTimersByTime(750);
      expect(playVoiceSpy).toHaveBeenCalledWith("routine_papa", 0.75);
    });

    it("debounces rapid successive notifications so voice callouts do not speak over each other", async () => {
      // First notification arrives at t=0
      await playNotificationAudio({
        sound: "beacon",
        volume: 0.75,
        soundMode: "tone_and_voice",
        category: "routines",
        title: "Routine Starting",
        body: "PAPÁ gets home from work",
      });

      // 300ms later, a second notification arrives
      jest.advanceTimersByTime(300);
      await playNotificationAudio({
        sound: "beacon",
        volume: 0.75,
        soundMode: "tone_and_voice",
        category: "general",
        title: "Dinner",
        body: "Dinner is ready",
      });

      // Advance by 500ms (total 800ms since first, but only 500ms since second)
      jest.advanceTimersByTime(500);
      // First voice callout ("routine_papa") should have been cancelled!
      expect(playVoiceSpy).not.toHaveBeenCalled();

      // Advance remaining 250ms (total 750ms since second)
      jest.advanceTimersByTime(250);
      // Second voice callout ("dinner_ready") fires cleanly
      expect(playVoiceSpy).toHaveBeenCalledTimes(1);
      expect(playVoiceSpy).toHaveBeenCalledWith("dinner_ready", 0.75);
    });

    it("plays tone without voice announcement when no specific voice matches", async () => {
      await playNotificationAudio({
        sound: "harp",
        volume: 0.7,
        soundMode: "tone_and_voice",
        category: "routines",
        title: "🔔 Routine Starting",
        body: '"PAPA Wake up!" is starting now.',
      });

      expect(playToneSpy).toHaveBeenCalledWith("harp", 0.7);
      jest.advanceTimersByTime(1500);
      expect(playVoiceSpy).not.toHaveBeenCalled();
    });
  });
});
