import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Download,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { type State, type Exercise, uid, now, displayWeight } from "./model";
import type { Change } from "./store";
import { PageTitle, formatDate } from "./ui";
import { makeBackup, parseBackup, mergeBackup } from "./backup";
import { db } from "./db";
export function Settings({
  state,
  change,
  busy,
  onExercise,
  onError,
  offlineReady,
}: {
  state: State;
  change: Change;
  busy: boolean;
  onExercise: (id: string) => void;
  onError: (s: string) => void;
  offlineReady: boolean;
}) {
  const [template, setTemplate] = useState(state.templates[0]?.id ?? "");
  const [add, setAdd] = useState("");
  const [imported, setImported] = useState<State | null>(null);
  const [status, setStatus] = useState("");
  const t = state.templates.find((t) => t.id === template);
  const unit = state.settings.unit;
  async function exportData() {
    try {
      const current = await db.read();
      const blob = new Blob([makeBackup(current)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reptrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      await change((s) => {
        s.settings.lastExport = now();
      }, false);
      setStatus(
        "Backup download requested. Save the file to Files or another location outside this browser.",
      );
    } catch (e) {
      onError(`Could not export your data: ${String(e)}`);
    }
  }
  async function readImport(file?: File) {
    if (!file) return;
    try {
      if (file.size > 30_000_000) throw new Error("File exceeds 30 MB");
      setImported(parseBackup(await file.text()));
      setStatus("");
    } catch (e) {
      onError(
        `Backup rejected. No data was changed. ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  async function applyImport(mode: "merge" | "restore") {
    if (!imported) return;
    if (
      !confirm(
        mode === "restore"
          ? "Replace ALL current app data with this backup? Export your current data first."
          : "Merge this backup? Existing records with the same ID stay unchanged; only new records will be added.",
      )
    )
      return;
    const incoming = imported;
    const ok = await change(
      (s) =>
        Object.assign(
          s,
          mode === "restore" ? incoming : mergeBackup(s, incoming),
        ),
      false,
    );
    if (ok) {
      setImported(null);
      setStatus(
        `${mode === "restore" ? "Restored" : "Merged"} successfully. All data was validated before applying.`,
      );
    }
  }
  async function createExercise(form: HTMLFormElement) {
    const data = new FormData(form);
    const id = uid();
    const e: Exercise = {
      id,
      name: String(data.get("name")).trim(),
      equipment: "Custom exercise",
      image: "/exercises/custom.svg",
      weight: null,
      sets: 3,
      min: 8,
      max: 12,
      increment: null,
      weights: [],
      convention: "unconfirmed",
      cues: [],
      mistakes: [],
      legacy: null,
      weightHistory: [],
      updatedAt: now(),
    };
    if (
      await change((s) => {
        s.exercises.push(e);
      })
    )
      onExercise(id);
  }
  return (
    <>
      <PageTitle eyebrow="MAKE IT YOURS" title="A routine that fits you.">
        <p>Fine-tune your training. Keep your data in your hands.</p>
      </PageTitle>
      <div className="settings-columns">
        <div>
          <section className="panel">
            <h2>Training preferences</h2>
            <label className="setting-row">
              <span>
                <strong>Weight unit</strong>
                <small>Converts display values; history is preserved.</small>
              </span>
              <select
                aria-label="Weight unit"
                value={unit}
                disabled={busy}
                onChange={(e) =>
                  change((s) => {
                    s.settings.unit = e.target.value as "kg" | "lb";
                  })
                }
              >
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </label>
            <label className="setting-row">
              <span>
                <strong>Suggested rotation</strong>
                <small>A → B → A → Legs → B → A → B → Legs</small>
              </span>
              <input
                className="switch"
                type="checkbox"
                checked={state.settings.rotation}
                disabled={busy}
                onChange={(e) =>
                  change((s) => {
                    s.settings.rotation = e.target.checked;
                  })
                }
              />
            </label>
            <label className="setting-row">
              <span>
                <strong>Rest timer</strong>
                <small>Starts quietly after completing a set.</small>
              </span>
              <select
                aria-label="Rest timer"
                value={state.settings.restSeconds}
                disabled={busy}
                onChange={(e) =>
                  change((s) => {
                    s.settings.restSeconds = Number(e.target.value);
                  })
                }
              >
                {[
                  0,
                  30,
                  60,
                  90,
                  120,
                  180,
                  300,
                  ...(![0, 30, 60, 90, 120, 180, 300].includes(
                    state.settings.restSeconds,
                  )
                    ? [state.settings.restSeconds]
                    : []),
                ].map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n}s` : "Off"}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="panel template-settings">
            <div className="section-heading">
              <h2>Your workouts</h2>
              <span>{state.templates.length} TEMPLATES</span>
            </div>
            <select
              aria-label="Workout template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              {state.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {t && (
              <>
                <label className="template-name">
                  Workout name
                  <input
                    key={t.id + t.name}
                    defaultValue={t.name}
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== t.name)
                        void change((s) => {
                          const x = s.templates.find((x) => x.id === t.id)!;
                          x.name = name;
                          x.updatedAt = now();
                        });
                    }}
                  />
                </label>
                <label>
                  Workout description
                  <input
                    key={t.id + t.subtitle}
                    defaultValue={t.subtitle}
                    onBlur={(e) => {
                      if (e.target.value !== t.subtitle)
                        void change((s) => {
                          const x = s.templates.find((x) => x.id === t.id)!;
                          x.subtitle = e.target.value;
                          x.updatedAt = now();
                        });
                    }}
                  />
                </label>
                <ol className="template-exercises">
                  {t.exerciseIds.map((id, i) => {
                    const e = state.exercises.find((e) => e.id === id)!;
                    return (
                      <li key={id}>
                        <span className="tiny">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <button
                          className="exercise-name"
                          onClick={() => onExercise(id)}
                        >
                          {e.name}
                        </button>
                        <button
                          aria-label={`Move ${e.name} up`}
                          disabled={i === 0 || busy}
                          onClick={() =>
                            change((s) => {
                              const list = s.templates.find(
                                (x) => x.id === t.id,
                              )!;
                              [list.exerciseIds[i - 1], list.exerciseIds[i]] = [
                                list.exerciseIds[i],
                                list.exerciseIds[i - 1],
                              ];
                              list.updatedAt = now();
                            })
                          }
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          aria-label={`Move ${e.name} down`}
                          disabled={i === t.exerciseIds.length - 1 || busy}
                          onClick={() =>
                            change((s) => {
                              const list = s.templates.find(
                                (x) => x.id === t.id,
                              )!;
                              [list.exerciseIds[i + 1], list.exerciseIds[i]] = [
                                list.exerciseIds[i],
                                list.exerciseIds[i + 1],
                              ];
                              list.updatedAt = now();
                            })
                          }
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          aria-label={`Remove ${e.name} from template`}
                          disabled={busy}
                          onClick={() =>
                            change((s) => {
                              const x = s.templates.find((x) => x.id === t.id)!;
                              x.exerciseIds = x.exerciseIds.filter(
                                (x) => x !== id,
                              );
                              x.updatedAt = now();
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <div className="inline-form">
                  <select
                    aria-label="Exercise to add to template"
                    value={add}
                    onChange={(e) => setAdd(e.target.value)}
                  >
                    <option value="">Add exercise…</option>
                    {state.exercises
                      .filter((e) => !t.exerciseIds.includes(e.id))
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                  <button
                    disabled={!add || busy}
                    onClick={async () => {
                      if (
                        await change((s) => {
                          const x = s.templates.find((x) => x.id === t.id)!;
                          x.exerciseIds.push(add);
                          x.updatedAt = now();
                        })
                      )
                        setAdd("");
                    }}
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <p className="help">
                  Remove here and add to another template to move an exercise.
                  History is always kept.
                </p>
                <button
                  className="text-button danger"
                  onClick={() => {
                    if (
                      confirm(
                        `Delete the ${t.name} template? Recorded workouts and exercise data will be kept.`,
                      )
                    )
                      void change((s) => {
                        s.templates = s.templates.filter((x) => x.id !== t.id);
                      }).then((ok) => {
                        if (ok)
                          setTemplate(
                            state.templates.find((x) => x.id !== t.id)?.id ??
                              "",
                          );
                      });
                  }}
                >
                  Delete template
                </button>
              </>
            )}
            <form
              className="inline-form new-template"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = String(new FormData(form).get("name")).trim();
                const id = uid();
                if (
                  await change((s) => {
                    s.templates.push({
                      id,
                      name,
                      subtitle: "Your custom routine",
                      exerciseIds: [],
                      updatedAt: now(),
                    });
                  })
                ) {
                  setTemplate(id);
                  form.reset();
                }
              }}
            >
              <input
                aria-label="New workout name"
                name="name"
                placeholder="New workout name"
                required
                maxLength={100}
              />
              <button disabled={busy} aria-label="Create workout template">
                <Plus size={20} />
              </button>
            </form>
          </section>
        </div>
        <div>
          <section className="panel backup-panel">
            <span className="backup-icon">
              <ShieldCheck size={25} />
            </span>
            <h2>Your progress is worth keeping.</h2>
            <p>
              Training is saved on this device. Browser storage can be cleared,
              so keep a backup somewhere safe.
            </p>
            <div className="backup-status">
              <span className="status-dot" />
              <span>
                {state.settings.lastExport
                  ? `Last export requested ${formatDate(state.settings.lastExport)}`
                  : "No backup exported yet"}
              </span>
            </div>
            <button className="primary" onClick={exportData} disabled={busy}>
              <Download size={18} />
              Export all data
            </button>
            <label className="upload-button">
              <Upload size={17} />
              Import a backup
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  void readImport(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {imported && (
              <div className="import-review">
                <h3>Backup ready for review</h3>
                <p>
                  {imported.exercises.length} exercises ·{" "}
                  {imported.templates.length} templates ·{" "}
                  {imported.sessions.length} sessions
                </p>
                <p>
                  Merge adds only new IDs and preserves existing records.
                  Restore replaces everything.
                </p>
                <button disabled={busy} onClick={() => applyImport("merge")}>
                  Merge new records
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => applyImport("restore")}
                >
                  Restore and replace all
                </button>
                <button onClick={() => setImported(null)}>Cancel</button>
              </div>
            )}
            {status && (
              <p className="success" role="status">
                {status}
              </p>
            )}
            <p className="help">
              Cloud backup is not connected. An export request does not verify
              that a file was saved externally.
            </p>
          </section>
          <section className="panel install-panel">
            <p className="eyebrow">MADE FOR YOUR IPHONE</p>
            <h2>Your gym companion.</h2>
            <p>
              Open RepTrack in Safari. Tap Share, then{" "}
              <strong>Add to Home Screen</strong>.
            </p>
            <div className="backup-status">
              <span className="status-dot" />
              {offlineReady || navigator.serviceWorker?.controller
                ? "App shell ready for offline use"
                : "Offline installation becomes ready after the first production load"}
            </div>
            <p className="help">
              Keep using the same web address so your local workout data stays
              in the same place.
            </p>
            <button
              className="text-button"
              onClick={async () => {
                const granted = await navigator.storage?.persist?.();
                setStatus(
                  granted
                    ? "Persistent storage granted. Still keep external backups."
                    : "Persistent storage was not granted by this browser. Keep external backups.",
                );
              }}
            >
              Request persistent storage
            </button>
          </section>
        </div>
      </div>
      <section className="panel library">
        <div className="section-heading">
          <h2>Exercise library</h2>
          <span>{state.exercises.length} EXERCISES</span>
        </div>
        <div className="library-grid">
          {state.exercises.map((e) => (
            <button
              className="library-item"
              key={e.id}
              onClick={() => onExercise(e.id)}
            >
              <span>
                <strong>{e.name}</strong>
                <small>
                  {displayWeight(e.weight, unit)} {unit} · {e.sets} × {e.min}–
                  {e.max}
                  {!state.templates.some((t) => t.exerciseIds.includes(e.id))
                    ? " · Reserve"
                    : ""}
                </small>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void createExercise(e.currentTarget);
          }}
        >
          <input
            name="name"
            aria-label="New exercise name"
            placeholder="Create a new exercise"
            maxLength={150}
            required
          />
          <button disabled={busy}>
            <Plus size={18} />
            Add
          </button>
        </form>
      </section>
      <p className="app-version">REPTRACK 1.0 · BUILT FOR THE LONG RUN</p>
    </>
  );
}
