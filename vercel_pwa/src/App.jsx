import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export default function App() {
  const meals = useLiveQuery(() => db.meals.toArray()) || [];
  
  // Staging state before user clicks "Analyze & Save Meal"
  const [selectedImage, setSelectedImage] = useState(null);
  const [mealLabel, setMealLabel] = useState('breakfast');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);

  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setCurrentAnalysis(null); // Reset previous analysis card
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeAndSave = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          mealLabel: mealLabel,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      setCurrentAnalysis(data);

      // Save complete record into Dexie
      const record = {
        name: data.food_name || mealLabel || 'Scanned Meal',
        calories: Number(data.calories) || 0,
        protein: Number(data.protein_g) || 0,
        carbs: Number(data.carbs_g) || 0,
        fat: Number(data.fat_g) || 0,
        ingredients: data.ingredients || [],
        health_benefits: data.health_benefits || [],
        cautions: data.cautions || [],
        healthier_swaps: data.healthier_swaps || [],
        image: selectedImage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      await db.meals.add(record);
    } catch (err) {
      alert(err.message || 'Error analyzing meal');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-emerald-600 text-white p-4 shadow-md flex items-center justify-center gap-2">
        <span className="text-2xl">🥗</span>
        <h1 className="text-xl font-bold">NutriTrack PWA</h1>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {/* Total Intake Overview */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
          <h2 className="text-gray-500 font-medium text-sm">Today's Total Intake</h2>
          <div className="text-4xl font-extrabold text-emerald-600 my-1">
            {totalCalories} <span className="text-lg font-normal text-gray-500">kcal</span>
          </div>
        </div>

        {/* Scan & Analyze Section (Streamlit Style) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">Scan Meal</h2>

          {!selectedImage ? (
            <label className="border-2 border-dashed border-emerald-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 transition">
              <span className="text-4xl mb-2">📷</span>
              <span className="text-sm font-semibold text-emerald-700">Upload or Take Photo</span>
              <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-gray-200 max-h-80 flex items-center justify-center bg-black">
                <img src={selectedImage} alt="Current Meal" className="object-contain w-full h-full" />
              </div>
              <p className="text-xs text-center text-gray-400">Current Meal</p>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Meal Label (e.g., Breakfast, Steamed Bun & Tea)
                </label>
                <input
                  type="text"
                  value={mealLabel}
                  onChange={(e) => setMealLabel(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none"
                  placeholder="breakfast"
                />
              </div>

              <button
                onClick={handleAnalyzeAndSave}
                disabled={isAnalyzing}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                {isAnalyzing ? '🔍 Analyzing Meal...' : '🔍 Analyze & Save Meal'}
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Analysis Display Card */}
        {currentAnalysis && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                📋 Ingredient Breakdown
              </h3>

              {/* Ingredient Table */}
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-gray-400 font-semibold">
                      <th className="py-2">Ingredient</th>
                      <th className="py-2">Weight (g)</th>
                      <th className="py-2">Protein (g)</th>
                      <th className="py-2">Carbs (g)</th>
                      <th className="py-2">Fat (g)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-700">
                    {currentAnalysis.ingredients?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-medium">{item.name}</td>
                        <td className="py-2">{item.weight_g}</td>
                        <td className="py-2">{item.protein_g}</td>
                        <td className="py-2">{item.carbs_g}</td>
                        <td className="py-2">{item.fat_g}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 p-2 bg-gray-50 rounded-lg text-xs font-semibold text-gray-700">
                Total Calories: <span className="text-emerald-600">{currentAnalysis.calories} kcal</span> | Protein: {currentAnalysis.protein_g}g | Carbs: {currentAnalysis.carbs_g}g | Fat: {currentAnalysis.fat_g}g
              </div>
            </div>

            {/* Health Benefits */}
            {currentAnalysis.health_benefits?.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2 mb-2">
                  🌱 Health Benefits
                </h4>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                  {currentAnalysis.health_benefits.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cautions */}
            {currentAnalysis.cautions?.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2 mb-2">
                  ⚠️ Who Should NOT Consume (Caution)
                </h4>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                  {currentAnalysis.cautions.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Swaps */}
            {currentAnalysis.healthier_swaps?.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2 mb-2">
                  💡 Healthier Swaps
                </h4>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                  {currentAnalysis.healthier_swaps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Logged Meals History */}
        <div className="space-y-3">
          <h2 className="font-bold text-gray-800 text-lg">Logged Meals</h2>
          {meals.map((meal) => (
            <div key={meal.id} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex gap-4 items-start">
              {meal.image && (
                <img src={meal.image} alt={meal.name} className="w-16 h-16 object-cover rounded-lg border flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-800 text-sm">{meal.name}</h3>
                  <button onClick={() => db.meals.delete(meal.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  {meal.timestamp} • <span className="font-bold text-emerald-600">{meal.calories} kcal</span>
                </p>
                <div className="grid grid-cols-3 gap-1 text-center text-[10px] bg-gray-50 p-1.5 rounded-lg">
                  <div><span className="text-gray-400 block">P</span><span className="font-bold">{meal.protein}g</span></div>
                  <div><span className="text-gray-400 block">C</span><span className="font-bold">{meal.carbs}g</span></div>
                  <div><span className="text-gray-400 block">F</span><span className="font-bold">{meal.fat}g</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}