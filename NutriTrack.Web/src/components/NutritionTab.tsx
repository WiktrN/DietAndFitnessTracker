import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Trash2,
  Target,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  BookmarkPlus,
  Plus,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  DailyCalendarStatus,
  DailyNutritionSummary,
  EstimatedAndLoggedMealResponse,
} from '../types/api';

const MONTHS_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

const MEAL_CATEGORIES = ['Śniadanie', 'Obiad', 'Kolacja', 'Przekąska'] as const;

interface TableMealRow {
  amount: string;
  unit: 'g' | 'ml';
  productName: string;
}

interface NutritionTabProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  refreshTrigger: number;
  lastAiResult: EstimatedAndLoggedMealResponse | null;
  setLastAiResult: (res: EstimatedAndLoggedMealResponse | null) => void;
}

export function NutritionTab({
  selectedDate,
  onSelectDate,
  refreshTrigger,
  lastAiResult,
  setLastAiResult,
}: NutritionTabProps) {
  const today = useMemo(() => new Date(), []);
  const todayIso = today.toISOString().split('T')[0];

  const [calendarYear, setCalendarYear] = useState<number>(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(today.getMonth());
  const [showCalendarGrid, setShowCalendarGrid] = useState<boolean>(false);
  const [monthStatuses, setMonthStatuses] = useState<Record<string, DailyCalendarStatus>>({});

  // Elastyczne lata w kalendarzu (zawsze od 2026 do obecnego + 1)
  const availableYears = useMemo(() => {
    const maxYear = Math.max(today.getFullYear() + 1, 2027);
    const years: number[] = [];
    for (let y = 2026; y <= maxYear; y++) years.push(y);
    return years;
  }, [today]);

  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Aktywny formularz przypisany do konkretnej pory dnia (jak w Fitatu: '+' lub 'AI')
  const [activeEntryMode, setActiveEntryMode] = useState<{
    category: string;
    mode: 'ai' | 'manual';
  } | null>(null);

  // Tabelaryczny formularz AI
  const [tableRows, setTableRows] = useState<TableMealRow[]>([
    { amount: '', unit: 'g', productName: '' },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  // Zapisywanie ostatniego wyniku AI do przepisów
  const [showSaveAiRecipe, setShowSaveAiRecipe] = useState(false);
  const [aiRecipeName, setAiRecipeName] = useState('');
  const [aiRecipeServings, setAiRecipeServings] = useState(1);
  const [aiRecipeSavedMsg, setAiRecipeSavedMsg] = useState(false);

  // Formularz ręczny (+)
  const [manualForm, setManualForm] = useState({
    mealName: '',
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
  });

  // Edycja celów
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [goalForm, setGoalForm] = useState({
    targetCalories: 2450,
    targetProtein: 172,
    targetCarbs: 257,
    targetFat: 82,
    effectiveFrom: selectedDate,
  });

  useEffect(() => {
    setGoalForm((prev) => ({ ...prev, effectiveFrom: selectedDate }));
  }, [selectedDate]);

  useEffect(() => {
    if (lastAiResult && !aiRecipeName) {
      setAiRecipeName(lastAiResult.mealName);
    }
  }, [lastAiResult]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dailyData, statuses] = await Promise.all([
        api.getDailySummary(selectedDate),
        api
          .getMonthlyCalendarStatus(calendarYear, calendarMonth + 1)
          .catch(() => [] as DailyCalendarStatus[]),
      ]);
      setSummary(dailyData);

      const statusMap: Record<string, DailyCalendarStatus> = {};
      statuses.forEach((s) => {
        statusMap[s.date] = s;
      });
      setMonthStatuses(statusMap);

      if (dailyData.goalProgress) {
        setGoalForm((prev) => ({
          ...prev,
          targetCalories: dailyData.goalProgress!.targetCalories,
          targetProtein: dailyData.goalProgress!.targetProtein,
          targetCarbs: dailyData.goalProgress!.targetCarbs,
          targetFat: dailyData.goalProgress!.targetFat,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać danych.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, calendarYear, calendarMonth, refreshTrigger]);

  const daysInCalendarMonth = useMemo(() => {
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const iso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(
        dayNum
      ).padStart(2, '0')}`;
      return { dayNum, iso };
    });
  }, [calendarYear, calendarMonth]);

  const shiftDay = (offset: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offset);
    const nextIso = current.toISOString().split('T')[0];
    onSelectDate(nextIso);
    setCalendarYear(current.getFullYear());
    setCalendarMonth(current.getMonth());
  };

  const toggleEntryMode = (category: string, mode: 'ai' | 'manual') => {
    if (activeEntryMode?.category === category && activeEntryMode?.mode === mode) {
      setActiveEntryMode(null);
      return;
    }
    setActiveEntryMode({ category, mode });
    if (mode === 'ai') {
      setTableRows([{ amount: '', unit: 'g', productName: '' }]);
    } else {
      setManualForm({
        mealName: '',
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
      });
    }
  };

  const handleAiTableSubmit = async (e: React.FormEvent, category: string) => {
    e.preventDefault();
    const validRows = tableRows.filter((r) => r.productName.trim() !== '');
    if (validRows.length === 0) return;

    const combinedText = validRows
      .map((r) => {
        const amt = r.amount.trim() ? `${r.amount.trim()}${r.unit} ` : '';
        return `${amt}${r.productName.trim()}`;
      })
      .join(', ');

    try {
      setAiLoading(true);
      setError(null);
      setAiRecipeSavedMsg(false);
      setShowSaveAiRecipe(false);
      const isoDate = `${selectedDate}T12:00:00Z`;
      const result = await api.estimateAndLogMeal(combinedText, isoDate, category);
      setLastAiResult(result);
      setAiRecipeName(result.mealName);
      setTableRows([{ amount: '', unit: 'g', productName: '' }]);
      setActiveEntryMode(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd przetwarzania AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent, category: string) => {
    e.preventDefault();
    if (!manualForm.mealName.trim()) return;

    try {
      await api.logManualMeal({
        mealName: manualForm.mealName.trim(),
        totalCalories: Number(manualForm.totalCalories) || 0,
        totalProtein: Number(manualForm.totalProtein) || 0,
        totalCarbs: Number(manualForm.totalCarbs) || 0,
        totalFat: Number(manualForm.totalFat) || 0,
        date: `${selectedDate}T12:00:00Z`,
        mealCategory: category,
      });
      setActiveEntryMode(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać produktu.');
    }
  };

  const handleSaveAiAsRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastAiResult || !aiRecipeName.trim()) return;

    try {
      await api.createRecipeFromAi({
        name: aiRecipeName.trim(),
        servings: aiRecipeServings > 0 ? aiRecipeServings : 1,
        items: lastAiResult.items,
      });
      setShowSaveAiRecipe(false);
      setAiRecipeSavedMsg(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać przepisu.');
    }
  };

  const handleDeleteMeal = async (id: number) => {
    try {
      await api.deleteMealLog(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć posiłku.');
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.setNutritionGoal(goalForm);
      setShowGoalEditor(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać celu.');
    }
  };

  const progress = summary?.goalProgress;

  const groupedMeals = useMemo(() => {
    const meals = summary?.meals ?? [];
    return MEAL_CATEGORIES.map((cat) => {
      const items = meals.filter(
        (m) => (m.mealCategory || '').toLowerCase() === cat.toLowerCase()
      );
      return {
        category: cat,
        items,
        calories: Math.round(items.reduce((s, i) => s + i.totalCalories, 0) * 10) / 10,
        protein: Math.round(items.reduce((s, i) => s + i.totalProtein, 0) * 10) / 10,
        carbs: Math.round(items.reduce((s, i) => s + i.totalCarbs, 0) * 10) / 10,
        fat: Math.round(items.reduce((s, i) => s + i.totalFat, 0) * 10) / 10,
      };
    });
  }, [summary]);

  const uncategorizedMeals = useMemo(() => {
    const meals = summary?.meals ?? [];
    return meals.filter(
      (m) =>
        !MEAL_CATEGORIES.some(
          (c) => c.toLowerCase() === (m.mealCategory || '').toLowerCase()
        )
    );
  }, [summary]);

  return (
    <div className="space-y-4">
      {/* Pasek daty + Cel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => shiftDay(-1)}
              className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCalendarGrid(!showCalendarGrid)}
              className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-sm font-semibold text-amber-400"
            >
              {selectedDate === todayIso ? `Dzisiaj (${selectedDate})` : selectedDate}
            </button>
            <button
              onClick={() => shiftDay(1)}
              className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedDate !== todayIso && (
              <button
                onClick={() => {
                  onSelectDate(todayIso);
                  setCalendarYear(today.getFullYear());
                  setCalendarMonth(today.getMonth());
                }}
                className="px-2.5 py-1.5 bg-amber-500/15 text-amber-400 text-xs font-semibold rounded-xl"
              >
                Dziś
              </button>
            )}
          </div>

          <button
            onClick={() => setShowGoalEditor(!showGoalEditor)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-xl transition"
          >
            <Target className="w-4 h-4 text-amber-400" />
            Cel
          </button>
        </div>

        {/* Rozwijany kalendarz */}
        {showCalendarGrid && (
          <div className="pt-2 border-t border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5 flex-wrap">
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setCalendarYear(yr)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      calendarYear === yr
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
              <select
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200"
              >
                {MONTHS_PL.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {daysInCalendarMonth.map(({ dayNum, iso }) => {
                const isSelected = iso === selectedDate;
                const isToday = iso === todayIso;
                const statusInfo = monthStatuses[iso];
                const status = statusInfo?.status ?? 'Empty';

                let colorClass = 'bg-zinc-950/70 text-zinc-400 hover:bg-zinc-800';
                if (status === 'OnTarget') {
                  colorClass =
                    'bg-emerald-500/25 border border-emerald-500/60 text-emerald-300';
                } else if (status === 'Partial') {
                  colorClass = 'bg-sky-500/20 border border-sky-500/50 text-sky-300';
                }

                if (isSelected) {
                  colorClass += ' ring-2 ring-amber-400';
                } else if (isToday) {
                  colorClass += ' ring-1 ring-amber-400/80 font-extrabold text-amber-300';
                }

                return (
                  <button
                    key={iso}
                    onClick={() => {
                      onSelectDate(iso);
                      setShowCalendarGrid(false);
                    }}
                    className={`relative py-2 rounded-lg text-xs font-semibold transition ${colorClass}`}
                  >
                    {dayNum}
                    {isToday && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-zinc-400 pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm ring-1 ring-amber-400 inline-block" />
                Dzisiaj
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/40 border border-sky-500 inline-block" />
                Uzupełnione
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-500 inline-block" />
                Idealne makro
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Edytor celów makro */}
      {showGoalEditor && (
        <form
          onSubmit={handleSaveGoal}
          className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-amber-400">Dzienny cel makroskładników</h3>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-400">Od dnia:</span>
              <input
                type="date"
                value={goalForm.effectiveFrom}
                onChange={(e) => setGoalForm({ ...goalForm, effectiveFrom: e.target.value })}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Kalorie</label>
              <input
                type="number"
                value={goalForm.targetCalories}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, targetCalories: Number(e.target.value) })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Białko (g)</label>
              <input
                type="number"
                value={goalForm.targetProtein}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, targetProtein: Number(e.target.value) })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Węgle (g)</label>
              <input
                type="number"
                value={goalForm.targetCarbs}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, targetCarbs: Number(e.target.value) })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tłuszcze (g)</label>
              <input
                type="number"
                value={goalForm.targetFat}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, targetFat: Number(e.target.value) })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowGoalEditor(false)}
              className="px-3 py-2 text-xs text-zinc-400 hover:text-white"
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm px-4 py-2 rounded-xl"
            >
              Zapisz cele
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-2xl p-3">
          {error}
        </div>
      )}

      {/* Karta bilansu dnia */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3.5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-400">Bilans dnia</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-0.5">
              {summary?.totalCalories ?? 0}{' '}
              <span className="text-sm font-normal text-zinc-400">
                {progress ? `/ ${progress.targetCalories} kcal` : 'kcal'}
              </span>
            </p>
          </div>
          {progress && (
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                progress.remainingCalories >= 0
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {progress.remainingCalories >= 0
                ? `Zostało ${progress.remainingCalories} kcal`
                : `Nadwyżka ${Math.abs(progress.remainingCalories)} kcal`}
            </span>
          )}
        </div>

        {progress && (
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress.caloriesPercentage, 100)}%` }}
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          <MacroBox
            label="Białko"
            current={summary?.totalProtein ?? 0}
            target={progress?.targetProtein}
            percentage={progress?.proteinPercentage}
            color="bg-sky-400"
          />
          <MacroBox
            label="Węgle"
            current={summary?.totalCarbs ?? 0}
            target={progress?.targetCarbs}
            percentage={progress?.carbsPercentage}
            color="bg-emerald-400"
          />
          <MacroBox
            label="Tłuszcze"
            current={summary?.totalFat ?? 0}
            target={progress?.targetFat}
            percentage={progress?.fatPercentage}
            color="bg-rose-400"
          />
        </div>
      </div>

      {/* Baner ostatniego posiłku AI (z opcją zapisania w Przepisach) */}
      {lastAiResult && (
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Ostatni posiłek AI ({lastAiResult.mealCategory}): {lastAiResult.mealName}
              </span>
            </div>
            <button
              onClick={() => setLastAiResult(null)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Zamknij
            </button>
          </div>

          {aiRecipeSavedMsg ? (
            <p className="text-xs text-emerald-300 font-semibold">
              ✓ Zapisano w zakładce „Przepisy”!
            </p>
          ) : !showSaveAiRecipe ? (
            <button
              type="button"
              onClick={() => setShowSaveAiRecipe(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:underline"
            >
              <BookmarkPlus className="w-4 h-4" />
              Zapisz ten posiłek jako przepis
            </button>
          ) : (
            <form
              onSubmit={handleSaveAiAsRecipe}
              className="pt-2 border-t border-zinc-800 flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                value={aiRecipeName}
                onChange={(e) => setAiRecipeName(e.target.value)}
                placeholder="Nazwa przepisu"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs"
              />
              <input
                type="number"
                min={1}
                value={aiRecipeServings}
                onChange={(e) => setAiRecipeServings(Number(e.target.value))}
                className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1.5 text-xs text-center"
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-3.5 py-1.5 rounded-xl"
              >
                Zapisz przepis
              </button>
            </form>
          )}
        </div>
      )}

      {/* Kafelki posiłków dnia w stylu Fitatu: Śniadanie, Obiad, Kolacja, Przekąska */}
      {loading ? (
        <div className="text-center py-8 text-zinc-500 text-sm">Ładowanie jadłospisu...</div>
      ) : (
        <div className="space-y-3">
          {MEAL_CATEGORIES.map((category) => {
            const group = groupedMeals.find((g) => g.category === category);
            const items = group?.items ?? [];
            const isAiOpen =
              activeEntryMode?.category === category && activeEntryMode?.mode === 'ai';
            const isManualOpen =
              activeEntryMode?.category === category && activeEntryMode?.mode === 'manual';

            return (
              <div
                key={category}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
              >
                {/* Nagłówek sekcji posiłku + przyciski AI oraz + */}
                <div className="p-3.5 flex items-center justify-between gap-2 bg-zinc-900">
                  <div>
                    <h3 className="text-base font-bold text-white">{category}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      <span className="text-amber-400 font-semibold">
                        {group?.calories ?? 0} kcal
                      </span>{' '}
                      • B: {group?.protein ?? 0}g • W: {group?.carbs ?? 0}g • T: {group?.fat ?? 0}g
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleEntryMode(category, 'ai')}
                      className={`h-10 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                        isAiOpen
                          ? 'bg-amber-500 text-zinc-950'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400'
                      }`}
                      title={`Dodaj do ${category} za pomocą AI`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>AI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleEntryMode(category, 'manual')}
                      className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center transition ${
                        isManualOpen
                          ? 'bg-zinc-200 text-zinc-950'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                      }`}
                      title={`Dodaj produkt ręcznie do ${category}`}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Rozwijany formularz AI dla tej konkretnej pory dnia */}
                {isAiOpen && (
                  <form
                    onSubmit={(e) => handleAiTableSubmit(e, category)}
                    className="p-3.5 bg-zinc-950/90 border-t border-zinc-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-400">
                        Dodaj składniki przez AI → {category}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveEntryMode(null)}
                        className="text-zinc-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {tableRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                        <div className="col-span-4 flex">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={row.amount}
                            onChange={(e) => {
                              const copy = [...tableRows];
                              copy[idx].amount = e.target.value;
                              setTableRows(copy);
                            }}
                            placeholder="200"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-l-xl px-2 py-2 text-xs text-center text-white"
                          />
                          <select
                            value={row.unit}
                            onChange={(e) => {
                              const copy = [...tableRows];
                              copy[idx].unit = e.target.value as 'g' | 'ml';
                              setTableRows(copy);
                            }}
                            className="bg-zinc-900 border-y border-r border-zinc-800 rounded-r-xl px-1.5 py-2 text-xs text-zinc-400"
                          >
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                          </select>
                        </div>

                        <div className={tableRows.length > 1 ? 'col-span-7' : 'col-span-8'}>
                          <input
                            type="text"
                            value={row.productName}
                            onChange={(e) => {
                              const copy = [...tableRows];
                              copy[idx].productName = e.target.value;
                              setTableRows(copy);
                            }}
                            placeholder="Nazwa produktu i firma..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                          />
                        </div>

                        {tableRows.length > 1 && (
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() =>
                                setTableRows(tableRows.filter((_, i) => i !== idx))
                              }
                              className="p-1 text-zinc-500 hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setTableRows([
                            ...tableRows,
                            { amount: '', unit: 'g', productName: '' },
                          ])
                        }
                        className="text-xs font-semibold text-amber-400 hover:underline"
                      >
                        + Kolejny składnik
                      </button>

                      <button
                        type="submit"
                        disabled={aiLoading || tableRows.every((r) => !r.productName.trim())}
                        className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs px-4 py-2 rounded-xl"
                      >
                        {aiLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Liczę...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Oblicz i zapisz
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Rozwijany formularz ręczny (+) dla tej pory dnia */}
                {isManualOpen && (
                  <form
                    onSubmit={(e) => handleManualSubmit(e, category)}
                    className="p-3.5 bg-zinc-950/90 border-t border-zinc-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300">
                        Dodaj ręcznie → {category}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveEntryMode(null)}
                        className="text-zinc-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={manualForm.mealName}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, mealName: e.target.value })
                      }
                      placeholder="np. Skyr pitny Piątnica 330ml"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs"
                    />

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <span className="block text-[10px] text-zinc-500">Kcal</span>
                        <input
                          type="number"
                          step="any"
                          value={manualForm.totalCalories || ''}
                          onChange={(e) =>
                            setManualForm({
                              ...manualForm,
                              totalCalories: Number(e.target.value),
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 text-xs text-center"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-zinc-500">Białko (g)</span>
                        <input
                          type="number"
                          step="any"
                          value={manualForm.totalProtein || ''}
                          onChange={(e) =>
                            setManualForm({
                              ...manualForm,
                              totalProtein: Number(e.target.value),
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 text-xs text-center"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-zinc-500">Węgle (g)</span>
                        <input
                          type="number"
                          step="any"
                          value={manualForm.totalCarbs || ''}
                          onChange={(e) =>
                            setManualForm({
                              ...manualForm,
                              totalCarbs: Number(e.target.value),
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 text-xs text-center"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-zinc-500">Tłuszcz (g)</span>
                        <input
                          type="number"
                          step="any"
                          value={manualForm.totalFat || ''}
                          onChange={(e) =>
                            setManualForm({
                              ...manualForm,
                              totalFat: Number(e.target.value),
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 text-xs text-center"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs px-4 py-2 rounded-xl"
                      >
                        Zapisz w {category}
                      </button>
                    </div>
                  </form>
                )}

                {/* Lista produktów zapisanych w tej porze dnia */}
                {items.length > 0 && (
                  <div className="px-3.5 pb-2.5 pt-1 border-t border-zinc-800/70 divide-y divide-zinc-800/60">
                    {items.map((meal) => (
                      <div
                        key={meal.id}
                        className="py-2 flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-medium text-zinc-200">{meal.mealName}</p>
                          <p className="text-[11px] text-zinc-400">
                            {meal.totalCalories} kcal • B: {meal.totalProtein}g • W:{' '}
                            {meal.totalCarbs}g • T: {meal.totalFat}g
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteMeal(meal.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 rounded-lg"
                          title="Usuń pozycję"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {uncategorizedMeals.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
              <h3 className="text-xs font-semibold text-zinc-400">Inne wpisy</h3>
              <div className="divide-y divide-zinc-800/60">
                {uncategorizedMeals.map((meal) => (
                  <div key={meal.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{meal.mealName}</p>
                      <p className="text-[11px] text-zinc-400">
                        {meal.totalCalories} kcal • B: {meal.totalProtein}g • W:{' '}
                        {meal.totalCarbs}g • T: {meal.totalFat}g
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteMeal(meal.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MacroBox({
  label,
  current,
  target,
  percentage,
  color,
}: {
  label: string;
  current: number;
  target?: number;
  percentage?: number;
  color: string;
}) {
  return (
    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-2.5 space-y-1">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className="text-xs sm:text-sm font-bold text-zinc-100">
        {current}g
        {target !== undefined && (
          <span className="text-[11px] font-normal text-zinc-500"> / {target}g</span>
        )}
      </p>
      {percentage !== undefined && (
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}