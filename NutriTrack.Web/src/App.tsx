import { useState } from 'react';
import { Utensils, ChefHat, Dumbbell } from 'lucide-react';
import { NutritionTab } from './components/NutritionTab';
import { RecipesTab } from './components/RecipesTab';
import { WorkoutTab } from './components/WorkoutTab';
import type { EstimatedAndLoggedMealResponse } from './types/api';

type Tab = 'recipes' | 'nutrition' | 'workout';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('nutrition');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [nutritionRefreshTrigger, setNutritionRefreshTrigger] = useState(0);
  const [lastAiResult, setLastAiResult] =
    useState<EstimatedAndLoggedMealResponse | null>(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Górny nagłówek */}
      <header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-zinc-950 font-black flex items-center justify-center text-sm">
              NT
            </div>
            <span className="font-bold tracking-tight text-white">NutriTrack</span>
          </div>
          <span className="text-xs text-zinc-500">Diet & Workout OS</span>
        </div>
      </header>

      {/* Główna treść */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-5 pb-24">
        {activeTab === 'recipes' && (
          <RecipesTab
            selectedDate={selectedDate}
            onMealLogged={() => {
              setNutritionRefreshTrigger((n) => n + 1);
              setActiveTab('nutrition');
            }}
          />
        )}
        {activeTab === 'nutrition' && (
          <NutritionTab
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            refreshTrigger={nutritionRefreshTrigger}
            lastAiResult={lastAiResult}
            setLastAiResult={setLastAiResult}
          />
        )}
        {activeTab === 'workout' && <WorkoutTab />}
      </main>

      {/* Dolny pasek nawigacji: Przepisy (lewo) • Dieta & AI (środek) • Trening (prawo) */}
      <nav className="fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 z-20">
        <div className="max-w-xl mx-auto grid grid-cols-3">
          <button
            onClick={() => setActiveTab('recipes')}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-semibold transition ${
              activeTab === 'recipes'
                ? 'text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ChefHat className="w-5 h-5" />
            <span>Przepisy</span>
          </button>

          <button
            onClick={() => setActiveTab('nutrition')}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-semibold transition ${
              activeTab === 'nutrition'
                ? 'text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Utensils className="w-5 h-5" />
            <span>Dieta & AI</span>
          </button>

          <button
            onClick={() => setActiveTab('workout')}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-semibold transition ${
              activeTab === 'workout'
                ? 'text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span>Trening</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;