import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export default function App() {
  // Dexie automatically updates the UI whenever db.meals changes
  const meals = useLiveQuery(() => db.meals.toArray()) || [];

  // Calculate total intake for display
  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);

  // Helper to extract clean numbers from API response strings/numbers
  const parseNum = (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const handleImageCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Image = reader.result;

        // Send payload matching the backend expected key (imageBase64 / image)
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64Image }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Analysis failed');
        }

        // Map response attributes to the local Dexie schema
        const newMeal = {
          name: data.food_name || 'Scanned Meal',
          calories: parseNum(data.calories),
          protein: parseNum(data.protein_g),
          carbs: parseNum(data.carbs_g),
          fat: parseNum(data.fat_g),
          image: base64Image, // Store base64 string for preview
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        // Adding to Dexie automatically triggers a re-render via useLiveQuery
        await db.meals.add(newMeal);
      } catch (err) {
        console.error('Scan Error:', err);
        alert(err.message || 'Analysis failed. Please try again.');
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDelete = async (id) => {
    if (id) {
      await db.meals.delete(id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 shadow-md flex items-center justify-center gap-2">
        <span className="text-2xl">🥗</span>
        <h1 className="text-xl font-bold">NutriTrack PWA</h1>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* Total Intake Summary Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
          <h2 className="text-gray-500 font-medium text-sm">Today's Total Intake</h2>
          <div className="text-4xl font-extrabold text-emerald-600 my-2">
            {totalCalories} <span className="text-lg font-normal text-gray-500">kcal</span>
          </div>
        </div>

        {/* Scan Food Button */}
        <div className="flex justify-center">
          <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition flex items-center gap-2">
            <span>📷</span> Scan Food Photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />
          </label>
        </div>

        {/* Logged Meals List */}
        <div className="space-y-3">
          <h2 className="font-bold text-gray-800 text-lg">Logged Meals</h2>

          {meals.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              No meals scanned yet today.
            </div>
          ) : (
            meals.map((meal) => (
              <div
                key={meal.id}
                className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex gap-4 items-start"
              >
                {/* Thumbnail Preview */}
                {meal.image && (
                  <img
                    src={meal.image}
                    alt={meal.name}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0 border border-gray-100"
                  />
                )}

                {/* Content & Macros */}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">{meal.name}</h3>
                    <button
                      onClick={() => handleDelete(meal.id)}
                      className="text-red-400 hover:text-red-600 p-1"
                      title="Delete Meal"
                    >
                      🗑️
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {meal.timestamp} •{' '}
                    <span className="font-bold text-emerald-600">{meal.calories} kcal</span>
                  </p>

                  {/* Macro Breakdown Table Grid */}
                  <div className="grid grid-cols-3 gap-1 text-center text-xs bg-gray-50 p-2 rounded-lg">
                    <div>
                      <span className="block text-gray-400">Protein</span>
                      <span className="font-semibold text-gray-700">{meal.protein}g</span>
                    </div>
                    <div>
                      <span className="block text-gray-400">Carbs</span>
                      <span className="font-semibold text-gray-700">{meal.carbs}g</span>
                    </div>
                    <div>
                      <span className="block text-gray-400">Fat</span>
                      <span className="font-semibold text-gray-700">{meal.fat}g</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}