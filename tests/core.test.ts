import { describe, it, expect, afterEach } from "vitest";
import Dexie from "dexie";
import { initialState } from "../src/seed";
import {
  newSession,
  ready,
  nextWeight,
  uid,
  displayWeight,
  toKg,
} from "../src/model";
import { RepDB, validateState } from "../src/db";
import { makeBackup, parseBackup, mergeBackup } from "../src/backup";
const databases: RepDB[] = [];
const makeDB = () => {
  const db = new RepDB(`test-${uid()}`);
  databases.push(db);
  return db;
};
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
describe("initial notes and routines", () => {
  it("preserves all 19 exercises and exact initial weights", () => {
    const s = initialState();
    expect(s.exercises).toHaveLength(19);
    expect(s.templates.map((x) => x.exerciseIds.length)).toEqual([6, 5, 6]);
    expect(s.exercises.map((e) => e.weight)).toEqual([
      5,
      7.5,
      39,
      27,
      10,
      22.5,
      null,
      42.4,
      41,
      52,
      7.5,
      8,
      47.3,
      73,
      66,
      52,
      45,
      43.2,
      41,
    ]);
    expect(s.sessions).toEqual([]);
    expect(s.exercises.find((e) => e.id === "incline")!.name).toBe(
      "Incline Dumbbell Press (bar)",
    );
    expect(s.exercises.every((e) => !e.legacy || e.legacy.date === null)).toBe(
      true,
    );
  });
  it("does not count suggested reps as logged or progression", () => {
    const s = initialState();
    const w = newSession(s.templates[0], s.exercises);
    expect(w.exercises[0].sets.every((s) => !s.done)).toBe(true);
    expect(ready(w.exercises[0])).toBe(false);
  });
  it("unit switching is a display conversion, preserving source weights", () => {
    expect(toKg(Number(displayWeight(39, "lb")), "lb")).toBeCloseTo(39, 2);
  });
});
describe("double progression", () => {
  const exercise = () => {
    const s = initialState();
    const e = newSession(s.templates[0], s.exercises).exercises[0];
    e.sets.forEach((s) => {
      s.done = true;
    });
    return e;
  };
  it("requires all prescribed completed sets at upper target", () => {
    const e = exercise();
    expect(ready(e)).toBe(true);
    e.sets[1].reps = 11;
    expect(ready(e)).toBe(false);
    e.sets[1].reps = 12;
    e.sets[1].done = false;
    expect(ready(e)).toBe(false);
  });
  it("never promotes missing sets, skipped exercises, technique problems, or mixed weights", () => {
    for (const kind of ["missing", "skip", "technique", "weight"]) {
      const e = exercise();
      if (kind === "missing") e.sets.pop();
      if (kind === "skip") e.skipped = true;
      if (kind === "technique") e.sets[0].issue = true;
      if (kind === "weight") e.sets[0].weight = 4;
      expect(ready(e)).toBe(false);
    }
  });
  it("excludes warmups without reducing prescribed working sets", () => {
    const e = exercise();
    e.sets.push({
      ...e.sets[0],
      id: uid(),
      warmup: true,
      done: false,
      reps: 0,
      weight: 1,
    });
    expect(ready(e)).toBe(true);
    e.sets[0].warmup = true;
    expect(ready(e)).toBe(false);
  });
  it("never invents increments and respects configured lists", () => {
    const e = initialState().exercises.find((e) => e.id === "chest")!;
    expect(nextWeight(e)).toBe(null);
    e.increment = 2.3;
    expect(nextWeight(e)).toBe(41.3);
    e.weights = [48, 43.6, 39, 41.3];
    expect(nextWeight(e)).toBe(41.3);
    e.weight = 48;
    expect(nextWeight(e)).toBe(null);
  });
  it("target changes do not rewrite history", () => {
    const s = initialState();
    const w = newSession(s.templates[0], s.exercises);
    s.exercises[0].max = 20;
    s.exercises[0].weight = 7;
    expect(w.exercises[0].target).toEqual({
      sets: 3,
      min: 8,
      max: 12,
      weight: 5,
    });
  });
});
describe("persistence and migrations", () => {
  it("initializes once, recovers active sessions, and never overwrites edited seed values", async () => {
    const db = makeDB();
    const s = await db.initialize();
    s.exercises[0].weight = 8;
    s.sessions.push(newSession(s.templates[0], s.exercises));
    s.sessions[0].exercises[0].sets[0].done = true;
    s.sessions[0].exercises[0].sets[0].reps = 10;
    await db.replace(s);
    db.close();
    await db.open();
    expect(await db.initialize()).toEqual(s);
  });
  it("does not reseed intentionally empty initialized data", async () => {
    const db = makeDB();
    const s = await db.initialize();
    s.exercises = [];
    s.templates = [];
    await db.replace(s);
    expect((await db.initialize()).exercises).toHaveLength(0);
  });
  it("refuses to overwrite data lacking the initialization marker", async () => {
    const db = makeDB();
    await db.exercises.put(initialState().exercises[0]);
    await expect(db.initialize()).rejects.toThrow(
      "Existing data needs recovery",
    );
    expect(await db.exercises.count()).toBe(1);
  });
  it("migrates v1 sessions without dropping logs", async () => {
    const name = `migration-${uid()}`;
    const old = new Dexie(name);
    old
      .version(1)
      .stores({
        exercises: "id",
        templates: "id",
        sessions: "id,startedAt",
        meta: "key",
      });
    const s = initialState();
    const w = newSession(s.templates[0], s.exercises);
    w.exercises[0].sets[0].done = true;
    const v1 = JSON.parse(JSON.stringify(w));
    delete v1.updatedAt;
    delete v1.focus;
    delete v1.restUntil;
    await old.table("exercises").bulkPut(s.exercises);
    await old.table("templates").bulkPut(s.templates);
    await old.table("sessions").put(v1);
    await old.table("meta").bulkPut([
      { key: "initialized", value: true },
      { key: "settings", value: s.settings },
    ]);
    old.close();
    const db = new RepDB(name);
    databases.push(db);
    const migrated = await db.initialize();
    expect(migrated.sessions[0].exercises[0].sets[0].done).toBe(true);
    expect(migrated.sessions[0].updatedAt).toBe(w.startedAt);
    expect(migrated.sessions[0].focus).toBe(w.exercises[0].id);
  });
  it("rejects invalid writes without losing existing records", async () => {
    const db = makeDB();
    const s = await db.initialize();
    const bad = structuredClone(s);
    bad.exercises[0].weight = -1;
    await expect(db.replace(bad)).rejects.toThrow();
    expect(await db.read()).toEqual(s);
  });
  it("rolls back all tables if a transaction fails", async () => {
    const db = makeDB();
    const s = await db.initialize();
    await expect(
      db.transaction("rw", db.tables, async () => {
        await db.exercises.clear();
        await db.sessions.clear();
        throw new Error("Simulated quota/storage failure");
      }),
    ).rejects.toThrow("Simulated");
    expect(await db.read()).toEqual(s);
  });
});
describe("backup safety", () => {
  it("roundtrips all app data and restores an active session", async () => {
    const db = makeDB();
    const s = initialState();
    s.sessions.push(newSession(s.templates[0], s.exercises));
    s.sessions[0].exercises[0].sets[0].done = true;
    await db.replace(parseBackup(makeBackup(s)));
    expect(await db.read()).toEqual(s);
  });
  it("merges without duplicates or overwriting existing edits", () => {
    const s = initialState();
    const incoming = structuredClone(s);
    incoming.exercises[0].weight = 300;
    incoming.sessions.push({
      ...newSession(incoming.templates[0], incoming.exercises),
      finishedAt: new Date().toISOString(),
    });
    const merged = mergeBackup(s, incoming);
    expect(merged.exercises[0].weight).toBe(5);
    expect(mergeBackup(merged, incoming)).toEqual(merged);
    expect(merged.sessions).toHaveLength(1);
  });
  it("rejects corrupt files, unknown versions, invalid references and duplicate IDs", () => {
    expect(() => parseBackup("broken")).toThrow();
    const backup = JSON.parse(makeBackup(initialState()));
    backup.version = 2;
    expect(() => parseBackup(JSON.stringify(backup))).toThrow();
    const s = initialState();
    s.templates[0].exerciseIds.push("unknown");
    expect(() => validateState(s)).toThrow();
    const duplicate = initialState();
    duplicate.exercises.push(duplicate.exercises[0]);
    expect(() => validateState(duplicate)).toThrow();
  });
  it("rejects conflicting active sessions instead of silently dropping one", () => {
    const a = initialState(),
      b = initialState();
    a.sessions.push(newSession(a.templates[0], a.exercises));
    b.sessions.push(newSession(b.templates[1], b.exercises));
    expect(() => mergeBackup(a, b)).toThrow("multiple active");
  });
});
