import type {
  DailyCalendarStatus,
  DailyNutritionSummary,
  EstimatedAndLoggedMealResponse,
  EstimatedItem,
  EstimatedMealResponse,
  MealLogResponse,
  RecipeResponse,
  SetLog,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/api';

const API_BASE_URL = 'https://localhost:7281/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Błąd serwera (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  // --- DIETA I AI ---
  getDailySummary: (date?: string) =>
    request<DailyNutritionSummary>(`/MealLogs/daily${date ? `?date=${date}` : ''}`),

  getMonthlyCalendarStatus: (year: number, month: number) =>
    request<DailyCalendarStatus[]>(`/MealLogs/monthly-status?year=${year}&month=${month}`),

  estimateMealOnly: (text: string) =>
    request<EstimatedMealResponse>('/Nutrition/estimate', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  estimateAndLogMeal: (text: string, date?: string, mealCategory = 'Śniadanie') =>
    request<EstimatedAndLoggedMealResponse>('/Nutrition/estimate-and-log', {
      method: 'POST',
      body: JSON.stringify({ text, date: date ?? null, mealCategory }),
    }),

  logManualMeal: (meal: {
    mealName: string;
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    date?: string;
    mealCategory: string;
  }) =>
    request<MealLogResponse>('/MealLogs', {
      method: 'POST',
      body: JSON.stringify(meal),
    }),

  deleteMealLog: (id: number) =>
    request<void>(`/MealLogs/${id}`, { method: 'DELETE' }),

  setNutritionGoal: (goal: {
    targetCalories: number;
    targetProtein: number;
    targetCarbs: number;
    targetFat: number;
    effectiveFrom?: string;
  }) =>
    request('/Goals', {
      method: 'PUT',
      body: JSON.stringify(goal),
    }),

  // --- PRZEPISY ---
  getRecipes: () => request<RecipeResponse[]>('/Recipes'),

  createRecipe: (recipe: {
    name: string;
    description?: string;
    instructions?: string;
    servings: number;
    ingredients: {
      name: string;
      amountInGrams: number;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      sectionName?: string;
    }[];
  }) =>
    request<RecipeResponse>('/Recipes', {
      method: 'POST',
      body: JSON.stringify(recipe),
    }),

  updateRecipe: (
    id: number,
    recipe: {
      name: string;
      description?: string;
      instructions?: string;
      servings: number;
      ingredients: {
        name: string;
        amountInGrams: number;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        sectionName?: string;
      }[];
    }
  ) =>
    request<RecipeResponse>(`/Recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(recipe),
    }),

  createRecipeFromAi: (payload: {
    name: string;
    description?: string;
    instructions?: string;
    servings: number;
    items: EstimatedItem[];
  }) =>
    request<RecipeResponse>('/Recipes/from-ai', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteRecipe: (id: number) =>
    request<void>(`/Recipes/${id}`, { method: 'DELETE' }),

  logMealFromRecipeCustom: (
    recipeId: number,
    payload: {
      weightOnPlateGrams?: number;
      servingsConsumed?: number;
      date?: string;
      mealCategory: string;
      ingredientOverrides?: { ingredientId: number; customAmountInGrams: number }[];
    }
  ) =>
    request<MealLogResponse>(`/MealLogs/from-recipe-custom/${recipeId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // --- TRENINGI ---
  getWorkoutTemplates: () => request<WorkoutTemplate[]>('/WorkoutTemplates'),

  createWorkoutTemplate: (template: {
    name: string;
    description?: string;
    exercises: {
      exerciseName: string;
      orderIndex: number;
      targetSets: number;
      restSeconds: number;
      notes?: string;
      muscleGroup: string;
      exerciseType: 'Strength' | 'Cardio';
    }[];
  }) =>
    request<WorkoutTemplate>('/WorkoutTemplates', {
      method: 'POST',
      body: JSON.stringify(template),
    }),

  updateWorkoutTemplate: (
    id: number,
    template: {
      name: string;
      description?: string;
      exercises: {
        exerciseName: string;
        orderIndex: number;
        targetSets: number;
        restSeconds: number;
        notes?: string;
        muscleGroup: string;
        exerciseType: 'Strength' | 'Cardio';
      }[];
    }
  ) =>
    request<WorkoutTemplate>(`/WorkoutTemplates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    }),

  deleteWorkoutTemplate: (id: number) =>
    request<void>(`/WorkoutTemplates/${id}`, { method: 'DELETE' }),

  getActiveSession: () => request<WorkoutSession>('/WorkoutSessions/active'),

  startWorkoutFromTemplate: (templateId: number) =>
    request<WorkoutSession>(`/WorkoutSessions/start/${templateId}`, {
      method: 'POST',
    }),

  updateSet: (setId: number, data: { weightKg: number; reps: number; isCompleted: boolean }) =>
    request<SetLog>(`/WorkoutSessions/sets/${setId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSet: (setId: number) =>
    request<void>(`/WorkoutSessions/sets/${setId}`, { method: 'DELETE' }),

  addSetToSession: (
    sessionId: number,
    exerciseName: string,
    restSeconds = 120,
    muscleGroup = 'Ogólne',
    exerciseType: 'Strength' | 'Cardio' = 'Strength'
  ) =>
    request<SetLog>(`/WorkoutSessions/${sessionId}/sets`, {
      method: 'POST',
      body: JSON.stringify({ exerciseName, restSeconds, muscleGroup, exerciseType }),
    }),

  removeExerciseFromSession: (sessionId: number, exerciseName: string) =>
    request<void>(
      `/WorkoutSessions/${sessionId}/exercises/${encodeURIComponent(exerciseName)}`,
      { method: 'DELETE' }
    ),

  finishSession: (sessionId: number) =>
    request<WorkoutSession>(`/WorkoutSessions/${sessionId}/finish`, {
      method: 'POST',
    }),

  deleteWorkoutSession: (sessionId: number) =>
    request<void>(`/WorkoutSessions/${sessionId}`, { method: 'DELETE' }),

  getMonthlyWorkoutDates: (year: number, month: number) =>
    request<string[]>(`/WorkoutSessions/monthly-dates?year=${year}&month=${month}`),

  addCompletedSetToHistory: (
    sessionId: number,
    payload: {
      exerciseName: string;
      muscleGroup: string;
      exerciseType: 'Strength' | 'Cardio';
      reps: number;
      weightKg: number;
    }
  ) =>
    request<WorkoutSession>(`/WorkoutSessions/${sessionId}/history-sets`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getWorkoutHistory: (year?: number, month?: number, limit = 30) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    params.set('limit', String(limit));
    return request<WorkoutSession[]>(`/WorkoutSessions/history?${params.toString()}`);
  },

  reorderWorkoutTemplates: (orderedIds: number[]) =>
    request<void>('/WorkoutTemplates/reorder', {
      method: 'PUT',
      body: JSON.stringify(orderedIds),
    }),

  reorderRecipes: (orderedIds: number[]) =>
    request<void>('/Recipes/reorder', {
      method: 'PUT',
      body: JSON.stringify(orderedIds),
    }),
};