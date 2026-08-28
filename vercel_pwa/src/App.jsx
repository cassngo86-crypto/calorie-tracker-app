import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export default function App() {
  const meals = useLiveQuery(() => db.meals.toArray()) || [];

  const [selectedImage, setSelectedImage] = useState(null);
  const [mealLabel, setMealLabel] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);

  // Inspection dropdown state
  const [selectedInspectId, setSelectedInspectId] = useState('');
  
  // Batch deletion selection state
  const [selectedForDelete, setSelectedForDelete] = useState([]);

  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCurrentAnalysis(null);
    setMealLabel('');

    const reader = new FileReader();
    reader.onloadend = () => setSelectedImage(reader.result);
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

      // Read the response text once
      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errorMessage = data?.error || text || `Server error (${response.status})`;
        throw new Error(errorMessage);
      }

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
        timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      };

      const newId = await db.meals.add(record);
      setSelectedInspectId(newId.toString());
      setSelectedImage(null);
    } catch (err) {
      alert(err.message || 'Error analyzing meal');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Batch deletion handler
  const toggleDeleteSelection = (id) => {
    setSelectedForDelete((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedForDelete.length === 0) return;
    if (window.confirm(`Delete ${selectedForDelete.length} selected row(s)?`)) {
      await db.meals.bulkDelete(selectedForDelete);
      setSelectedForDelete([]);
    }
  };

  // 📥 Export Backup Function
  const handleExportBackup = async () => {
    const allMeals = await db.meals.toArray();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allMeals, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `nutritrack_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 📤 Import Restore Function
  const handleImportBackup = (event) => {
    const fileReader = new FileReader();
    if (!event.target.files[0]) return;
    
    fileReader.readAsText(event.target.files[0], "UTF-8");
    fileReader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (Array.isArray(importedData)) {
          await db.meals.clear();
          await db.meals.bulkAdd(importedData);
          alert("Backup restored successfully!");
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) {
        alert("Failed to restore backup: " + err.message);
      }
    };
  };

  // Find inspected record from dropdown or fallback to latest live analysis
  const inspectedMeal = meals.find((m) => m.id.toString() === selectedInspectId) || (currentAnalysis ? {
    name: currentAnalysis.food_name || mealLabel || 'Meal',
    ingredients: currentAnalysis.ingredients || [],
    health_benefits: currentAnalysis.health_benefits || [],
    cautions: currentAnalysis.cautions || [],
    healthier_swaps: currentAnalysis.healthier_swaps || [],
    timestamp: 'Current Scan'
  } : null);

  // Find max calories for SVG Chart scaling
  const maxCal = Math.max(...meals.map((m) => m.calories || 0), 100);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      
      {/* App Header */}
      <div style={{ backgroundColor: '#059669', color: '#ffffff', padding: '14px', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '16px' }}>
        🥗 NutriTrack PWA
      </div>

      {/* Daily Summary */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ color: '#6b7280', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Today's Total Intake</div>
        <div style={{ fontSize: '32px', fontWeight: '800', color: '#059669', margin: '4px 0' }}>
          {totalCalories} <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 'normal' }}>kcal</span>
        </div>
      </div>

      {/* 📊 Caloric Intake Trend Chart */}
      {meals.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>📊 Caloric Intake Trend</h3>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', padding: '10px 0', borderBottom: '1px solid #e5e7eb' }}>
            {meals.map((meal) => {
              const heightPercent = Math.round((meal.calories / maxCal) * 100);
              return (
                <div key={meal.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>{meal.calories}</span>
                  <div 
                    title={`${meal.name}: ${meal.calories} kcal`} 
                    style={{ width: '100%', maxWidth: '28px', height: `${heightPercent}%`, backgroundColor: '#0284c7', borderRadius: '4px 4px 0 0' }}
                  />
                  <span style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40px' }}>
                    {meal.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload/Scan Card */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>Scan Meal</h3>
        
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageSelect} 
          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', marginBottom: '12px' }} 
        />

        {selectedImage && (
          <div>
            <div style={{ width: '100%', height: '220px', backgroundColor: '#111827', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
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
              style={{ width: '100%', padding: '12px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
            >
              {isAnalyzing ? '🔍 Analyzing Meal...' : '🔍 Analyze & Save Meal'}
            </button>
          </div>
        )}
      </div>

      {/* 🔍 Inspect Detailed AI Breakdown */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>🔍 Inspect Detailed AI Breakdown</h3>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px 0' }}>Select a historical meal record to view breakdown:</p>
        
        <select 
          value={selectedInspectId} 
          onChange={(e) => setSelectedInspectId(e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '14px', backgroundColor: '#fff' }}
        >
          <option value="">-- Select a record --</option>
          {meals.map((m) => (
            <option key={m.id} value={m.id}>
              {m.timestamp} - {m.name}
            </option>
          ))}
        </select>

        {inspectedMeal && (
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
              Details for {inspectedMeal.name} ({inspectedMeal.timestamp})
            </h4>

            {/* Table */}
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
                  {inspectedMeal.ingredients?.map((item, idx) => (
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

            {/* Health Benefits */}
            {inspectedMeal.health_benefits?.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <h5 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 'bold', color: '#047857' }}>🥦 Health Benefits:</h5>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#374151' }}>
                  {inspectedMeal.health_benefits.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}

            {/* Cautions */}
            {inspectedMeal.cautions?.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <h5 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 'bold', color: '#b91c1c' }}>⚠️ Cautions:</h5>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#374151' }}>
                  {inspectedMeal.cautions.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            {/* Healthier Swaps */}
            {inspectedMeal.healthier_swaps?.length > 0 && (
              <div>
                <h5 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 'bold', color: '#d97706' }}>💡 Healthier Swaps:</h5>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#374151' }}>
                  {inspectedMeal.healthier_swaps.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ✏️ Edit / Delete Incorrect Logs Table */}
      {meals.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>✏️ Edit / Delete Incorrect Logs</h3>
          
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Delete</th>
                  <th style={{ padding: '8px' }}>Timestamp</th>
                  <th style={{ padding: '8px' }}>Meal Name</th>
                  <th style={{ padding: '8px' }}>Calories</th>
                  <th style={{ padding: '8px' }}>Protein (g)</th>
                  <th style={{ padding: '8px' }}>Carbs (g)</th>
                  <th style={{ padding: '8px' }}>Fat (g)</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedForDelete.includes(m.id)}
                        onChange={() => toggleDeleteSelection(m.id)}
                      />
                    </td>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{m.timestamp}</td>
                    <td style={{ padding: '8px', fontWeight: '600' }}>{m.name}</td>
                    <td style={{ padding: '8px' }}>{m.calories}</td>
                    <td style={{ padding: '8px' }}>{m.protein}</td>
                    <td style={{ padding: '8px' }}>{m.carbs}</td>
                    <td style={{ padding: '8px' }}>{m.fat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleBatchDelete}
            disabled={selectedForDelete.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedForDelete.length > 0 ? '#ef4444' : '#9ca3af',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: selectedForDelete.length > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            Delete Selected Rows
          </button>
        </div>
      )}

      {/* 💾 Backup & Restore Data (NEW SECTION) */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>💾 Backup & Restore Data</h3>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportBackup}
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            📥 Export Backup (JSON)
          </button>

          <label
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: '#059669',
              color: '#ffffff',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            📤 Import Restore
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

    </div>
  );
}