import { useEffect, useMemo, useRef, useState } from 'react';
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
  ArrowUp,
  ArrowDown,
  ArrowLeft,
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

const MONTHS_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

export function WorkoutTab() {
  const today = useMemo(() => new Date(), []);
  const todayIso = today.toISOString().split('T')[0];

  const [subView, setSubView] = useState<'plans' | 'history'>('plans');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [editingHistorySession, setEditingHistorySession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zarządzanie listą planów (kolejność góra/dół + usuwanie z potwierdzeniem)
  const [managePlansMode, setManagePlansMode] = useState(false);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<WorkoutTemplate | null>(null);

  // Widok Historia (elastyczne lata + miesiące + kalendarz + klikalny dzień)
  const [histYear, setHistYear] = useState(today.getFullYear());
  const [histMonth, setHistMonth] = useState(today.getMonth());
  const [historySessions, setHistorySessions] = useState<WorkoutSession[]>([]);
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<WorkoutSession | null>(null);

  const availableYears = useMemo(() => {
    const maxYear = Math.max(today.getFullYear() + 1, 2027);
    const years: number[] = [];
    for (let y = 2026; y <= maxYear; y++) years.push(y);
    return years;
  }, [today]);

  // Rozwijane podglądy planów
  const [expandedTemplateId, setExpandedTemplateId] = useState<number | null>(null);

  // Tryb edycji serii w aktywnej lub edytowanej sesji
  const [editingSetsExercises, setEditingSetsExercises] = useState<Record<string, boolean>>({});

  // Dopisywanie nowego ćwiczenia do aktywnej lub edytowanej sesji
  const [showAddExerciseForm, setShowAddExerciseForm] = useState(false);
  const [newExerciseForm, setNewExerciseForm] = useState({
    exerciseName: '',
    muscleGroup: 'Plecy',
    exerciseType: 'Strength' as 'Strength' | 'Cardio',
    restSeconds: 120,
  });

  // Potwierdzenie zakończenia przy nieodhaczonych seriach
  const [unfinishedWarningCount, setUnfinishedWarningCount] = useState<number | null>(null);

  // Stoper treningu i timer przerwy
  const [elapsedWorkoutSeconds, setElapsedWorkoutSeconds] = useState(0);
  const [restRemaining, setRestRemaining] = useState<number>(0);
  const [restTotal, setRestTotal] = useState<number>(0);
  const [restExerciseName, setRestExerciseName] = useState<string>('');
  const soundPlayedRef = useRef<boolean>(false);

  // Kreator i edytor planu treningowego
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [planFormError, setPlanFormError] = useState<string | null>(null);
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

  const loadPlansAndActive = async () => {
    try {
      setLoading(true);
      setError(null);
      const tpls = await api.getWorkoutTemplates();
      setTemplates(tpls);

      try {
        const active = await api.getActiveSession();
        setActiveSession(active);
      } catch {
        setActiveSession(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania planów treningowych.');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [hist, dates] = await Promise.all([
        api.getWorkoutHistory(histYear, histMonth + 1, 50),
        api.getMonthlyWorkoutDates(histYear, histMonth + 1).catch(() => [] as string[]),
      ]);
      setHistorySessions(hist);
      setWorkoutDates(new Set(dates));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania historii treningów.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlansAndActive();
  }, []);

  useEffect(() => {
    if (subView === 'history') {
      loadHistoryData();
    }
  }, [subView, histYear, histMonth]);

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

  const moveTemplate = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= templates.length) return;

    const copy = [...templates];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setTemplates(copy);

    try {
      await api.reorderWorkoutTemplates(copy.map((t) => t.id));
    } catch {
      await loadPlansAndActive();
    }
  };

  const openNewPlanForm = () => {
    setEditingTemplateId(null);
    setPlanFormError(null);
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
    setPlanFormError(null);
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
    setPlanFormError(null);

    if (!planName.trim()) {
      setPlanFormError('Podaj nazwę planu treningowego.');
      return;
    }

    const validExercises = planExercises.filter((ex) => ex.exerciseName.trim() !== '');
    if (validExercises.length === 0) {
      setPlanFormError(
        'Nie można utworzyć planu treningowego bez żadnego ćwiczenia — wpisz nazwę przynajmniej jednego ćwiczenia.'
      );
      return;
    }

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
      await loadPlansAndActive();
    } catch (err) {
      setPlanFormError(err instanceof Error ? err.message : 'Nie udało się zapisać planu.');
    }
  };

  const handleStartTemplate = async (templateId: number) => {
    try {
      setError(null);
      setUnfinishedWarningCount(null);
      setEditingSetsExercises({});
      const session = await api.startWorkoutFromTemplate(templateId);
      setActiveSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się rozpocząć treningu.');
    }
  };

  // Wspólna obsługa sesji zarówno dla aktywnego treningu, jak i edycji treningu z historii
  const currentSession = editingHistorySession ?? activeSession;
  const isHistoryEditMode = editingHistorySession !== null;

  const updateCurrentSessionState = (updated: WorkoutSession) => {
    if (isHistoryEditMode) {
      setEditingHistorySession(updated);
    } else {
      setActiveSession(updated);
    }
  };

  const handleToggleOrSaveSet = async (
    set: SetLog,
    weightKg: number,
    reps: number,
    restSeconds: number,
    exerciseName: string
  ) => {
    if (!currentSession) return;
    const nextCompleted = isHistoryEditMode ? true : !set.isCompleted;

    try {
      const updated = await api.updateSet(set.id, {
        weightKg,
        reps,
        isCompleted: nextCompleted,
      });

      const updatedExercises = currentSession.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === updated.id ? updated : s)),
      }));

      const newVolume = updatedExercises
        .filter((e) => e.exerciseType !== 'Cardio' && e.muscleGroup !== 'Cardio')
        .flatMap((e) => e.sets)
        .filter((s) => s.isCompleted)
        .reduce((acc, s) => acc + s.weightKg * s.reps, 0);

      updateCurrentSessionState({
        ...currentSession,
        totalVolumeKg: Math.round(newVolume * 10) / 10,
        exercises: updatedExercises,
      });

      if (!isHistoryEditMode && nextCompleted) {
        startRestTimer(restSeconds, exerciseName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu serii.');
    }
  };

  const handleDeleteSet = async (setId: number, exerciseName: string) => {
    if (!currentSession) return;
    try {
      await api.deleteSet(setId);
      const updatedExercises = currentSession.exercises
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

      updateCurrentSessionState({
        ...currentSession,
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
    if (!currentSession) return;
    try {
      const newSet = await api.addSetToSession(
        currentSession.id,
        exerciseName,
        restSeconds,
        muscleGroup,
        exerciseType
      );
      const existing = currentSession.exercises.find((e) => e.exerciseName === exerciseName);
      const updatedExercises = existing
        ? currentSession.exercises.map((ex) =>
            ex.exerciseName === exerciseName ? { ...ex, sets: [...ex.sets, newSet] } : ex
          )
        : [
            ...currentSession.exercises,
            {
              exerciseName,
              exerciseOrder: currentSession.exercises.length + 1,
              restSeconds,
              muscleGroup,
              exerciseType,
              sets: [newSet],
            },
          ];

      updateCurrentSessionState({ ...currentSession, exercises: updatedExercises });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać serii.');
    }
  };

  const handleAddNewExerciseToSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExerciseForm.exerciseName.trim()) return;

    await handleAddSet(
      newExerciseForm.exerciseName.trim(),
      newExerciseForm.restSeconds,
      newExerciseForm.muscleGroup,
      newExerciseForm.exerciseType
    );

    setNewExerciseForm((prev) => ({ ...prev, exerciseName: '' }));
    setShowAddExerciseForm(false);
  };

  const handleRemoveExerciseFromSession = async (exerciseName: string) => {
    if (!currentSession) return;
    try {
      await api.removeExerciseFromSession(currentSession.id, exerciseName);
      const updatedExercises = currentSession.exercises.filter(
        (ex) => ex.exerciseName !== exerciseName
      );
      updateCurrentSessionState({ ...currentSession, exercises: updatedExercises });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć ćwiczenia.');
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
      await loadPlansAndActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd kończenia treningu.');
    }
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const daysInHistMonth = useMemo(() => {
    const count = new Date(histYear, histMonth + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const dayNum = i + 1;
      const iso = `${histYear}-${String(histMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(
        2,
        '0'
      )}`;
      return { dayNum, iso };
    });
  }, [histYear, histMonth]);

  const filteredHistorySessions = useMemo(() => {
    if (!selectedHistoryDate) return historySessions;
    return historySessions.filter((s) => s.startedAt.startsWith(selectedHistoryDate));
  }, [historySessions, selectedHistoryDate]);

  // --- WIDOK AKTYWNEGO TRENINGU LUB EDYCJI UKOŃCZONEGO TRENINGU ---
  if (currentSession) {
    return (
      <div className="space-y-4 pb-28">
        <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 -mx-4 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{currentSession.name}</h2>
              {isHistoryEditMode && (
                <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md">
                  Edycja historii
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
              {isHistoryEditMode ? (
                <span>
                  Data: {new Date(currentSession.startedAt).toLocaleDateString('pl-PL')}
                </span>
              ) : (
                <span>Czas: {formatTime(elapsedWorkoutSeconds)}</span>
              )}
              <span>•</span>
              <span>Tonaż: {currentSession.totalVolumeKg} kg</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isHistoryEditMode && (
              <button
                onClick={playRestFinishedSound}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-amber-400"
                title="Testuj gong przerwy"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}

            {isHistoryEditMode ? (
              <button
                onClick={async () => {
                  setEditingHistorySession(null);
                  setEditingSetsExercises({});
                  await loadHistoryData();
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                Zakończ edycję
              </button>
            ) : (
              <button
                onClick={handleFinishClick}
                className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-sm px-4 py-2 rounded-xl shadow-lg shadow-amber-500/10 transition"
              >
                Zakończ trening
              </button>
            )}
          </div>
        </div>

        {!isHistoryEditMode && unfinishedWarningCount !== null && (
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

        {currentSession.exercises.map((exercise) => {
          const isCardio =
            exercise.exerciseType === 'Cardio' || exercise.muscleGroup === 'Cardio';
          const isEditingSets = !!editingSetsExercises[exercise.exerciseName];

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
                  {!isHistoryEditMode && exercise.restSeconds > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-md font-medium">
                        <Timer className="w-3 h-3" />
                        {Math.round(exercise.restSeconds / 60)} min ({exercise.restSeconds}s)
                      </span>
                      {exercise.notes && (
                        <span className="text-xs text-zinc-400">{exercise.notes}</span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditingSetsExercises((prev) => ({
                      ...prev,
                      [exercise.exerciseName]: !prev[exercise.exerciseName],
                    }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    isEditingSets
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {isEditingSets ? 'Gotowe' : 'Edytuj serie'}
                </button>
              </div>

              {isEditingSets && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveExerciseFromSession(exercise.exerciseName)}
                    className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Usuń całe ćwiczenie z treningu
                  </button>
                </div>
              )}

              <div className="grid grid-cols-12 gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-1 pt-1">
                <div className="col-span-1 text-center">Seria</div>
                <div className="col-span-4 text-center">Poprzednio</div>
                <div className="col-span-2 text-center">
                  {isCardio ? 'Czas (m)' : 'Powt.'}
                </div>
                <div className="col-span-3 text-center">
                  {isCardio ? 'Nachyl. %' : 'Ciężar (kg)'}
                </div>
                <div className="col-span-2 text-center">
                  {isEditingSets ? 'Usuń' : isHistoryEditMode ? 'Zapisz' : 'Zalicz'}
                </div>
              </div>

              <div className="space-y-1.5">
                {exercise.sets.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    isEditing={isEditingSets}
                    isHistoryEdit={isHistoryEditMode}
                    onToggle={(w, r) =>
                      handleToggleOrSaveSet(
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
                Dodaj serię
              </button>
            </div>
          );
        })}

        {/* Przycisk i formularz dodania nowego ćwiczenia do aktywnej lub edytowanej sesji */}
        {showAddExerciseForm ? (
          <form
            onSubmit={handleAddNewExerciseToSession}
            className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-4 space-y-3"
          >
            <h3 className="text-xs font-bold text-amber-400">Dodaj ćwiczenie do treningu</h3>
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                value={newExerciseForm.exerciseName}
                onChange={(e) =>
                  setNewExerciseForm({ ...newExerciseForm, exerciseName: e.target.value })
                }
                placeholder="Nazwa ćwiczenia (np. Face Pull)"
                className="col-span-7 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs"
              />
              <select
                value={newExerciseForm.muscleGroup}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewExerciseForm({
                    ...newExerciseForm,
                    muscleGroup: val,
                    exerciseType: val === 'Cardio' ? 'Cardio' : 'Strength',
                  });
                }}
                className="col-span-5 bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-2 text-xs"
              >
                {MUSCLE_GROUPS.map((mg) => (
                  <option key={mg} value={mg}>
                    {mg}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddExerciseForm(false)}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs px-4 py-1.5 rounded-xl"
              >
                Dodaj ćwiczenie
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddExerciseForm(true)}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700 rounded-2xl text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Dodaj ćwiczenie
          </button>
        )}

        {/* Timer przerwy tylko w aktywnym treningu */}
        {!isHistoryEditMode && restRemaining > 0 && (
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
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- PODWIDOK: HISTORIA TRENINGÓW (z kalendarzem i podziałem na miesiące) ---
  if (subView === 'history') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => {
              setSubView('plans');
              setSelectedHistoryDate(null);
            }}
            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-xs px-3 py-2 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            Plany treningowe
          </button>

          <h2 className="text-base font-bold text-white flex items-center gap-1.5">
            <History className="w-4 h-4 text-amber-400" />
            Historia treningów
          </h2>
        </div>

        {/* Okno potwierdzenia usunięcia treningu z historii */}
        {confirmDeleteSession && (
          <div className="bg-red-950/60 border border-red-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-100 space-y-1">
                <p className="font-bold text-sm text-red-300">
                  Usunąć trening „{confirmDeleteSession.name}” z dnia{' '}
                  {new Date(confirmDeleteSession.startedAt).toLocaleDateString('pl-PL')}?
                </p>
                <p>Wszystkie zapisane w nim serie i tonaż zostaną trwale usunięte.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteSession(null)}
                className="px-3.5 py-1.5 bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-xl"
              >
                Anuluj
              </button>
              <button
                onClick={async () => {
                  await api.deleteWorkoutSession(confirmDeleteSession.id);
                  setConfirmDeleteSession(null);
                  await loadHistoryData();
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl"
              >
                Tak, usuń trening
              </button>
            </div>
          </div>
        )}

        {/* Kalendarz z elastycznym wyborem roku i miesiąca */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  onClick={() => {
                    setHistYear(yr);
                    setSelectedHistoryDate(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    histYear === yr
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            <select
              value={histMonth}
              onChange={(e) => {
                setHistMonth(Number(e.target.value));
                setSelectedHistoryDate(null);
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200"
            >
              {MONTHS_PL.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {daysInHistMonth.map(({ dayNum, iso }) => {
              const trained = workoutDates.has(iso);
              const isToday = iso === todayIso;
              const isSelected = iso === selectedHistoryDate;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedHistoryDate(isSelected ? null : iso)}
                  className={`py-2 rounded-lg text-center text-xs font-semibold transition ${
                    trained
                      ? 'bg-emerald-500/25 border border-emerald-500/60 text-emerald-300'
                      : 'bg-zinc-950/70 text-zinc-500 hover:bg-zinc-800'
                  } ${isSelected ? 'ring-2 ring-amber-400' : isToday ? 'ring-1 ring-amber-400/70' : ''}`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {selectedHistoryDate && (
            <div className="flex items-center justify-between text-xs text-amber-400 pt-1">
              <span>Wybrany dzień: {selectedHistoryDate}</span>
              <button
                onClick={() => setSelectedHistoryDate(null)}
                className="underline text-zinc-400 hover:text-white"
              >
                Pokaż cały miesiąc
              </button>
            </div>
          )}
        </div>

        {/* Lista wykonanych treningów w wybranym miesiącu lub dniu */}
        {loading ? (
          <div className="text-center py-8 text-zinc-500 text-sm">Ładowanie historii...</div>
        ) : filteredHistorySessions.length === 0 ? (
          <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-sm text-zinc-500">
            {selectedHistoryDate
              ? 'Brak wykonanego treningu w tym dniu.'
              : `Brak zapisanych treningów w miesiącu ${MONTHS_PL[histMonth]} ${histYear}.`}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistorySessions.map((session) => {
              const isExpanded =
                expandedHistoryId === session.id || selectedHistoryDate !== null;
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
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => setExpandedHistoryId(isExpanded ? null : session.id)}
                      className="cursor-pointer flex-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="text-base font-bold text-white">{session.name}</p>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {new Date(session.startedAt).toLocaleDateString('pl-PL')}
                        {durationMins !== null ? ` • Czas: ${durationMins} min` : ''}
                      </p>
                    </div>

                    <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-lg">
                      {session.totalVolumeKg} kg tonażu
                    </span>
                  </div>

                  {/* Przyciski Edytuj trening oraz Usuń */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSetsExercises({});
                        setEditingHistorySession(session);
                      }}
                      className="flex items-center justify-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-xs py-2 rounded-xl"
                    >
                      <Pencil className="w-3.5 h-3.5 text-amber-400" />
                      Edytuj trening
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSession(session)}
                      className="flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-xs py-2 rounded-xl"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Usuń trening
                    </button>
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
                                    className="bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg flex justify-between text-zinc-300"
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

  // --- WIDOK GŁÓWNY ZAKŁADKI TRENING: PLANY TRENINGOWE + PRZYCISK HISTORIA ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-amber-400" />
          Plany treningowe
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubView('history')}
            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-xs px-3 py-2 rounded-xl transition"
          >
            <History className="w-4 h-4 text-amber-400" />
            Historia
          </button>

          {templates.length > 0 && (
            <button
              onClick={() => setManagePlansMode(!managePlansMode)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                managePlansMode
                  ? 'bg-zinc-200 text-zinc-950'
                  : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300'
              }`}
            >
              {managePlansMode ? 'Gotowe' : 'Edytuj listę'}
            </button>
          )}

          <button
            onClick={openNewPlanForm}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-3.5 py-2 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            Nowy plan
          </button>
        </div>
      </div>

      {/* Okno potwierdzenia usunięcia planu treningowego */}
      {confirmDeleteTemplate && (
        <div className="bg-red-950/60 border border-red-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-100 space-y-1">
              <p className="font-bold text-sm text-red-300">
                Usunąć plan treningowy „{confirmDeleteTemplate.name}”?
              </p>
              <p>Wykonane wcześniej treningi pozostaną zapisane w historii.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmDeleteTemplate(null)}
              className="px-3.5 py-1.5 bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-xl"
            >
              Anuluj
            </button>
            <button
              onClick={async () => {
                await api.deleteWorkoutTemplate(confirmDeleteTemplate.id);
                setConfirmDeleteTemplate(null);
                await loadPlansAndActive();
              }}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl"
            >
              Tak, usuń plan
            </button>
          </div>
        </div>
      )}

      {/* Kreator / Edytor planu treningowego */}
      {showPlanForm && (
        <form
          onSubmit={handleSavePlan}
          className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-amber-400">
            {editingTemplateId ? 'Edytuj plan treningowy' : 'Utwórz plan treningowy'}
          </h3>

          {planFormError && (
            <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{planFormError}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Nazwa planu treningowego</label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="np. Pull / Push / Legs"
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
                  setPlanFormError(null);
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

      {/* Lista szablonów treningowych */}
      {loading ? (
        <div className="text-center py-8 text-zinc-500 text-sm">Ładowanie planów...</div>
      ) : templates.length === 0 ? (
        <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-sm text-zinc-500">
          Nie masz jeszcze żadnego planu treningowego. Kliknij „Nowy plan”, aby dodać pierwszy!
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl, idx) => {
            const isExpanded = expandedTemplateId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
              >
                <div>
                  <h3 className="font-bold text-white text-base">{tpl.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {tpl.exercises.map((e) => e.exerciseName).join(' • ')}
                  </p>
                </div>

                {/* Wyraźne przyciski pod telefon: Podgląd ćwiczeń + Edytuj plan */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedTemplateId(isExpanded ? null : tpl.id)}
                    className="flex items-center justify-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-xs py-2 rounded-xl transition"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 text-amber-400" />
                        Ukryj ćwiczenia
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 text-amber-400" />
                        Ćwiczenia ({tpl.exercises.length})
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditPlanForm(tpl)}
                    className="flex items-center justify-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-xs py-2 rounded-xl transition"
                  >
                    <Pencil className="w-3.5 h-3.5 text-amber-400" />
                    Edytuj plan
                  </button>
                </div>

                {/* Kontrolki kolejności (Pull -> Push -> Legs) i usuwania po kliknięciu "Edytuj listę" */}
                {managePlansMode && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveTemplate(idx, -1)}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-xl text-zinc-200"
                        title="Przesuń w górę"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === templates.length - 1}
                        onClick={() => moveTemplate(idx, 1)}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-xl text-zinc-200"
                        title="Przesuń w dół"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTemplate(tpl)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 font-semibold text-xs rounded-xl"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Usuń plan
                    </button>
                  </div>
                )}

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
    </div>
  );
}

function SetRow({
  set,
  isEditing,
  isHistoryEdit,
  onToggle,
  onDelete,
}: {
  set: SetLog;
  isEditing: boolean;
  isHistoryEdit: boolean;
  onToggle: (weightKg: number, reps: number) => void;
  onDelete: () => void;
}) {
  const [weight, setWeight] = useState<string>(set.weightKg ? String(set.weightKg) : '');
  const [reps, setReps] = useState<string>(set.reps ? String(set.reps) : '');
  const [savedFlash, setSavedFlash] = useState(false);

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
      <div className="col-span-3">
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
        {isEditing ? (
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center transition"
            title="Usuń tę serię"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onToggle(Number(weight) || 0, Number(reps) || 0);
              if (isHistoryEdit) {
                setSavedFlash(true);
                setTimeout(() => setSavedFlash(false), 1200);
              }
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
              savedFlash
                ? 'bg-amber-400 text-zinc-950'
                : set.isCompleted
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </div>
    </div>
  );
}