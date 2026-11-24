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
  PenLine,
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

  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabelaryczny formularz AI
  const [aiMealCategory, setAiMealCategory] = useState<string>('Śniadanie');
  const [tableRows, setTableRows] = useState<TableMealRow[]>([
    { amount: '', unit: 'g', productName: '' },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  // Zapisywanie ostatniego wyniku AI do przepisów
  const [showSaveAiRecipe, setShowSaveAiRecipe] = useState(false);
  const [aiRecipeName, setAiRecipeName] = useState('');
  const [aiRecipeServings, setAiRecipeServings] = useState(1);
  const [aiRecipeSavedMsg, setAiRecipeSavedMsg] = useState(false);

  // Ręczne dopisywanie pojedynczego produktu (bez AI)
  const [manualCategory, setManualCategory] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    mealName: '',
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
  });

  // Edycja celów (z wyborem daty od kiedy obowiązuje)
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

  const handleAiTableSubmit = async (e: React.FormEvent) => {
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
      const result = await api.estimateAndLogMeal(combinedText, isoDate, aiMealCategory);
      setLastAiResult(result);
      setAiRecipeName(result.mealName);
      setTableRows([{ amount: '', unit: 'g', productName: '' }]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd przetwarzania AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCategory || !manualForm.mealName.trim()) return;

    try {
      await api.logManualMeal({
        mealName: manualForm.mealName.trim(),
        totalCalories: Number(manualForm.totalCalories) || 0,
        totalProtein: Number(manualForm.totalProtein) || 0,
        totalCarbs: Number(manualForm.totalCarbs) || 0,
        totalFat: Number(manualForm.totalFat) || 0,
        date: `${selectedDate}T12:00:00Z`,
        mealCategory: manualCategory,
      });
      setManualCategory(null);
      setManualForm({
        mealName: '',
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
      });
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

  // Grupowanie posiłków według pory dnia (Śniadanie, Obiad, Kolacja, Przekąska + ewentualne inne)
  const groupedMeals = useMemo(() => {
    const meals = summary?.meals ?? [];
    const allCategories = [...MEAL_CATEGORIES] as string[];
    meals.forEach((m) => {
      const cat = m.mealCategory || 'Śniadanie';
      if (!allCategories.includes(cat)) {
        allCategories.push(cat);
      }
    });

    return allCategories.map((cat) => {
      const items = meals.filter(
        (m) => (m.mealCategory || 'Posiłek').toLowerCase() === cat.toLowerCase()
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

  // Wpisy bez przypisanej standardowej kategorii (stare wpisy przed migracją)
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
    <div className="space-y-5">
      {/* Nawigacja kalendarza + przycisk celu */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftDay(-1)}
              className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300"
              title="Poprzedni dzień"
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
              title="Następny dzień"
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
                className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-semibold rounded-xl transition"
              >
                Wróć do dziś
              </button>
            )}
          </div>

          <button
            onClick={() => setShowGoalEditor(!showGoalEditor)}
            className="flex items-center gap-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-xl transition"
          >
            <Target className="w-4 h-4 text-amber-400" />
            Cel
          </button>
        </div>

        {/* Rozwijany kalendarz z podświetleniem dzisiejszego dnia oraz kolorami makro */}
        {showCalendarGrid && (
          <div className="pt-2 border-t border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {[today.getFullYear(), today.getFullYear() + 1].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setCalendarYear(yr)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      calendarYear === yr
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Rok {yr}
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
                  colorClass += ' ring-1 ring-amber-400/70 font-extrabold text-amber-300';
                }

                return (
                  <button
                    key={iso}
                    onClick={() => {
                      onSelectDate(iso);
                      setShowCalendarGrid(false);
                    }}
                    title={
                      isToday
                        ? 'Dzisiaj'
                        : statusInfo && statusInfo.totalCalories > 0
                        ? `${statusInfo.totalCalories} / ${statusInfo.targetCalories} kcal`
                        : 'Brak wpisów'
                    }
                    className={`relative py-1.5 rounded-lg text-xs font-semibold transition ${colorClass}`}
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
                <span className="w-2.5 h-2.5 rounded-sm bg-zinc-800 inline-block" />
                Brak
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/40 border border-sky-500 inline-block" />
                Uzupełnione
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-500 inline-block" />
                Idealne makro (±5%)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Edytor celów makro (z wyborem daty obowiązywania) */}
      {showGoalEditor && (
        <form
          onSubmit={handleSaveGoal}
          className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-amber-400">Dzienny cel makroskładników</h3>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-400">Obowiązuje od:</span>
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
              <label className="block text-xs text-zinc-400 mb-1">Kalorie (kcal)</label>
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
              <label className="block text-xs text-zinc-400 mb-1">Węglowodany (g)</label>
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
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm px-4 py-2 rounded-xl transition"
            >
              Zapisz cele
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="bg-red-950/60 border border-red-800 text-red-200 text-sm rounded-2xl p-3.5">
          {error}
        </div>
      )}

      {/* Karta bilansu dnia */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-400">Spożyte w całym dniu</p>
            <p className="text-3xl font-bold text-white mt-0.5">
              {summary?.totalCalories ?? 0}{' '}
              <span className="text-base font-normal text-zinc-400">
                {progress ? `/ ${progress.targetCalories} kcal` : 'kcal'}
              </span>
            </p>
          </div>
          {progress && (
            <div className="text-right">
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
            </div>
          )}
        </div>

        {progress && (
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress.caloriesPercentage, 100)}%` }}
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 pt-1">
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

      {/* Tabelaryczny formularz AI */}
      <form
        onSubmit={handleAiTableSubmit}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <Sparkles className="w-4 h-4" />
            <span>Dodaj posiłek (AI + etykiety)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400">Posiłek dnia:</span>
            <select
              value={aiMealCategory}
              onChange={(e) => setAiMealCategory(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-amber-400"
            >
              {MEAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nagłówki tabeli składników */}
        <div className="grid grid-cols-12 gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-0.5">
          <div className="col-span-4">Ilość (g / ml)</div>
          <div className="col-span-7">Nazwa produktu i firma</div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-2">
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-l-xl px-2 py-2 text-xs text-center text-white focus:outline-none focus:border-amber-500"
                />
                <select
                  value={row.unit}
                  onChange={(e) => {
                    const copy = [...tableRows];
                    copy[idx].unit = e.target.value as 'g' | 'ml';
                    setTableRows(copy);
                  }}
                  className="bg-zinc-950 border-y border-r border-zinc-800 rounded-r-xl px-1.5 py-2 text-xs text-zinc-400"
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
                  placeholder="np. Serek wiejski wysokobiałkowy Piątnica"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {tableRows.length > 1 && (
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setTableRows(tableRows.filter((_, i) => i !== idx))}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                    title="Usuń pozycję"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <button
            type="button"
            onClick={() =>
              setTableRows([...tableRows, { amount: '', unit: 'g', productName: '' }])
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Dodaj kolejny składnik posiłku
          </button>
        </div>

        <button
          type="submit"
          disabled={aiLoading || tableRows.every((r) => !r.productName.trim())}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm py-2.5 rounded-xl transition"
        >
          {aiLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Szukam etykiet i liczę makro...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Oblicz i zapisz do: {aiMealCategory}
            </>
          )}
        </button>
      </form>

      {/* Podgląd wyniku AI (utrzymywany w stanie App.tsx nawet po przełączeniu zakładek) */}
      {lastAiResult && (
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Dodano ({lastAiResult.mealCategory}): {lastAiResult.mealName}
              </span>
            </div>
            <button
              onClick={() => setLastAiResult(null)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Zamknij
            </button>
          </div>

          <div className="divide-y divide-zinc-800/80 text-xs">
            {lastAiResult.items.map((item, idx) => (
              <div key={idx} className="py-1.5 flex justify-between text-zinc-300">
                <span>
                  {item.name} ({item.amountInGrams}g)
                </span>
                <span className="text-zinc-400">
                  {item.calories} kcal • B: {item.protein}g • W: {item.carbs}g • T: {item.fat}g
                </span>
              </div>
            ))}
          </div>

          {aiRecipeSavedMsg ? (
            <p className="text-xs text-emerald-300 font-semibold">
              ✓ Zapisano w zakładce „Przepisy”! (Możesz tam dopisać instrukcję przygotowania)
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
                title="Liczba porcji"
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

      {/* Podział dziennika na posiłki dnia z osobnym podsumowaniem kcal i makro */}
      <div className="space-y-3">
        {MEAL_CATEGORIES.map((category) => {
          const group = groupedMeals.find((g) => g.category === category);
          const items = group?.items ?? [];

          return (
            <div
              key={category}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">{category}</h3>
                  <p className="text-[11px] text-zinc-400">
                    <span className="text-amber-400 font-semibold">
                      {group?.calories ?? 0} kcal
                    </span>{' '}
                    • B: {group?.protein ?? 0}g • W: {group?.carbs ?? 0}g • T: {group?.fat ?? 0}g
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setManualCategory(manualCategory === category ? null : category)
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1.5 rounded-xl transition"
                  title="Dopisz ręcznie produkt bez użycia tokenów AI"
                >
                  <PenLine className="w-3 h-3 text-amber-400" />
                  + Dopisz ręcznie
                </button>
              </div>

              {/* Formularz ręcznego dopisania produktu do tej pory dnia */}
              {manualCategory === category && (
                <form
                  onSubmit={handleManualSubmit}
                  className="bg-zinc-950 border border-amber-500/30 rounded-xl p-3 space-y-2"
                >
                  <input
                    type="text"
                    value={manualForm.mealName}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, mealName: e.target.value })
                    }
                    placeholder="np. Skyr pitny Piątnica 330ml"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                  <div className="grid grid-cols-4 gap-1.5 text-center">
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
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Białko</span>
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
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Węgle</span>
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
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Tłuszcz</span>
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
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setManualCategory(null)}
                      className="text-xs text-zinc-400 hover:text-white px-2 py-1"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-3 py-1 rounded-lg"
                    >
                      Dodaj do {category}
                    </button>
                  </div>
                </form>
              )}

              {items.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">Brak wpisów w tej sekcji</p>
              ) : (
                <div className="divide-y divide-zinc-800/70">
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
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg"
                        title="Usuń wpis"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ewentualne wcześniejsze wpisy bez przypisanej pory dnia */}
        {uncategorizedMeals.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400">Pozostałe wpisy z tego dnia</h3>
            <div className="divide-y divide-zinc-800/70">
              {uncategorizedMeals.map((meal) => (
                <div key={meal.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-200">{meal.mealName}</p>
                    <p className="text-[11px] text-zinc-400">
                      {meal.totalCalories} kcal • B: {meal.totalProtein}g • W: {meal.totalCarbs}g
                      • T: {meal.totalFat}g
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteMeal(meal.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 space-y-1.5">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-bold text-zinc-100">
        {current}g
        {target !== undefined && (
          <span className="text-xs font-normal text-zinc-500"> / {target}g</span>
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