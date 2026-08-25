import streamlit as st
from google import genai
from google.genai import types
from streamlit_local_storage import LocalStorage
from PIL import Image
import pandas as pd
import pydantic
import json
import os
from datetime import datetime, timedelta, timezone

# Singapore Timezone (UTC+8)
SGT = timezone(timedelta(hours=8))

# Page Setup
st.set_page_config(
    page_title="Smart AI Nutrition Tracker",
    page_icon="🥗",
    layout="centered",
    initial_sidebar_state="collapsed"
)

st.title("🥗 Smart AI Nutrition Tracker")

# Initialize LocalStorage manager
local_storage = LocalStorage()

# Privacy Warning Banner
st.warning("🔒 **Privacy First:** Your diet data is saved locally on this browser. Download your CSV backup regularly to avoid losing data when clearing cache!", icon="💾")

# Load existing data from browser LocalStorage into session state
raw_storage_data = local_storage.getItem("user_meal_log")

if "meal_log" not in st.session_state:
    if raw_storage_data:
        try:
            data_dict = json.loads(raw_storage_data)
            st.session_state.meal_log = pd.DataFrame(data_dict)
        except Exception:
            st.session_state.meal_log = pd.DataFrame(columns=[
                "Timestamp", "Meal Name", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Analysis"
            ])
    else:
        st.session_state.meal_log = pd.DataFrame(columns=[
            "Timestamp", "Meal Name", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Analysis"
        ])

# Helper function to save DataFrame to browser storage safely
def sync_to_local_storage():
    df_copy = st.session_state.meal_log.copy()
    if not df_copy.empty:
        df_copy["Timestamp"] = df_copy["Timestamp"].astype(str)
    df_json = df_copy.to_dict(orient="records")
    local_storage.setItem("user_meal_log", json.dumps(df_json))

# API Key Setup
api_key = None
try:
    if "GEMINI_API_KEY" in st.secrets:
        api_key = st.secrets["GEMINI_API_KEY"]
except Exception:
    pass

if not api_key:
    api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    api_key = st.text_input("Enter your Gemini API Key:", type="password")

if not api_key:
    st.info("💡 Get a free API key at [Google AI Studio](https://aistudio.google.com/).", icon="ℹ️")
    st.stop()

client = genai.Client(api_key=api_key)

# Pydantic Schema for Structured JSON Output
class Ingredient(pydantic.BaseModel):
    name: str
    portion_grams: int
    protein_g: int
    carbs_g: int
    fat_g: int

class MealAnalysis(pydantic.BaseModel):
    ingredients: list[Ingredient]
    health_benefits: list[str]
    cautions: list[str]
    healthier_swaps: list[str]

# App Navigation Tabs
tab1, tab2, tab3 = st.tabs(["📷 Scan & Log", "📊 Analytics & Filtering", "📁 Data & Backup"])

# TAB 1: SCAN & LOG MEALS
with tab1:
    input_mode = st.radio("Choose Input Method:", ("📷 Take Photo", "📁 Upload Image"), horizontal=True)

    uploaded_file = None
    if input_mode == "📷 Take Photo":
        uploaded_file = st.camera_input("Take a photo of your meal")
    else:
        uploaded_file = st.file_uploader("Choose a meal image...", type=["jpg", "jpeg", "png"])

    if uploaded_file is not None:
        image = Image.open(uploaded_file)
        st.image(image, caption="Current Meal", width='stretch')
        
        meal_name = st.text_input("Meal Label (e.g., Breakfast, Steamed Bun & Tea)", value="Meal")

        if st.button("🔍 Analyze & Save Meal", type="primary", width='stretch'):
            with st.spinner("Analyzing nutritional content..."):
                try:
                    prompt = """
                    Analyze the meal in this image using standard USDA nutrient database portion weights:
                    1. Identify each item and estimate its portion weight in grams conservatively.
                    2. Calculate protein, carbs, and fat grams for each item based on standard reference weights.
                    3. Provide health benefits, consumption cautions, and healthier swaps.
                    """

                    response = client.models.generate_content(
                        model="gemini-3.6-flash",
                        contents=[image, prompt],
                        config=types.GenerateContentConfig(
                            temperature=0.0,
                            seed=0,
                            response_mime_type="application/json",
                            response_schema=MealAnalysis,
                        )
                    )

                    analysis = MealAnalysis.model_validate_json(response.text)

                    total_protein = sum(item.protein_g for item in analysis.ingredients)
                    total_carbs = sum(item.carbs_g for item in analysis.ingredients)
                    total_fat = sum(item.fat_g for item in analysis.ingredients)
                    total_calories = (total_protein * 4) + (total_carbs * 4) + (total_fat * 9)

                    # Store timestamp with Singapore Local Time (SGT)
                    new_entry = {
                        "Timestamp": datetime.now(SGT).strftime("%Y-%m-%d %H:%M"),
                        "Meal Name": meal_name,
                        "Calories (kcal)": total_calories,
                        "Protein (g)": total_protein,
                        "Carbs (g)": total_carbs,
                        "Fat (g)": total_fat,
                        "Analysis": analysis.model_dump_json() # Store as JSON string
                    }
                    st.session_state.meal_log = pd.concat(
                        [st.session_state.meal_log, pd.DataFrame([new_entry])], 
                        ignore_index=True
                    )
                    
                    sync_to_local_storage()

                    st.success(f"✅ Logged '{meal_name}' ({total_calories} kcal) to your device storage!")
                    st.markdown("---")

                    st.subheader("📋 Ingredient Breakdown")
                    ing_df = pd.DataFrame([item.model_dump() for item in analysis.ingredients])
                    ing_df.columns = ["Ingredient", "Weight (g)", "Protein (g)", "Carbs (g)", "Fat (g)"]
                    st.table(ing_df)

                    st.markdown(f"**Total Calories:** {total_calories} kcal | **Protein:** {total_protein}g | **Carbs:** {total_carbs}g | **Fat:** {total_fat}g")

                    st.markdown("### 🌿 Health Benefits")
                    for b in analysis.health_benefits:
                        st.markdown(f"* {b}")

                    st.markdown("### ⚠️ Who Should NOT Consume (Caution)")
                    for c in analysis.cautions:
                        st.markdown(f"* {c}")

                    st.markdown("### 💡 Healthier Swaps")
                    for s in analysis.healthier_swaps:
                        st.markdown(f"* {s}")

                except Exception as e:
                    st.error(f"Error analyzing image: {e}")

# TAB 2: ANALYTICS, FILTERING & DATA INSPECTION
with tab2:
    st.subheader("📈 Nutrition Summary & Filtering")
    df = st.session_state.meal_log.copy()

    if df.empty:
        st.info("No meals logged yet. Scan a meal in Tab 1 to start tracking.")
    else:
        # Time Filter Selector
        filter_period = st.radio(
            "Select Time Horizon Filter:",
            ("Today", "Last 7 Days (Weekly)", "Last 30 Days (Monthly)", "All Time"),
            horizontal=True
        )

        now = pd.to_datetime(datetime.now(SGT))
        filtered_df = df.copy()
        
        filtered_df["dt_timestamp"] = pd.to_datetime(filtered_df["Timestamp"], errors="coerce")

        if filter_period == "Today":
            filtered_df = filtered_df[filtered_df["dt_timestamp"].dt.date == now.date()]
        elif filter_period == "Last 7 Days (Weekly)":
            cutoff = now - timedelta(days=7)
            filtered_df = filtered_df[filtered_df["dt_timestamp"] >= cutoff]
        elif filter_period == "Last 30 Days (Monthly)":
            cutoff = now - timedelta(days=30)
            filtered_df = filtered_df[filtered_df["dt_timestamp"] >= cutoff]

        # Summary Metrics
        if filtered_df.empty:
            st.warning(f"No records found for the period: '{filter_period}'")
        else:
            total_cal = filtered_df["Calories (kcal)"].sum()
            total_protein = filtered_df["Protein (g)"].sum()
            total_carbs = filtered_df["Carbs (g)"].sum()
            total_fat = filtered_df["Fat (g)"].sum()

            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Calories", f"{total_cal} kcal")
            col2.metric("Protein", f"{total_protein} g")
            col3.metric("Carbs", f"{total_carbs} g")
            col4.metric("Fat", f"{total_fat} g")

            # Chart Visualization
            st.markdown("---")
            st.subheader("📊 Caloric Intake Trend")
            
            if filter_period == "Today":
                # Categorical discrete bar chart by Meal Label & Time
                chart_df = filtered_df.copy()
                chart_df["Label"] = chart_df["Meal Name"] + " (" + chart_df["Timestamp"].str.split(" ").str[1] + ")"
                chart_data = chart_df.set_index("Label")[["Calories (kcal)"]]
                st.bar_chart(chart_data, width='stretch')
            else:
                filtered_df["Date"] = filtered_df["dt_timestamp"].dt.strftime("%Y-%m-%d")
                daily_chart = filtered_df.groupby("Date")["Calories (kcal)"].sum()
                st.bar_chart(daily_chart, width='stretch')

        # Meal Detailed Inspection Section
        st.markdown("---")
        st.subheader("🔍 Inspect Detailed AI Breakdown")
        
        meal_options = [f"{idx}: {row['Timestamp']} - {row['Meal Name']}" for idx, row in df.iterrows()]
        selected_meal_str = st.selectbox("Select a historical meal record to view breakdown:", meal_options)
        
        selected_idx = int(selected_meal_str.split(":")[0])
        selected_row = df.iloc[selected_idx]

        if "Analysis" in selected_row and pd.notna(selected_row["Analysis"]) and selected_row["Analysis"]:
            try:
                raw_analysis = selected_row["Analysis"]
                # Parse string or dict safely
                if isinstance(raw_analysis, str):
                    analysis_data = json.loads(raw_analysis)
                else:
                    analysis_data = raw_analysis

                st.markdown(f"### 📋 Details for **{selected_row['Meal Name']}** ({selected_row['Timestamp']})")
                
                ing_list = analysis_data.get("ingredients", [])
                if ing_list:
                    ing_df = pd.DataFrame(ing_list)
                    ing_df.columns = ["Ingredient", "Weight (g)", "Protein (g)", "Carbs (g)", "Fat (g)"]
                    st.table(ing_df)

                col_a, col_b = st.columns(2)
                with col_a:
                    st.markdown("**🌿 Health Benefits:**")
                    for b in analysis_data.get("health_benefits", []):
                        st.markdown(f"* {b}")
                        
                with col_b:
                    st.markdown("**⚠️ Cautions:**")
                    for c in analysis_data.get("cautions", []):
                        st.markdown(f"* {c}")

                st.markdown("**💡 Healthier Swaps:**")
                for s in analysis_data.get("healthier_swaps", []):
                    st.markdown(f"* {s}")
            except Exception as e:
                st.info("Could not render detailed AI breakdown for this historical entry.")
        else:
            st.info("No detailed AI breakdown available for this record.")

        # Deletion & Editing Section
        st.markdown("---")
        st.subheader("🗑️ Edit / Delete Incorrect Logs")
        
        display_cols = ["Timestamp", "Meal Name", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)"]
        df_for_edit = df[display_cols].copy()
        df_for_edit.insert(0, "Delete", False)

        edited_df = st.data_editor(
            df_for_edit,
            column_config={"Delete": st.column_config.CheckboxColumn(required=True)},
            disabled=display_cols,
            hide_index=True,
            width='stretch'
        )

        if st.button("❌ Delete Selected Rows", type="primary"):
            indices_to_keep = edited_df[~edited_df["Delete"]].index
            st.session_state.meal_log = df.iloc[indices_to_keep].reset_index(drop=True)
            sync_to_local_storage()
            st.success("Selected entries deleted successfully!")
            st.rerun()

# TAB 3: DATA, BACKUP & RESTORE
with tab3:
    st.subheader("💾 Backup & Restore Data")
    df = st.session_state.meal_log

    if not df.empty:
        df_export = df.copy()
        df_export["Timestamp"] = df_export["Timestamp"].astype(str)
        csv_data = df_export.to_csv(index=False).encode('utf-8')
        st.download_button(
            label="📥 Download CSV Backup",
            data=csv_data,
            file_name=f"nutrition_backup_{datetime.now(SGT).strftime('%Y%m%d')}.csv",
            mime="text/csv",
            type="primary",
            width='stretch'
        )

    st.markdown("---")
    st.subheader("📤 Restore History from CSV")
    uploaded_csv = st.file_uploader("Upload previously downloaded CSV backup:", type=["csv"])
    if uploaded_csv is not None:
        try:
            restored_df = pd.read_csv(uploaded_csv)
            restored_df["Timestamp"] = restored_df["Timestamp"].astype(str)
            st.session_state.meal_log = restored_df
            sync_to_local_storage()
            st.success("✅ Successfully restored data to your device!")
            st.rerun()
        except Exception as e:
            st.error(f"Failed to parse CSV: {e}")

    st.markdown("---")
    if st.button("🗑️ Clear Local App Storage", type="secondary"):
        st.session_state.meal_log = pd.DataFrame(columns=[
            "Timestamp", "Meal Name", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Analysis"
        ])
        local_storage.deleteItem("user_meal_log")
        st.success("App storage cleared!")
        st.rerun()