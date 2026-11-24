export interface EstimatedItem {
  name: string;
  amountInGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface EstimatedMealResponse {
  mealName: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: EstimatedItem[];
}

export interface EstimatedAndLoggedMealResponse {
  mealLogId: number;
  date: string;
  mealCategory: string;
  mealName: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: EstimatedItem[];
}

export interface MealLogResponse {
  id: number;
  date: string;
  mealName: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  recipeId?: number | null;
  mealCategory: string;
}

export interface GoalProgress {
  targetCalories: number;
  remainingCalories: number;
  caloriesPercentage: number;
  targetProtein: number;
  remainingProtein: number;
  proteinPercentage: number;
  targetCarbs: number;
  remainingCarbs: number;
  carbsPercentage: number;
  targetFat: number;
  remainingFat: number;
  fatPercentage: number;
}

export interface DailyNutritionSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  goalProgress?: GoalProgress | null;
  meals: MealLogResponse[];
}

export interface DailyCalendarStatus {
  date: string;
  status: 'Empty' | 'Partial' | 'OnTarget';
  totalCalories: number;
  targetCalories: number;
}

export interface RecipeIngredient {
  id: number;
  name: string;
  amountInGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sectionName?: string | null;
}

export interface RecipeResponse {
  id: number;
  name: string;
  description?: string | null;
  instructions?: string | null;
  servings: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  ingredients: RecipeIngredient[];
}

// --- WORKOUT TYPES ---

export interface TemplateExercise {
  id: number;
  exerciseName: string;
  orderIndex: number;
  targetSets: number;
  restSeconds: number;
  notes?: string | null;
  muscleGroup: string;
  exerciseType: 'Strength' | 'Cardio';
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  description?: string | null;
  exercises: TemplateExercise[];
}

export interface SetLog {
  id: number;
  setNumber: number;
  previousPerformance?: string | null;
  weightKg: number;
  reps: number;
  isCompleted: boolean;
  completedAt?: string | null;
}

export interface SessionExerciseGroup {
  exerciseName: string;
  exerciseOrder: number;
  restSeconds: number;
  notes?: string | null;
  muscleGroup: string;
  exerciseType: 'Strength' | 'Cardio';
  sets: SetLog[];
}

export interface WorkoutSession {
  id: number;
  workoutTemplateId?: number | null;
  name: string;
  startedAt: string;
  finishedAt?: string | null;
  totalVolumeKg: number;
  exercises: SessionExerciseGroup[];
}