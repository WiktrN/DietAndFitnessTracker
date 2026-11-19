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
} from 'lucide-react';
import { api } from '../services/api';
import type { RecipeResponse } from '../types/api';

interface RecipesTabProps {
  selectedDate: string;
  onMealLogged: () => void;
}

export function RecipesTab({ selectedDate, onMealLogged }: RecipesTabProps) {
  const [recipes, setRecipes] = useState<RecipeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Rozwijanie szczegółów przepisu (sekcje, makro składników, instrukcje)
  const [expandedRecipeId, setExpandedRecipeId] = useState<number | null>(null);

  // Modal / panel dodawania przepisu do dziennika z korektą gramatury (np. mniej cebuli)
  const [loggingRecipe, setLoggingRecipe] = useState<RecipeResponse | null>(null);
  const [servingsToLog, setServingsToLog] = useState<number>(1);
  const [customGrams, setCustomGrams] = useState<Record<number, number>>({});

  // Kreator nowego przepisu z sekcjami i instrukcją krok po kroku
  const [showCreator, setShowCreator] = useState(false);
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

  const openCustomLogPanel = (recipe: RecipeResponse) => {
    setLoggingRecipe(recipe);
    setServingsToLog(1);
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
        servingsConsumed: servingsToLog,
        date: `${selectedDate}T12:00:00Z`,
        ingredientOverrides: overrides,
      });

      setLoggingRecipe(null);
      setSuccessMsg(`Dodano „${loggingRecipe.name}” do dziennika (${selectedDate})!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      onMealLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać przepisu do dziennika.');
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = ingredients.filter((i) => i.name.trim() !== '');
    if (!name.trim() || valid.length === 0) return;

    try {
      await api.createRecipe({
        name: name.trim(),
        instructions: instructions.trim() || undefined,
        servings: servings > 0 ? servings : 1,
        ingredients: valid,
      });
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
      setShowCreator(false);
      await loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać przepisu.');
    }
  };

  // Obliczanie podglądu makro na żywo przy korekcie gramatury składników
  const calculatePreviewMacros = (recipe: RecipeResponse) => {
    let cal = 0,
      prot = 0,
      carbs = 0,
      fat = 0;

    recipe.ingredients.forEach((ing) => {
      const grams = customGrams[ing.id] ?? ing.amountInGrams;
      const ratio = ing.amountInGrams > 0 ? grams / ing.amountInGrams : 1;
      cal += ing.calories * ratio;
      prot += ing.protein * ratio;
      carbs += ing.carbs * ratio;
      fat += ing.fat * ratio;
    });

    const factor = servingsToLog / (recipe.servings > 0 ? recipe.servings : 1);
    return {
      calories: Math.round(cal * factor),
      protein: Math.round(prot * factor * 10) / 10,
      carbs: Math.round(carbs * factor * 10) / 10,
      fat: Math.round(fat * factor * 10) / 10,
    };
  };

  return (
    <div className="space-y-5">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-amber-400" />
          Książka przepisów
        </h2>
        <button
          onClick={() => setShowCreator(!showCreator)}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-3.5 py-2 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Nowy przepis
        </button>
      </div>

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

      {/* Kreator nowego przepisu z sekcjami i instrukcją */}
      {showCreator && (
        <form
          onSubmit={handleCreateRecipe}
          className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-400">Utwórz nowy przepis</h3>
            <button
              type="button"
              onClick={() => setShowCreator(false)}
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

          {/* Składniki z podziałem na sekcje / warstwy */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-zinc-300">
              Składniki (z podziałem na sekcje / warstwy):
            </p>
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
                    placeholder="Sekcja (np. Sos mięsno-pomidorowy, Beszamel)"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-amber-400 font-medium"
                  />
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setIngredients(ingredients.filter((_, i) => i !== idx))
                      }
                      className="text-zinc-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
                  placeholder="Nazwa składnika (np. Mięso mielone z indyka)"
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

          {/* Instrukcja przygotowania krok po kroku */}
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              Sposób przygotowania krok po kroku (opcjonalnie)
            </label>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={'1. Podsmaż mięso mielone z indyka z cebulą...\n2. Przygotuj sos beszamelowy...\n3. Układaj warstwami i piecz 35 min w 180°C.'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-100"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs px-5 py-2 rounded-xl"
            >
              Zapisz przepis
            </button>
          </div>
        </form>
      )}

      {/* Panel dodawania przepisu do dziennika z korektą gramatury */}
      {loggingRecipe && (
        <form
          onSubmit={handleConfirmCustomLog}
          className="bg-zinc-900 border border-emerald-500/40 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-400">
              Dodaj do dziennika: {loggingRecipe.name}
            </h3>
            <button
              type="button"
              onClick={() => setLoggingRecipe(null)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs">
            <span className="text-zinc-300">Ile porcji zjadłeś? (z {loggingRecipe.servings})</span>
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={servingsToLog}
              onChange={(e) => setServingsToLog(Number(e.target.value))}
              className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg py-1 text-center font-bold text-white"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] text-zinc-400">
              Dostosuj gramaturę składników dla całej potrawy (np. jeśli dałeś mniej cebuli):
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
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-2.5 text-xs text-center text-emerald-300">
                Wpadnie do dziennika: <strong>{preview.calories} kcal</strong> • B:{' '}
                {preview.protein}g • W: {preview.carbs}g • T: {preview.fat}g
              </div>
            );
          })()}

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs py-2.5 rounded-xl transition"
          >
            Zapisz w dzienniku ({selectedDate})
          </button>
        </form>
      )}

      {/* Lista zapisanych przepisów */}
      {loading ? (
        <div className="text-center py-8 text-zinc-500 text-sm">Ładowanie przepisów...</div>
      ) : recipes.length === 0 ? (
        <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-sm text-zinc-500">
          Brak zapisanych przepisów. Możesz dodać własny powyżej lub zapisać posiłek wygenerowany przez AI!
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => {
            const isExpanded = expandedRecipeId === recipe.id;
            // Grupowanie składników według sekcji (np. Sos mięsno-pomidorowy, Beszamel)
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
                <div className="flex items-start justify-between gap-2">
                  <div
                    onClick={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                    className="cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-white text-base">{recipe.name}</h3>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Całość ({recipe.servings} porcji):{' '}
                      <span className="text-amber-400 font-semibold">
                        {recipe.totalCalories} kcal
                      </span>{' '}
                      • B: {recipe.totalProtein}g • W: {recipe.totalCarbs}g • T: {recipe.totalFat}g
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      await api.deleteRecipe(recipe.id);
                      await loadRecipes();
                    }}
                    className="p-1.5 text-zinc-500 hover:text-red-400"
                    title="Usuń przepis"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Rozwijany podgląd składników (z makro każdego składnika!) i przepisu krok po kroku */}
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
                  className="w-full flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs py-2.5 rounded-xl transition"
                >
                  <CalendarPlus className="w-4 h-4 text-amber-400" />
                  Dodaj do dziennika (z opcją zmiany gramatury)
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}