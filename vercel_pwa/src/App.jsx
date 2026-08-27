import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export default function App() {
  const meals = useLiveQuery(() => db.meals.toArray()) || [];
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [mealLabel, setMealLabel] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);

  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setCurrentAnalysis(null); // Clear previous output when uploading new photo
      setMealLabel('');
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
          mealLabel: mealLabel || 'Meal',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      setCurrentAnalysis(data);

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
      setSelectedImage(null); // Reset preview so new images start clean
    } catch (err) {
      alert(err.message || 'Error analyzing meal');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 font-sans max-w-xl mx-auto">
      {/* App Bar */}
      <header className="bg-emerald-600 text-white p-4 rounded-xl shadow mb-4 flex items-center justify-center gap-2">
        <span className="text-xl">🥗</span>
        <h1 className="text-lg font-bold">NutriTrack PWA</h1>
      </header>

      {/* Daily Summary */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 text-center mb-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Today's Total Intake</div>
        <div className="text-3xl font-extrabold text-emerald-600 my-1">
          {totalCalories} <span className="text-sm font-normal text-gray-500">kcal</span>
        </div>
      </div>

      {/* Input Box */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-4 space-y-4">
        <h2 className="font-bold text-gray-800 text-base">Scan Meal</h2>

        <input
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
        />

        {selectedImage && (
          <div className="space-y-3 pt-2">
            <div className="w-full h-56 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center border">
              <img src={selectedImage} alt="Preview" className="max-h-full max-w-full object-contain" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                Meal Label (e.g., Breakfast, Steamed Bun & Tea)
              </label>
              <input
                type="text"
                value={mealLabel}
                onChange={(e) => setMealLabel(e.target.value)}
                placeholder="e.g. Breakfast"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={handleAnalyzeAndSave}
              disabled={isAnalyzing}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-lg shadow transition duration-150 disabled:opacity-50"
            >
              {isAnalyzing ? '🔍 Analyzing Meal...' : '🔍 Analyze & Save Meal'}
            </button>
          </div>
        )}
      </div>

      {/* Analysis Section */}
      {currentAnalysis && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-4 space-y-4">
          <h3 className="font-bold text-gray-800 text-base flex items-center gap-1">📋 Ingredient Breakdown</h3>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-xs divide-y divide-gray-200">
              <thead className="bg-gray-50 font-semibold text-gray-700">
                <tr>
                  <th className="p-2.5">Ingredient</th>
                  <th className="p-2.5">Weight (g)</th>
                  <th className="p-2.5">Protein (g)</th>
                  <th className="p-2.5">Carbs (g)</th>
                  <th className="p-2.5">Fat (g)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {currentAnalysis.ingredients?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5 font-medium text-gray-800">{item.name}</td>
                    <td className="p-2.5 text-gray-600">{item.weight_g}</td>
                    <td className="p-2.5 text-gray-600">{item.protein_g}</td>
                    <td className="p-2.5 text-gray-600">{item.carbs_g}</td>
                    <td className="p-2.5 text-gray-600">{item.fat_g}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
            Total Calories: {currentAnalysis.calories} kcal | Protein: {currentAnalysis.protein_g}g | Carbs: {currentAnalysis.carbs_g}g | Fat: {currentAnalysis.fat_g}g
          </div>

          {currentAnalysis.health_benefits?.length > 0 && (
            <div>
              <h4 className="font-bold text-xs text-gray-700 mb-1">🌱 Health Benefits</h4>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                {currentAnalysis.health_benefits.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        <h3 className="font-bold text-gray-800 text-base">Logged Meals</h3>
        {meals.map((meal) => (
          <div key={meal.id} className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 flex gap-3 items-center">
            {meal.image && <img src={meal.image} alt={meal.name} className="w-14 h-14 object-cover rounded-lg border flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-800 text-sm truncate">{meal.name}</h4>
                <button onClick={() => db.meals.delete(meal.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
              </div>
              <p className="text-xs text-gray-500">
                {meal.timestamp} • <span className="font-bold text-emerald-600">{meal.calories} kcal</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}