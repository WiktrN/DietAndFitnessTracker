import { useEffect, useState } from 'react';
import {
  ChefHat,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  CalendarPlus,
  X,
  Pencil,
  Sparkles,
  Loader2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import type { RecipeResponse } from '../types/api';

const MEAL_CATEGORIES = ['Śniadanie', 'Obiad', 'Kolacja', 'Przekąska'];

interface RecipesTabProps {
  selectedDate: string;
  onMealLogged: () => void;
}

export function RecipesTab({ selectedDate, onMealLogged }: RecipesTabProps) {
  const [recipes, setRecipes] = useState<RecipeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [expandedRecipeId, setExpandedRecipeId] = useState<number | null>(null);

  // Tryb zarządzania listą przepisów (kolejność góra/dół + usuwanie)
  const [manageListMode, setManageListMode] = useState(false);
  const [confirmDeleteRecipe, setConfirmDeleteRecipe] = useState<RecipeResponse | null>(null);

  // Panel dodawania przepisu do dziennika
  const [loggingRecipe, setLoggingRecipe] = useState<RecipeResponse | null>(null);
  const [weightOnPlate, setWeightOnPlate] = useState<number>(300);
  const [logMealCategory, setLogMealCategory] = useState<string>('Obiad');
  const [customGrams, setCustomGrams] = useState<Record<number, number>>({});

  // Kreator i edytor zawartości przepisu
  const [showForm, setShowForm] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [aiEstimating, setAiEstimating] = useState(false);
  const [name, setName] = useState('');
  const [servings, setServings] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState([
    {
      sectionName: 'Składniki główne',
      name: '',
      amountInGrams: 100,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    },
  ]);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getRecipes();
      setRecipes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać przepisów.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  const moveRecipe = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= recipes.length) return;

    const copy = [...recipes];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setRecipes(copy);

    try {
      await api.reorderRecipes(copy.map((r) => r.id));
    } catch {
      await loadRecipes();
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteRecipe) return;
    try {
      await api.deleteRecipe(confirmDeleteRecipe.id);
      setConfirmDeleteRecipe(null);
      await loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć przepisu.');
    }
  };

  const openNewForm = () => {
    setEditingRecipeId(null);
    setName('');
    setServings(1);
    setInstructions('');
    setIngredients([
      {
        sectionName: 'Składniki główne',
        name: '',
        amountInGrams: 100,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    ]);
    setShowForm(true);
  };

  const openEditForm = (recipe: RecipeResponse) => {
    setEditingRecipeId(recipe.id);
    setName(recipe.name);
    setServings(recipe.servings || 1);
    setInstructions(recipe.instructions ?? '');
    setIngredients(
      recipe.ingredients.map((i) => ({
        sectionName: i.sectionName || 'Składniki główne',
        name: i.name,
        amountInGrams: i.amountInGrams,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
      }))
    );
    setShowForm(true);
  };

  const handleCalculateRecipeWithAi = async () => {
    const valid = ingredients.filter((i) => i.name.trim() !== '');
    if (valid.length === 0) return;

    const queryText = valid
      .map((i) => `${i.amountInGrams}g ${i.name.trim()}`)
      .join(', ');

    try {
      setAiEstimating(true);
      setError(null);
      const estimated = await api.estimateMealOnly(queryText);

      const updated = valid.map((ing, idx) => {
        const aiMatch = estimated.items[idx];
        if (!aiMatch) return ing;
        return {
          ...ing,
          calories: aiMatch.calories,
          protein: aiMatch.protein,
          carbs: aiMatch.carbs,
          fat: aiMatch.fat,
        };
      });

      setIngredients(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się obliczyć makro przez AI.');
    } finally {
      setAiEstimating(false);
    }
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = ingredients.filter((i) => i.name.trim() !== '');
    if (!name.trim() || valid.length === 0) return;

    const payload = {
      name: name.trim(),
      instructions: instructions.trim() || undefined,
      servings: servings > 0 ? servings : 1,
      ingredients: valid,
    };

    try {
      if (editingRecipeId) {
        await api.updateRecipe(editingRecipeId, payload);
      } else {
        await api.createRecipe(payload);
      }
      setShowForm(false);
      setEditingRecipeId(null);
      await loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać przepisu.');
    }
  };

  const openCustomLogPanel = (recipe: RecipeResponse) => {
    setLoggingRecipe(recipe);
    const totalBatchGrams = recipe.ingredients.reduce((s, i) => s + i.amountInGrams, 0);
    setWeightOnPlate(
      totalBatchGrams > 0 ? Math.round(totalBatchGrams / (recipe.servings || 1)) : 300
    );
    const initialMap: Record<number, number> = {};
    recipe.ingredients.forEach((ing) => {
      initialMap[ing.id] = ing.amountInGrams;
    });
    setCustomGrams(initialMap);
  };

  const handleConfirmCustomLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingRecipe) return;

    try {
      const overrides = loggingRecipe.ingredients.map((ing) => ({
        ingredientId: ing.id,
        customAmountInGrams: customGrams[ing.id] ?? ing.amountInGrams,
      }));

      await api.logMealFromRecipeCustom(loggingRecipe.id, {
        weightOnPlateGrams: weightOnPlate,
        date: `${selectedDate}T12:00:00Z`,
        mealCategory: logMealCategory,
        ingredientOverrides: overrides,
      });

      setLoggingRecipe(null);
      setSuccessMsg(`Dodano „${loggingRecipe.name}” (${weightOnPlate}g) do ${logMealCategory}!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      onMealLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać przepisu do dziennika.');
    }
  };

  const calculatePreviewMacros = (recipe: RecipeResponse) => {
    let batchGrams = 0,
      cal = 0,
      prot = 0,
      carbs = 0,
      fat = 0;

    recipe.ingredients.forEach((ing) => {
      const grams = customGrams[ing.id] ?? ing.amountInGrams;
      const ratio = ing.amountInGrams > 0 ? grams / ing.amountInGrams : 1;
      batchGrams += grams;
      cal += ing.calories * ratio;
      prot += ing.protein * ratio;
      carbs += ing.carbs * ratio;
      fat += ing.fat * ratio;
    });

    const factor = batchGrams > 0 ? weightOnPlate / batchGrams : 1;
    return {
      batchGrams: Math.round(batchGrams),
      calories: Math.round(cal * factor),
      protein: Math.round(prot * factor * 10) / 10,
      carbs: Math.round(carbs * factor * 10) / 10,
      fat: Math.round(fat * factor * 10) / 10,
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-amber-400" />
          Przepisy
        </h2>
        <div className="flex items-center gap-2">
          {recipes.length > 0 && (
            <button
              onClick={() => setManageListMode(!manageListMode)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                manageListMode
                  ? 'bg-zinc-200 text-zinc-950'
                  : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300'
              }`}
            >
              {manageListMode ? 'Gotowe' : 'Edytuj listę'}
            </button>
          )}
          <button
            onClick={openNewForm}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-3.5 py-2 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            Nowy przepis
          </button>
        </div>
      </div>

      {/* Okno potwierdzenia usunięcia przepisu */}
      {confirmDeleteRecipe && (
        <div className="bg-red-950/60 border border-red-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-100 space-y-1">
              <p className="font-bold text-sm text-red-300">
                Usunąć przepis „{confirmDeleteRecipe.name}”?
              </p>
              <p>Tej operacji nie można cofnąć (wpisy w historii jadłospisu zostaną zachowane).</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmDeleteRecipe(null)}
              className="px-3.5 py-1.5 bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-xl"
            >
              Anuluj
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl"
            >
              Tak, usuń przepis
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-3">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-xs rounded-xl p-3">
          {successMsg}
        </div>
      )}

      {/* Kreator / Edytor przepisu */}
      {showForm && (
        <form
          onSubmit={handleSaveRecipe}
          className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-400">
              {editingRecipeId ? 'Edytuj przepis' : 'Utwórz nowy przepis'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingRecipeId(null);
              }}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Anuluj
            </button>
          </div>

          <div className="grid grid-cols-12 gap-2.5">
            <div className="col-span-8">
              <label className="block text-[11px] text-zinc-400 mb-1">Nazwa potrawy</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Lasagne z indykiem"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div className="col-span-4">
              <label className="block text-[11px] text-zinc-400 mb-1">Liczba porcji</label>
              <input
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-2 text-xs text-center"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold text-zinc-300">Składniki (z sekcjami):</p>
              <button
                type="button"
                disabled={aiEstimating || ingredients.every((i) => !i.name.trim())}
                onClick={handleCalculateRecipeWithAi}
                className="inline-flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-[11px] px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                {aiEstimating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    AI liczy makro...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Oblicz makro składników przez AI
                  </>
                )}
              </button>
            </div>

            {ingredients.map((ing, idx) => (
              <div
                key={idx}
                className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={ing.sectionName}
                    onChange={(e) => {
                      const copy = [...ingredients];
                      copy[idx].sectionName = e.target.value;
                      setIngredients(copy);
                    }}
                    placeholder="Sekcja (np. Sos mięsny, Beszamel)"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-amber-400 font-medium"
                  />
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setIngredients(ingredients.filter((_, i) => i !== idx))
                      }
                      className="text-zinc-500 hover:text-red-400 p-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => {
                    const copy = [...ingredients];
                    copy[idx].name = e.target.value;
                    setIngredients(copy);
                  }}
                  placeholder="Nazwa składnika i firma"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs"
                />

                <div className="grid grid-cols-5 gap-1.5 text-center">
                  <div>
                    <span className="block text-[10px] text-zinc-500">Gramy</span>
                    <input
                      type="number"
                      value={ing.amountInGrams}
                      onChange={(e) => {
                        const copy = [...ingredients];
                        copy[idx].amountInGrams = Number(e.target.value);
                        setIngredients(copy);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-zinc-500">Kcal</span>
                    <input
                      type="number"
                      step="0.1"
                      value={ing.calories}
                      onChange={(e) => {
                        const copy = [...ingredients];
                        copy[idx].calories = Number(e.target.value);
                        setIngredients(copy);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-zinc-500">Białko</span>
                    <input
                      type="number"
                      step="0.1"
                      value={ing.protein}
                      onChange={(e) => {
                        const copy = [...ingredients];
                        copy[idx].protein = Number(e.target.value);
                        setIngredients(copy);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-zinc-500">Węgle</span>
                    <input
                      type="number"
                      step="0.1"
                      value={ing.carbs}
                      onChange={(e) => {
                        const copy = [...ingredients];
                        copy[idx].carbs = Number(e.target.value);
                        setIngredients(copy);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-zinc-500">Tłuszcz</span>
                    <input
                      type="number"
                      step="0.1"
                      value={ing.fat}
                      onChange={(e) => {
                        const copy = [...ingredients];
                        copy[idx].fat = Number(e.target.value);
                        setIngredients(copy);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-xs text-center"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setIngredients([
                  ...ingredients,
                  {
                    sectionName:
                      ingredients[ingredients.length - 1]?.sectionName || 'Składniki główne',
                    name: '',
                    amountInGrams: 100,
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0,
                  },
                ])
              }
              className="text-xs text-amber-400 hover:underline font-medium"
            >
              + Kolejny składnik
            </button>
          </div>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              Sposób przygotowania krok po kroku
            </label>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={'1. Podsmaż mięso mielone z cebulą...\n2. Przygotuj sos beszamelowy...\n3. Piecz 35 min w 180°C.'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-100"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-5 py-2.5 rounded-xl"
            >
              {editingRecipeId ? 'Zaktualizuj przepis' : 'Zapisz przepis'}
            </button>
          </div>
        </form>
      )}

      {/* Panel dodawania przepisu do jadłospisu */}
      {loggingRecipe && (
        <form
          onSubmit={handleConfirmCustomLog}
          className="bg-zinc-900 border border-emerald-500/40 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-400">
              Dodaj do jadłospisu: {loggingRecipe.name}
            </h3>
            <button
              type="button"
              onClick={() => setLoggingRecipe(null)}
              className="text-zinc-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs">
              <label className="block text-[11px] text-zinc-400 mb-1">
                Gramatura na talerzu
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={weightOnPlate}
                  onChange={(e) => setWeightOnPlate(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1.5 text-center font-bold text-white"
                />
                <span className="text-zinc-400 font-semibold">g</span>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs">
              <label className="block text-[11px] text-zinc-400 mb-1">Posiłek dnia</label>
              <select
                value={logMealCategory}
                onChange={(e) => setLogMealCategory(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1.5 px-2 font-semibold text-amber-400"
              >
                {MEAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] text-zinc-400">
              Opcjonalna korekta składników w całej potrawie:
            </p>
            {loggingRecipe.ingredients.map((ing) => (
              <div
                key={ing.id}
                className="flex items-center justify-between gap-2 bg-zinc-950/70 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs"
              >
                <span className="text-zinc-200 truncate">{ing.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min={0}
                    value={customGrams[ing.id] ?? ing.amountInGrams}
                    onChange={(e) =>
                      setCustomGrams({
                        ...customGrams,
                        [ing.id]: Number(e.target.value),
                      })
                    }
                    className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg py-1 text-center text-white"
                  />
                  <span className="text-zinc-500">g</span>
                </div>
              </div>
            ))}
          </div>

          {(() => {
            const preview = calculatePreviewMacros(loggingRecipe);
            return (
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-2.5 text-xs text-center text-emerald-300 space-y-0.5">
                <p>
                  Waga całości: <strong>{preview.batchGrams}g</strong> • Na talerzu:{' '}
                  <strong>{weightOnPlate}g</strong>
                </p>
                <p>
                  Wpadnie do {logMealCategory}: <strong>{preview.calories} kcal</strong> • B:{' '}
                  {preview.protein}g • W: {preview.carbs}g • T: {preview.fat}g
                </p>
              </div>
            );
          })()}

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs py-2.5 rounded-xl transition"
          >
            Zapisz w jadłospisie ({selectedDate})
          </button>
        </form>
      )}

      {/* Mobilne karty zapisanych przepisów z wygodnymi, dużymi przyciskami */}
      {loading ? (
        <div className="text-center py-8 text-zinc-500 text-sm">Ładowanie przepisów...</div>
      ) : recipes.length === 0 ? (
        <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-sm text-zinc-500">
          Brak zapisanych przepisów. Dodaj własny powyżej lub zapisz posiłek obliczony przez AI!
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe, idx) => {
            const isExpanded = expandedRecipeId === recipe.id;
            const totalWeight = Math.round(
              recipe.ingredients.reduce((s, i) => s + i.amountInGrams, 0)
            );
            const sections = recipe.ingredients.reduce<Record<string, typeof recipe.ingredients>>(
              (acc, ing) => {
                const key = ing.sectionName || 'Składniki główne';
                if (!acc[key]) acc[key] = [];
                acc[key].push(ing);
                return acc;
              },
              {}
            );

            return (
              <div
                key={recipe.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
              >
                <div>
                  <h3 className="font-bold text-white text-base leading-snug">{recipe.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Całość ({totalWeight}g):{' '}
                    <span className="text-amber-400 font-semibold">
                      {recipe.totalCalories} kcal
                    </span>{' '}
                    • B: {recipe.totalProtein}g • W: {recipe.totalCarbs}g • T: {recipe.totalFat}g
                  </p>
                </div>

                {/* Wyraźne, szerokie przyciski akcji dopasowane pod telefon */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                    className="flex items-center justify-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-xs py-2.5 rounded-xl transition"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 text-amber-400" />
                        Ukryj szczegóły
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 text-amber-400" />
                        Składniki i opis
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditForm(recipe)}
                    className="flex items-center justify-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-xs py-2.5 rounded-xl transition"
                  >
                    <Pencil className="w-3.5 h-3.5 text-amber-400" />
                    Edytuj przepis
                  </button>
                </div>

                {/* Kontrolki kolejności i usuwania widoczne dopiero po kliknięciu "Edytuj listę" */}
                {manageListMode && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveRecipe(idx, -1)}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-xl text-zinc-200"
                        title="Przesuń w górę"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === recipes.length - 1}
                        onClick={() => moveRecipe(idx, 1)}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-xl text-zinc-200"
                        title="Przesuń w dół"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRecipe(recipe)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 font-semibold text-xs rounded-xl"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Usuń przepis
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 space-y-3 text-xs">
                    {Object.entries(sections).map(([sectionName, items]) => (
                      <div key={sectionName} className="space-y-1.5">
                        <p className="font-bold text-amber-400 uppercase text-[11px] tracking-wider">
                          {sectionName}
                        </p>
                        <div className="divide-y divide-zinc-800/60">
                          {items.map((ing) => (
                            <div
                              key={ing.id}
                              className="py-1.5 flex items-center justify-between gap-2"
                            >
                              <span className="text-zinc-200">
                                {ing.name} ({ing.amountInGrams}g)
                              </span>
                              <span className="text-zinc-400 shrink-0">
                                {ing.calories} kcal • B: {ing.protein}g • W: {ing.carbs}g • T:{' '}
                                {ing.fat}g
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {recipe.instructions && (
                      <div className="pt-2 border-t border-zinc-800 space-y-1">
                        <p className="font-bold text-zinc-300 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                          Przygotowanie krok po kroku:
                        </p>
                        <p className="text-zinc-400 whitespace-pre-line leading-relaxed">
                          {recipe.instructions}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => openCustomLogPanel(recipe)}
                  className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs py-2.5 rounded-xl transition"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Dodaj do jadłospisu
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}