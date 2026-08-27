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
    setCurrentAnalysis(null);

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
      setSelectedImage(null);
    } catch (err) {
      alert(err.message || 'Error analyzing meal');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear all logged meals?")) {
      await db.meals.clear();
      setCurrentAnalysis(null);
      setSelectedImage(null);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      
      {/* Header */}
      <div style={{ backgroundColor: '#059669', color: '#ffffff', padding: '14px', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        🥗 NutriTrack PWA
      </div>

      {/* Daily Total Summary */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ color: '#6b7280', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Today's Total Intake</div>
        <div style={{ fontSize: '32px', fontWeight: '800', color: '#059669', margin: '4px 0' }}>
          {totalCalories} <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 'normal' }}>kcal</span>
        </div>
      </div>

      {/* Upload/Scan Card */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>Scan Meal</h3>
        
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageSelect} 
          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', marginBottom: '12px' }} 
        />

        {selectedImage && (
          <div>
            {/* Strictly Constrained Image Container */}
            <div style={{ width: '100%', height: '240px', backgroundColor: '#111827', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
              <img src={selectedImage} alt="Current Meal" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Meal Label (e.g., Breakfast, Steamed Bun & Tea)
              </label>
              <input
                type="text"
                value={mealLabel}
                onChange={(e) => setMealLabel(e.target.value)}
                placeholder="e.g. Breakfast"
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={handleAnalyzeAndSave}
              disabled={isAnalyzing}
              style={{ width: '100%', padding: '12px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'background-color 0.2s' }}
            >
              {isAnalyzing ? '🔍 Analyzing Meal...' : '🔍 Analyze & Save Meal'}
            </button>
          </div>
        )}
      </div>

      {/* Streamlit-Style Detailed Ingredient Table */}
      {currentAnalysis && (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>📋 Ingredient Breakdown</h3>
          
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                  <th style={{ padding: '8px' }}>Ingredient</th>
                  <th style={{ padding: '8px' }}>Weight (g)</th>
                  <th style={{ padding: '8px' }}>Protein (g)</th>
                  <th style={{ padding: '8px' }}>Carbs (g)</th>
                  <th style={{ padding: '8px' }}>Fat (g)</th>
                </tr>
              </thead>
              <tbody>
                {currentAnalysis.ingredients?.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px', fontWeight: '600' }}>{item.name}</td>
                    <td style={{ padding: '8px' }}>{item.weight_g}</td>
                    <td style={{ padding: '8px' }}>{item.protein_g}</td>
                    <td style={{ padding: '8px' }}>{item.carbs_g}</td>
                    <td style={{ padding: '8px' }}>{item.fat_g}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#065f46', fontWeight: 'bold' }}>
            Total Calories: {currentAnalysis.calories} kcal | Protein: {currentAnalysis.protein_g}g | Carbs: {currentAnalysis.carbs_g}g | Fat: {currentAnalysis.fat_g}g
          </div>
        </div>
      )}

      {/* Logged History List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>Logged Meals</h3>
          {meals.length > 0 && (
            <button onClick={handleClearHistory} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
              Clear All History
            </button>
          )}
        </div>

        {meals.map((meal) => (
          <div key={meal.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '12px', borderRadius: '10px', marginBottom: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            {meal.image && (
              <img src={meal.image} alt={meal.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meal.name}</div>
                <button onClick={() => db.meals.delete(meal.id)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '0 4px' }}>🗑️</button>
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                {meal.timestamp} • <span style={{ color: '#059669', fontWeight: 'bold' }}>{meal.calories} kcal</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}