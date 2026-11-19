import { useEffect, useRef, useState } from 'react';
import {
  Dumbbell,
  Play,
  Plus,
  Check,
  Timer,
  Trash2,
  Volume2,
  History,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import { playRestFinishedSound } from '../utils/sound';
import type { SetLog, WorkoutSession, WorkoutTemplate } from '../types/api';

const MUSCLE_GROUPS = [
  'Klatka',
  'Plecy',
  'Nogi',
  'Barki',
  'Biceps',
  'Triceps',
  'Brzuch',
  'Cardio',
];

export function WorkoutTab() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rozwijane podglądy planów oraz szczegółów historycznych treningów
  const [expandedTemplateId, setExpandedTemplateId] = useState<number | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);

  // Potwierdzenie zakończenia przy nieodhaczonych seriach
  const [unfinishedWarningCount, setUnfinishedWarningCount] = useState<number | null>(null);

  // Stoper całego treningu
  const [elapsedWorkoutSeconds, setElapsedWorkoutSeconds] = useState(0);

  // Timer przerwy między seriami
  const [restRemaining, setRestRemaining] = useState<number>(0);
  const [restTotal, setRestTotal] = useState<number>(0);
  const [restExerciseName, setRestExerciseName] = useState<string>('');
  const soundPlayedRef = useRef<boolean>(false);

  // Kreator i edytor planu treningowego
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [planName, setPlanName] = useState('');
  const [planExercises, setPlanExercises] = useState([
    {
      exerciseName: '',
      muscleGroup: 'Klatka',
      exerciseType: 'Strength' as 'Strength' | 'Cardio',
      targetSets: 3,
      restSeconds: 120,
      notes: '',
    },
  ]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tpls, hist] = await Promise.all([
        api.getWorkoutTemplates(),
        api.getWorkoutHistory(10),
      ]);
      setTemplates(tpls);
      setHistory(hist);

      try {
        const active = await api.getActiveSession();
        setActiveSession(active);
      } catch {
        setActiveSession(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania treningów.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!activeSession) {
      setElapsedWorkoutSeconds(0);
      return;
    }

    const updateElapsed = () => {
      const started = new Date(activeSession.startedAt).getTime();
      const diff = Math.max(0, Math.floor((Date.now() - started) / 1000));
      setElapsedWorkoutSeconds(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    if (restRemaining <= 0) return;

    const timer = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          if (!soundPlayedRef.current) {
            soundPlayedRef.current = true;
            playRestFinishedSound();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [restRemaining]);

  const startRestTimer = (seconds: number, exerciseName: string) => {
    if (seconds <= 0) return;
    soundPlayedRef.current = false;
    setRestTotal(seconds);
    setRestRemaining(seconds);
    setRestExerciseName(exerciseName);
  };

  const openNewPlanForm = () => {
    setEditingTemplateId(null);
    setPlanName('');
    setPlanExercises([
      {
        exerciseName: '',
        muscleGroup: 'Klatka',
        exerciseType: 'Strength',
        targetSets: 3,
        restSeconds: 120,
        notes: '',
      },
    ]);
    setShowPlanForm(true);
  };

  const openEditPlanForm = (tpl: WorkoutTemplate) => {
    setEditingTemplateId(tpl.id);
    setPlanName(tpl.name);
    setPlanExercises(
      tpl.exercises.map((ex) => ({
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup || 'Ogólne',
        exerciseType: ex.exerciseType || 'Strength',
        targetSets: ex.targetSets,
        restSeconds: ex.restSeconds,
        notes: ex.notes ?? '',
      }))
    );
    setShowPlanForm(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const validExercises = planExercises.filter((ex) => ex.exerciseName.trim() !== '');
    if (!planName.trim() || validExercises.length === 0) return;

    const payload = {
      name: planName.trim(),
      exercises: validExercises.map((ex, idx) => ({
        exerciseName: ex.exerciseName.trim(),
        orderIndex: idx + 1,
        targetSets: ex.targetSets,
        restSeconds: ex.restSeconds,
        notes: ex.notes.trim() || undefined,
        muscleGroup: ex.muscleGroup,
        exerciseType: ex.exerciseType,
      })),
    };

    try {
      if (editingTemplateId) {
        await api.updateWorkoutTemplate(editingTemplateId, payload);
      } else {
        await api.createWorkoutTemplate(payload);
      }
      setShowPlanForm(false);
      setEditingTemplateId(null);
      await loadInitialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać planu.');
    }
  };

  const handleStartTemplate = async (templateId: number) => {
    try {
      setError(null);
      setUnfinishedWarningCount(null);
      const session = await api.startWorkoutFromTemplate(templateId);
      setActiveSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się rozpocząć treningu.');
    }
  };

  const handleToggleSet = async (
    set: SetLog,
    weightKg: number,
    reps: number,
    restSeconds: number,
    exerciseName: string
  ) => {
    if (!activeSession) return;
    const nextCompleted = !set.isCompleted;

    try {
      const updated = await api.updateSet(set.id, {
        weightKg,
        reps,
        isCompleted: nextCompleted,
      });

      const updatedExercises = activeSession.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === updated.id ? updated : s)),
      }));

      const newVolume = updatedExercises
        .filter((e) => e.exerciseType !== 'Cardio' && e.muscleGroup !== 'Cardio')
        .flatMap((e) => e.sets)
        .filter((s) => s.isCompleted)
        .reduce((acc, s) => acc + s.weightKg * s.reps, 0);

      setActiveSession({
        ...activeSession,
        totalVolumeKg: Math.round(newVolume * 10) / 10,
        exercises: updatedExercises,
      });

      if (nextCompleted) {
        startRestTimer(restSeconds, exerciseName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu serii.');
    }
  };

  const handleDeleteSet = async (setId: number, exerciseName: string) => {
    if (!activeSession) return;
    try {
      await api.deleteSet(setId);
      const updatedExercises = activeSession.exercises
        .map((ex) => {
          if (ex.exerciseName !== exerciseName) return ex;
          const filtered = ex.sets
            .filter((s) => s.id !== setId)
            .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
          return { ...ex, sets: filtered };
        })
        .filter((ex) => ex.sets.length > 0);

      const newVolume = updatedExercises
        .filter((e) => e.exerciseType !== 'Cardio' && e.muscleGroup !== 'Cardio')
        .flatMap((e) => e.sets)
        .filter((s) => s.isCompleted)
        .reduce((acc, s) => acc + s.weightKg * s.reps, 0);

      setActiveSession({
        ...activeSession,
        totalVolumeKg: Math.round(newVolume * 10) / 10,
        exercises: updatedExercises,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć serii.');
    }
  };

  const handleAddSet = async (
    exerciseName: string,
    restSeconds: number,
    muscleGroup: string,
    exerciseType: 'Strength' | 'Cardio'
  ) => {
    if (!activeSession) return;
    try {
      const newSet = await api.addSetToSession(
        activeSession.id,
        exerciseName,
        restSeconds,
        muscleGroup,
        exerciseType
      );
      const updatedExercises = activeSession.exercises.map((ex) =>
        ex.exerciseName === exerciseName ? { ...ex, sets: [...ex.sets, newSet] } : ex
      );
      setActiveSession({ ...activeSession, exercises: updatedExercises });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać serii.');
    }
  };

  const handleRemoveExerciseFromSession = async (exerciseName: string) => {
    if (!activeSession) return;
    try {
      await api.removeExerciseFromSession(activeSession.id, exerciseName);
      const updatedExercises = activeSession.exercises.filter(
        (ex) => ex.exerciseName !== exerciseName
      );
      setActiveSession({ ...activeSession, exercises: updatedExercises });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć ćwiczenia z sesji.');
    }
  };

  const handleFinishClick = () => {
    if (!activeSession) return;
    const uncompletedSets = activeSession.exercises
      .flatMap((e) => e.sets)
      .filter((s) => !s.isCompleted).length;

    if (uncompletedSets > 0) {
      setUnfinishedWarningCount(uncompletedSets);
      return;
    }

    confirmFinishWorkout();
  };

  const confirmFinishWorkout = async () => {
    if (!activeSession) return;
    try {
      await api.finishSession(activeSession.id);
      setActiveSession(null);
      setUnfinishedWarningCount(null);
      setRestRemaining(0);
      await loadInitialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd kończenia treningu.');
    }
  };

  const handleDeleteHistorySession = async (sessionId: number) => {
    try {
      await api.deleteWorkoutSession(sessionId);
      await loadInitialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć treningu z historii.');
    }
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- WIDOK AKTYWNEGO TRENINGU ---
  if (activeSession) {
    return (
      <div className="space-y-4 pb-28">
        <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 -mx-4 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{activeSession.name}</h2>
            <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
              <span>Czas: {formatTime(elapsedWorkoutSeconds)}</span>
              <span>•</span>
              <span>Tonaż: {activeSession.totalVolumeKg} kg</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={playRestFinishedSound}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-amber-400"
              title="Testuj dźwięk timera"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleFinishClick}
              className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-sm px-5 py-2 rounded-xl shadow-lg shadow-amber-500/10 transition"
            >
              Finish
            </button>
          </div>
        </div>

        {/* Ostrzeżenie przy próbie zakończenia treningu z nieodhaczonymi seriami */}
        {unfinishedWarningCount !== null && (
          <div className="bg-amber-950/60 border border-amber-500/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-100 space-y-1">
                <p className="font-bold text-sm text-amber-300">
                  Masz jeszcze {unfinishedWarningCount} nieodhaczonych serii!
                </p>
                <p>
                  Nieodhaczone serie nie zostaną wliczone do tonażu ani historii postępu. Czy na
                  pewno chcesz zakończyć trening teraz?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUnfinishedWarningCount(null)}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl"
              >
                Wróć do treningu
              </button>
              <button
                onClick={confirmFinishWorkout}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl"
              >
                Tak, zakończ trening
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-3">
            {error}
          </div>
        )}

        {activeSession.exercises.map((exercise) => {
          const isCardio =
            exercise.exerciseType === 'Cardio' || exercise.muscleGroup === 'Cardio';

          return (
            <div
              key={exercise.exerciseName}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-amber-400 text-base">
                      {exercise.exerciseName}
                    </h3>
                    <span className="text-[11px] font-semibold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md">
                      {exercise.muscleGroup}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {exercise.restSeconds > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-md font-medium">
                        <Timer className="w-3 h-3" />
                        {Math.round(exercise.restSeconds / 60)}m ({exercise.restSeconds}s)
                      </span>
                    )}
                    {exercise.notes && (
                      <span className="text-xs text-zinc-400">{exercise.notes}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveExerciseFromSession(exercise.exerciseName)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition"
                  title="Usuń całe ćwiczenie z dzisiejszego treningu"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-12 gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-1 pt-1">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-4 text-center">Previous</div>
                <div className="col-span-2 text-center">
                  {isCardio ? 'Czas (m)' : 'Reps'}
                </div>
                <div className="col-span-2 text-center">
                  {isCardio ? 'Nachyl. %' : 'KG'}
                </div>
                <div className="col-span-2 text-center">✓</div>
                <div className="col-span-1 text-center"></div>
              </div>

              <div className="space-y-1.5">
                {exercise.sets.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    onToggle={(w, r) =>
                      handleToggleSet(
                        set,
                        w,
                        r,
                        exercise.restSeconds,
                        exercise.exerciseName
                      )
                    }
                    onDelete={() => handleDeleteSet(set.id, exercise.exerciseName)}
                  />
                ))}
              </div>

              <button
                onClick={() =>
                  handleAddSet(
                    exercise.exerciseName,
                    exercise.restSeconds,
                    exercise.muscleGroup,
                    exercise.exerciseType
                  )
                }
                className="w-full py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Set
              </button>
            </div>
          );
        })}

        {restRemaining > 0 && (
          <div className="fixed bottom-20 left-4 right-4 max-w-xl mx-auto z-30 bg-zinc-900 border border-amber-500/50 shadow-2xl rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono font-bold text-sm">
                {formatTime(restRemaining)}
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Przerwa • {restExerciseName}</p>
                <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-amber-400 transition-all duration-1000"
                    style={{
                      width: `${restTotal > 0 ? (restRemaining / restTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRestRemaining((r) => Math.max(0, r - 15))}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-zinc-200"
              >
                -15s
              </button>
              <button
                onClick={() => {
                  setRestRemaining((r) => r + 15);
                  setRestTotal((t) => t + 15);
                }}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-zinc-200"
              >
                +15s
              </button>
              <button
                onClick={() => setRestRemaining(0)}
                className="p-1.5 text-zinc-400 hover:text-white"
                title="Pomiń przerwę"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- WIDOK PLANÓW TRENINGOWYCH I HISTORII ---
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-amber-400" />
          Plany treningowe
        </h2>
        <button
          onClick={openNewPlanForm}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-3.5 py-2 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Nowy plan
        </button>
      </div>

      {/* Kreator / Edytor planu treningowego (tylko 1 przycisk Anuluj) */}
      {showPlanForm && (
        <form
          onSubmit={handleSavePlan}
          className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-amber-400">
            {editingTemplateId ? 'Edytuj plan treningowy' : 'Utwórz plan treningowy'}
          </h3>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Nazwa planu treningowego</label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="np. Push / Pull / Legs"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2.5">
            {planExercises.map((ex, idx) => (
              <div
                key={idx}
                className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-400">
                    Ćwiczenie #{idx + 1}
                  </span>
                  {planExercises.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPlanExercises(planExercises.filter((_, i) => i !== idx))
                      }
                      className="text-zinc-500 hover:text-red-400 p-1"
                      title="Usuń to ćwiczenie"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <label className="block text-[10px] text-zinc-500 mb-0.5">
                      Nazwa ćwiczenia
                    </label>
                    <input
                      type="text"
                      value={ex.exerciseName}
                      onChange={(e) => {
                        const copy = [...planExercises];
                        copy[idx].exerciseName = e.target.value;
                        setPlanExercises(copy);
                      }}
                      placeholder="np. Wyciskanie sztangi / Bieżnia"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="col-span-5">
                    <label className="block text-[10px] text-zinc-500 mb-0.5">
                      Partia / Kategoria
                    </label>
                    <select
                      value={ex.muscleGroup}
                      onChange={(e) => {
                        const copy = [...planExercises];
                        const val = e.target.value;
                        copy[idx].muscleGroup = val;
                        copy[idx].exerciseType = val === 'Cardio' ? 'Cardio' : 'Strength';
                        if (val === 'Cardio') {
                          copy[idx].targetSets = 1;
                          copy[idx].restSeconds = 0;
                        }
                        setPlanExercises(copy);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs"
                    >
                      {MUSCLE_GROUPS.map((mg) => (
                        <option key={mg} value={mg}>
                          {mg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <label className="block text-[10px] text-zinc-500 mb-0.5">
                      {ex.exerciseType === 'Cardio' ? 'Odcinki' : 'Ilość serii'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={ex.targetSets}
                      onChange={(e) => {
                        const copy = [...planExercises];
                        copy[idx].targetSets = Number(e.target.value);
                        setPlanExercises(copy);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-center"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[10px] text-zinc-500 mb-0.5">
                      Przerwa (sek.)
                    </label>
                    <input
                      type="number"
                      step={15}
                      min={0}
                      value={ex.restSeconds}
                      onChange={(e) => {
                        const copy = [...planExercises];
                        copy[idx].restSeconds = Number(e.target.value);
                        setPlanExercises(copy);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-center"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[10px] text-zinc-500 mb-0.5">
                      Notatka (opc.)
                    </label>
                    <input
                      type="text"
                      value={ex.notes}
                      onChange={(e) => {
                        const copy = [...planExercises];
                        copy[idx].notes = e.target.value;
                        setPlanExercises(copy);
                      }}
                      placeholder="np. 8-10 powt."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() =>
                setPlanExercises([
                  ...planExercises,
                  {
                    exerciseName: '',
                    muscleGroup: 'Klatka',
                    exerciseType: 'Strength',
                    targetSets: 3,
                    restSeconds: 120,
                    notes: '',
                  },
                ])
              }
              className="text-xs text-amber-400 hover:underline font-medium"
            >
              + Kolejne ćwiczenie
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPlanForm(false);
                  setEditingTemplateId(null);
                }}
                className="px-3 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-4 py-2 rounded-xl"
              >
                {editingTemplateId ? 'Zaktualizuj plan' : 'Zapisz plan'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Lista szablonów z rozwijanym podglądem i edycją */}
      {loading ? (
        <div className="text-center py-8 text-zinc-500 text-sm">Ładowanie planów...</div>
      ) : templates.length === 0 ? (
        <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-sm text-zinc-500">
          Nie masz jeszcze żadnego planu treningowego. Kliknij „Nowy plan”, aby dodać pierwszy!
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => {
            const isExpanded = expandedTemplateId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    onClick={() => setExpandedTemplateId(isExpanded ? null : tpl.id)}
                    className="cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base">{tpl.name}</h3>
                      <span className="text-xs text-zinc-400 flex items-center gap-0.5">
                        ({tpl.exercises.length} ćw.)
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {tpl.exercises.map((e) => e.exerciseName).join(' • ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditPlanForm(tpl)}
                      className="p-1.5 text-zinc-400 hover:text-amber-400 rounded-lg"
                      title="Edytuj plan"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        await api.deleteWorkoutTemplate(tpl.id);
                        await loadInitialData();
                      }}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg"
                      title="Usuń plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 divide-y divide-zinc-800/60 text-xs">
                    {tpl.exercises.map((ex) => (
                      <div key={ex.id} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-zinc-200">{ex.exerciseName}</span>
                          <span className="ml-2 text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                            {ex.muscleGroup}
                          </span>
                        </div>
                        <span className="text-zinc-400 shrink-0">
                          {ex.targetSets} serii • przerwa {ex.restSeconds}s
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => handleStartTemplate(tpl.id)}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm py-2.5 rounded-xl transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Rozpocznij trening
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Ostatnie treningi ze szczegółowym podglądem wykonanych serii, powtórzeń i ciężarów */}
      {history.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <h3 className="text-sm font-semibold text-zinc-400 flex items-center gap-1.5 px-1">
            <History className="w-4 h-4" />
            Ostatnie treningi
          </h3>
          {history.map((session) => {
            const isExpanded = expandedHistoryId === session.id;
            const durationMins =
              session.finishedAt && session.startedAt
                ? Math.max(
                    1,
                    Math.round(
                      (new Date(session.finishedAt).getTime() -
                        new Date(session.startedAt).getTime()) /
                        60000
                    )
                  )
                : null;

            return (
              <div
                key={session.id}
                className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    onClick={() => setExpandedHistoryId(isExpanded ? null : session.id)}
                    className="cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-zinc-200">{session.name}</p>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {new Date(session.startedAt).toLocaleDateString('pl-PL')}
                      {durationMins !== null ? ` • Czas: ${durationMins} min` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                      {session.totalVolumeKg} kg tonażu
                    </span>
                    <button
                      onClick={() => handleDeleteHistorySession(session.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg"
                      title="Usuń trening z historii"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-zinc-950/80 border border-zinc-800/70 rounded-xl p-3 space-y-3 text-xs">
                    {session.exercises.map((ex) => {
                      const completedSets = ex.sets.filter((s) => s.isCompleted);
                      const isCardio =
                        ex.exerciseType === 'Cardio' || ex.muscleGroup === 'Cardio';
                      const exVolume = !isCardio
                        ? completedSets.reduce((acc, s) => acc + s.weightKg * s.reps, 0)
                        : 0;

                      return (
                        <div key={ex.exerciseName} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-amber-400">
                              {ex.exerciseName}{' '}
                              <span className="text-[10px] text-zinc-500 font-normal">
                                ({ex.muscleGroup})
                              </span>
                            </p>
                            {!isCardio && exVolume > 0 && (
                              <span className="text-[11px] text-zinc-400">
                                Suma: {Math.round(exVolume)} kg
                              </span>
                            )}
                          </div>
                          {completedSets.length === 0 ? (
                            <p className="text-zinc-500">Brak zaliczonych serii</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {completedSets.map((s) => (
                                <div
                                  key={s.id}
                                  className="bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg flex justify-between text-zinc-300"
                                >
                                  <span className="text-zinc-500">Seria {s.setNumber}</span>
                                  <span className="font-semibold">
                                    {isCardio
                                      ? `${s.reps} min @ ${s.weightKg}%`
                                      : `${s.reps} powt. × ${s.weightKg} kg`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SetRow({
  set,
  onToggle,
  onDelete,
}: {
  set: SetLog;
  onToggle: (weightKg: number, reps: number) => void;
  onDelete: () => void;
}) {
  const [weight, setWeight] = useState<string>(set.weightKg ? String(set.weightKg) : '');
  const [reps, setReps] = useState<string>(set.reps ? String(set.reps) : '');

  return (
    <div
      className={`grid grid-cols-12 gap-1.5 items-center rounded-xl px-1 py-1.5 transition ${
        set.isCompleted ? 'bg-emerald-950/40' : 'bg-zinc-950/60'
      }`}
    >
      <div className="col-span-1 text-center text-xs font-bold text-zinc-300">
        {set.setNumber}
      </div>
      <div className="col-span-4 text-center text-xs text-zinc-400 truncate">
        {set.previousPerformance ?? '—'}
      </div>
      <div className="col-span-2">
        <input
          type="number"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="0"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-center text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          step="0.5"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="0"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-center text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
        />
      </div>
      <div className="col-span-2 flex justify-center">
        <button
          onClick={() => onToggle(Number(weight) || 0, Number(reps) || 0)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
            set.isCompleted
              ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
          }`}
        >
          <Check className="w-4 h-4 stroke-[3]" />
        </button>
      </div>
      <div className="col-span-1 flex justify-center">
        <button
          onClick={onDelete}
          className="p-1 text-zinc-600 hover:text-red-400 transition"
          title="Usuń serię"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}