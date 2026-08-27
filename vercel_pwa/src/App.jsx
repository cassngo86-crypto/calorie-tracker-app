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

  // 1. Explicitly clear past analysis instantly on new image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset current state completely for new scan
    setCurrentAnalysis(null);
    setMealLabel('');

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeAndSave = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setCurrentAnalysis(null); // Clear previous output during active scan

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
      setSelectedImage(null); // Reset file preview state
    } catch (err) {
      alert(err.message || 'Error analyzing meal');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearAllHistory = async () => {
    if (confirm("Delete all logged meal history?")) {
      await db.meals.clear();
      setCurrentAnalysis(null);
      setSelectedImage(null);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#059669', color: '#fff', padding: '12px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>🥗 NutriTrack PWA</h1>
      </div>

      {/* Daily Summary */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ color: '#6b7280', fontSize: '12px' }}>Today's Total Intake</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#059669' }}>
          {totalCalories} <span style={{ fontSize: '14px', color: '#6b7280' }}>kcal</span>
        </div>
      </div>

      {/* Scan Box */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Scan Meal</h3>
        
        <input type="file" accept="image/*" onChange={handleImageSelect} style={{ marginBottom: '12px', display: 'block' }} />

        {selectedImage && (
          <div>
            <div style={{ width: '100%', height: '220px', backgroundColor: '#f3f4f6', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', border: '1px solid #e5e7eb' }}>
              <img src={selectedImage} alt="Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            </div>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
              Meal Label (e.g., Breakfast, Steamed Bun & Tea)
            </label>
            <input
              type="text"
              value={mealLabel}
              onChange={(e) => setMealLabel(e.target.value)}
              placeholder="e.g. Breakfast"
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '12px', boxSizing: 'border-box' }}
            />

            <button
              onClick={handleAnalyzeAndSave}
              disabled={isAnalyzing}
              style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {isAnalyzing ? '🔍 Analyzing Meal...' : '🔍 Analyze & Save Meal'}
            </button>
          </div>
        )}
      </div>

      {/* Active Analysis Section (Only visible when active) */}
      {currentAnalysis && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <h3>📋 Ingredient Breakdown</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', marginBottom: '12px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '6px' }}>Ingredient</th>
                <th style={{ padding: '6px' }}>Weight (g)</th>
                <th style={{ padding: '6px' }}>Protein (g)</th>
                <th style={{ padding: '6px' }}>Carbs (g)</th>
                <th style={{ padding: '6px' }}>Fat (g)</th>
              </tr>
            </thead>
            <tbody>
              {currentAnalysis.ingredients?.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px', fontWeight: 'bold' }}>{item.name}</td>
                  <td style={{ padding: '6px' }}>{item.weight_g}</td>
                  <td style={{ padding: '6px' }}>{item.protein_g}</td>
                  <td style={{ padding: '6px' }}>{item.carbs_g}</td>
                  <td style={{ padding: '6px' }}>{item.fat_g}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '6px', fontSize: '12px', color: '#065f46', fontWeight: 'bold' }}>
            Total Calories: {currentAnalysis.calories} kcal | Protein: {currentAnalysis.protein_g}g | Carbs: {currentAnalysis.carbs_g}g | Fat: {currentAnalysis.fat_g}g
          </div>
        </div>
      )}

      {/* History List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', itemsCenter: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0 }}>Logged Meals</h3>
          {meals.length > 0 && (
            <button onClick={clearAllHistory} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>
              Clear All History
            </button>
          )}
        </div>

        {meals.map((meal) => (
          <div key={meal.id} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '12px', borderRadius: '8px', marginBottom: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            {meal.image && <img src={meal.image} alt={meal.name} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '14px' }}>{meal.name}</strong>
                <button onClick={() => db.meals.delete(meal.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>🗑️</button>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0' }}>
                {meal.timestamp} • <span style={{ color: '#059669', fontWeight: 'bold' }}>{meal.calories} kcal</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}