import type {
  DailyCalendarStatus,
  DailyNutritionSummary,
  EstimatedAndLoggedMealResponse,
  EstimatedItem,
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

  estimateAndLogMeal: (text: string, date?: string) =>
    request<EstimatedAndLoggedMealResponse>('/Nutrition/estimate-and-log', {
      method: 'POST',
      body: JSON.stringify({ text, date: date ?? null }),
    }),

  deleteMealLog: (id: number) =>
    request<void>(`/MealLogs/${id}`, { method: 'DELETE' }),

  setNutritionGoal: (goal: {
    targetCalories: number;
    targetProtein: number;
    targetCarbs: number;
    targetFat: number;
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

  logMealFromRecipe: (recipeId: number, servingsConsumed: number) =>
    request<MealLogResponse>(`/MealLogs/from-recipe/${recipeId}`, {
      method: 'POST',
      body: JSON.stringify({ servingsConsumed }),
    }),

  logMealFromRecipeCustom: (
    recipeId: number,
    payload: {
      servingsConsumed: number;
      date?: string;
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

  getWorkoutHistory: (limit = 10) =>
    request<WorkoutSession[]>(`/WorkoutSessions/history?limit=${limit}`),
};