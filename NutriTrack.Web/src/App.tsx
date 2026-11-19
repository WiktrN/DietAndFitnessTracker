import { useState } from 'react';
import { Utensils, Dumbbell } from 'lucide-react';
import { NutritionTab } from './components/NutritionTab';
import { WorkoutTab } from './components/WorkoutTab';

type Tab = 'nutrition' | 'workout';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('nutrition');

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
        {activeTab === 'nutrition' ? <NutritionTab /> : <WorkoutTab />}
      </main>

      {/* Dolny pasek nawigacji (Mobile-First) */}
      <nav className="fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 z-20">
        <div className="max-w-xl mx-auto grid grid-cols-2">
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