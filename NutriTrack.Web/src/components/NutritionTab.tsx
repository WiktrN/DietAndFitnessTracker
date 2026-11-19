import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Trash2,
  Target,
  ChefHat,
  Loader2,
  CheckCircle2,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  DailyNutritionSummary,
  EstimatedAndLoggedMealResponse,
  RecipeResponse,
} from '../types/api';

const MONTHS_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

export function NutritionTab() {
  const today = useMemo(() => new Date(), []);
  const todayIso = today.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [calendarYear, setCalendarYear] = useState<number>(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(today.getMonth());
  const [showCalendarGrid, setShowCalendarGrid] = useState<boolean>(false);

  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [recipes, setRecipes] = useState<RecipeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Input
  const [mealText, setMealText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [lastAiResult, setLastAiResult] =
    useState<EstimatedAndLoggedMealResponse | null>(null);

  // Edycja celów
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [goalForm, setGoalForm] = useState({
    targetCalories: 2450,
    targetProtein: 172,
    targetCarbs: 257,
    targetFat: 82,
  });

  // Dodawanie z przepisu & Kreator nowego przepisu
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | ''>('');
  const [servingsConsumed, setServingsConsumed] = useState<number>(1);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [showRecipeCreator, setShowRecipeCreator] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeServings, setNewRecipeServings] = useState(1);
  const [newIngredients, setNewIngredients] = useState([
    { name: '', amountInGrams: 100, calories: 0, protein: 0, carbs: 0, fat: 0 },
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dailyData, recipesData] = await Promise.all([
        api.getDailySummary(selectedDate),
        api.getRecipes().catch(() => [] as RecipeResponse[]),
      ]);
      setSummary(dailyData);
      setRecipes(recipesData);

      if (dailyData.goalProgress) {
        setGoalForm({
          targetCalories: dailyData.goalProgress.targetCalories,
          targetProtein: dailyData.goalProgress.targetProtein,
          targetCarbs: dailyData.goalProgress.targetCarbs,
          targetFat: dailyData.goalProgress.targetFat,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać danych.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

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
    setSelectedDate(nextIso);
    setCalendarYear(current.getFullYear());
    setCalendarMonth(current.getMonth());
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealText.trim()) return;

    try {
      setAiLoading(true);
      setError(null);
      const isoDate = `${selectedDate}T12:00:00Z`;
      const result = await api.estimateAndLogMeal(mealText.trim(), isoDate);
      setLastAiResult(result);
      setMealText('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd przetwarzania AI.');
    } finally {
      setAiLoading(false);
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

  const handleLogFromRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId) return;

    try {
      setRecipeLoading(true);
      await api.logMealFromRecipe(Number(selectedRecipeId), servingsConsumed);
      setSelectedRecipeId('');
      setServingsConsumed(1);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd dodawania przepisu.');
    } finally {
      setRecipeLoading(false);
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = newIngredients.filter((i) => i.name.trim() !== '');
    if (!newRecipeName.trim() || valid.length === 0) return;

    try {
      await api.createRecipe({
        name: newRecipeName.trim(),
        servings: newRecipeServings > 0 ? newRecipeServings : 1,
        ingredients: valid,
      });
      setNewRecipeName('');
      setNewRecipeServings(1);
      setNewIngredients([
        { name: '', amountInGrams: 100, calories: 0, protein: 0, carbs: 0, fat: 0 },
      ]);
      setShowRecipeCreator(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać przepisu.');
    }
  };

  const progress = summary?.goalProgress;

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
          </div>

          <button
            onClick={() => setShowGoalEditor(!showGoalEditor)}
            className="flex items-center gap-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-xl transition"
          >
            <Target className="w-4 h-4 text-amber-400" />
            Cel
          </button>
        </div>

        {/* Rozwijana tabela kalendarza (2026 / 2027) */}
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
                return (
                  <button
                    key={iso}
                    onClick={() => {
                      setSelectedDate(iso);
                      setShowCalendarGrid(false);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950'
                        : isToday
                        ? 'border border-amber-500/60 text-amber-400 bg-zinc-950'
                        : 'bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
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
          <h3 className="text-sm font-semibold text-amber-400">Dzienny cel makroskładników</h3>
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
            <p className="text-xs uppercase tracking-wider text-zinc-400">Spożyte</p>
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

      {/* Formularz AI */}
      <form
        onSubmit={handleAiSubmit}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <Sparkles className="w-4 h-4" />
          <span>Dodaj posiłek opisem (AI + etykiety)</span>
        </div>
        <textarea
          rows={2}
          value={mealText}
          onChange={(e) => setMealText(e.target.value)}
          placeholder="np. 200g serek wiejski wysokobiałkowy Piątnica, 2 kajzerki i 150g piersi z kurczaka..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={aiLoading || !mealText.trim()}
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
              Oblicz i zapisz do dziennika
            </>
          )}
        </button>
      </form>

      {/* Podgląd ostatnio dodanego posiłku przez AI */}
      {lastAiResult && (
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Dodano: {lastAiResult.mealName}</span>
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
        </div>
      )}

      {/* Zapisane przepisy + Kreator przepisu */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <ChefHat className="w-4 h-4 text-amber-400" />
            <span>Zapisane przepisy</span>
          </div>
          <button
            type="button"
            onClick={() => setShowRecipeCreator(!showRecipeCreator)}
            className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {showRecipeCreator ? 'Ukryj kreator' : 'Nowy przepis'}
          </button>
        </div>

        {/* Formularz wyboru przepisu dopasowany do szerokości karty */}
        <form onSubmit={handleLogFromRecipe} className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedRecipeId}
            onChange={(e) =>
              setSelectedRecipeId(e.target.value ? Number(e.target.value) : '')
            }
            className="w-full min-w-0 flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 truncate"
          >
            <option value="">-- Wybierz przepis ({recipes.length}) --</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({Math.round(r.totalCalories / (r.servings || 1))} kcal / porcję)
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={servingsConsumed}
              onChange={(e) => setServingsConsumed(Number(e.target.value))}
              className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-2 text-sm text-center"
              title="Liczba porcji"
            />
            <button
              type="submit"
              disabled={!selectedRecipeId || recipeLoading}
              className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              Dodaj
            </button>
          </div>
        </form>

        {/* Kreator nowego przepisu */}
        {showRecipeCreator && (
          <form
            onSubmit={handleCreateRecipe}
            className="pt-3 border-t border-zinc-800 space-y-3"
          >
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8">
                <label className="block text-[11px] text-zinc-400 mb-1">Nazwa przepisu</label>
                <input
                  type="text"
                  value={newRecipeName}
                  onChange={(e) => setNewRecipeName(e.target.value)}
                  placeholder="np. Makaron ze szpinakiem i kurczakiem"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs"
                />
              </div>
              <div className="col-span-4">
                <label className="block text-[11px] text-zinc-400 mb-1">Liczba porcji</label>
                <input
                  type="number"
                  min={1}
                  value={newRecipeServings}
                  onChange={(e) => setNewRecipeServings(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1.5 text-xs text-center"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-zinc-400">
                Składniki (wartości dla podanej gramatury):
              </p>
              {newIngredients.map((ing, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => {
                        const copy = [...newIngredients];
                        copy[idx].name = e.target.value;
                        setNewIngredients(copy);
                      }}
                      placeholder="Składnik (np. Pierś z kurczaka)"
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs"
                    />
                    {newIngredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setNewIngredients(newIngredients.filter((_, i) => i !== idx))
                        }
                        className="text-zinc-500 hover:text-red-400 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    <div>
                      <span className="block text-[10px] text-zinc-500">Gramy</span>
                      <input
                        type="number"
                        value={ing.amountInGrams}
                        onChange={(e) => {
                          const copy = [...newIngredients];
                          copy[idx].amountInGrams = Number(e.target.value);
                          setNewIngredients(copy);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Kcal</span>
                      <input
                        type="number"
                        value={ing.calories}
                        onChange={(e) => {
                          const copy = [...newIngredients];
                          copy[idx].calories = Number(e.target.value);
                          setNewIngredients(copy);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Białko</span>
                      <input
                        type="number"
                        value={ing.protein}
                        onChange={(e) => {
                          const copy = [...newIngredients];
                          copy[idx].protein = Number(e.target.value);
                          setNewIngredients(copy);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Węgle</span>
                      <input
                        type="number"
                        value={ing.carbs}
                        onChange={(e) => {
                          const copy = [...newIngredients];
                          copy[idx].carbs = Number(e.target.value);
                          setNewIngredients(copy);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Tłuszcz</span>
                      <input
                        type="number"
                        value={ing.fat}
                        onChange={(e) => {
                          const copy = [...newIngredients];
                          copy[idx].fat = Number(e.target.value);
                          setNewIngredients(copy);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
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
                  setNewIngredients([
                    ...newIngredients,
                    { name: '', amountInGrams: 100, calories: 0, protein: 0, carbs: 0, fat: 0 },
                  ])
                }
                className="text-xs text-amber-400 hover:underline"
              >
                + Kolejny składnik
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecipeCreator(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-4 py-1.5 rounded-xl"
                >
                  Zapisz przepis
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Lista posiłków z wybranego dnia */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-semibold text-zinc-400 px-1">
          Posiłki w dzienniku ({summary?.meals.length ?? 0})
        </h3>
        {loading ? (
          <div className="text-center py-8 text-zinc-500 text-sm">Ładowanie dziennika...</div>
        ) : summary?.meals.length === 0 ? (
          <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-sm text-zinc-500">
            Brak zapisanych posiłków dla tego dnia.
          </div>
        ) : (
          summary?.meals.map((meal) => (
            <div
              key={meal.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <p className="font-medium text-zinc-100 text-sm">{meal.mealName}</p>
                <p className="text-xs text-zinc-400">
                  <span className="text-amber-400 font-semibold">{meal.totalCalories} kcal</span> • B:{' '}
                  {meal.totalProtein}g • W: {meal.totalCarbs}g • T: {meal.totalFat}g
                </p>
              </div>
              <button
                onClick={() => handleDeleteMeal(meal.id)}
                className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition"
                title="Usuń posiłek"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
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