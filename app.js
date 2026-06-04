const STORAGE_KEY = "nutrition-training-pwa-v1";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = loadState();
const selectedDateInput = $("#selectedDate");
selectedDateInput.value = todayISO();

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return data || { foods: [], workouts: [] };
  } catch {
    return { foods: [], workouts: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function selectedDate() {
  return selectedDateInput.value || todayISO();
}

function formatNum(value) {
  return Math.round(value * 10) / 10;
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

/**
 * 取得「以前吃過的食物」
 * 同名食物只保留最新一次的資料
 */
function getFoodPresets() {
  const map = new Map();

  state.foods
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .forEach((food) => {
      const key = normalizeName(food.name);
      if (!key) return;
      if (map.has(key)) return;

      map.set(key, {
        name: food.name,
        amount: food.amount || "",
        calories: number(food.calories),
        protein: number(food.protein),
        carbs: number(food.carbs),
        fat: number(food.fat),
      });
    });

  return [...map.values()];
}

function findFoodPresetByName(name) {
  const key = normalizeName(name);
  if (!key) return null;

  return getFoodPresets().find((food) => normalizeName(food.name) === key) || null;
}

function applyFoodPresetByName(name) {
  const preset = findFoodPresetByName(name);
  if (!preset) return false;

  const form = $("#foodForm");

  form.elements.name.value = preset.name;
  form.elements.amount.value = preset.amount;
  form.elements.calories.value = preset.calories;
  form.elements.protein.value = preset.protein;
  form.elements.carbs.value = preset.carbs;
  form.elements.fat.value = preset.fat;

  return true;
}

function renderFoodNameOptions() {
  const datalist = $("#foodNameOptions");
  if (!datalist) return;

  const presets = getFoodPresets();
  datalist.innerHTML = "";

  presets.forEach((food) => {
    const option = document.createElement("option");
    option.value = food.name;
    option.label = `${food.amount || "未填份量"}｜${food.calories} kcal｜蛋白 ${food.protein}g`;
    datalist.appendChild(option);
  });
}

$$(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".tab").forEach((b) => b.classList.remove("active"));
    $$(".tab-panel").forEach((p) => p.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.tab}`).classList.add("active");
    render();
  });
});

selectedDateInput.addEventListener("change", render);

/**
 * 食物名稱選到以前吃過的，就自動帶入資料
 */
$("#foodForm").elements.name.addEventListener("change", (event) => {
  applyFoodPresetByName(event.target.value);
});

$("#foodForm").elements.name.addEventListener("blur", (event) => {
  applyFoodPresetByName(event.target.value);
});

$("#useLastFoodBtn")?.addEventListener("click", () => {
  const name = $("#foodForm").elements.name.value;
  const ok = applyFoodPresetByName(name);

  if (!ok) {
    alert("找不到以前吃過的同名食物。請先輸入一次，之後就可以套用。");
  }
});

$("#foodForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  state.foods.push({
    id: uid(),
    date: selectedDate(),
    meal: form.get("meal"),
    name: form.get("name").trim(),
    amount: form.get("amount").trim(),
    calories: number(form.get("calories")),
    protein: number(form.get("protein")),
    carbs: number(form.get("carbs")),
    fat: number(form.get("fat")),
    note: form.get("note").trim(),
    createdAt: new Date().toISOString(),
  });

  event.currentTarget.reset();
  saveState();
});

$("#workoutForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  state.workouts.push({
    id: uid(),
    date: selectedDate(),
    part: form.get("part"),
    name: form.get("name").trim(),
    weight: number(form.get("weight")),
    sets: number(form.get("sets")),
    reps: number(form.get("reps")),
    note: form.get("note").trim(),
    createdAt: new Date().toISOString(),
  });

  event.currentTarget.reset();
  saveState();
});

function deleteItem(type, id) {
  const key = type === "food" ? "foods" : "workouts";
  const index = state[key].findIndex((item) => item.id === id);

  if (index >= 0) {
    state[key].splice(index, 1);
    saveState();
  }
}

window.deleteItem = deleteItem;

$("#clearDateBtn").addEventListener("click", () => {
  const date = selectedDate();

  if (!confirm(`確定刪除 ${date} 的飲食與訓練紀錄？`)) return;

  state.foods = state.foods.filter((item) => item.date !== date);
  state.workouts = state.workouts.filter((item) => item.date !== date);

  saveState();
});

$("#clearAllBtn").addEventListener("click", () => {
  if (!confirm("確定清空全部資料？這個動作不能復原。")) return;

  state.foods = [];
  state.workouts = [];

  saveState();
});

$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `飲食訓練備份-${todayISO()}.json`;
  a.click();

  URL.revokeObjectURL(url);
});

$("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());

    if (!Array.isArray(imported.foods) || !Array.isArray(imported.workouts)) {
      throw new Error("格式錯誤");
    }

    if (!confirm("匯入會覆蓋目前資料，確定繼續？")) return;

    state.foods = imported.foods;
    state.workouts = imported.workouts;

    saveState();
  } catch {
    alert("匯入失敗，請確認是這個 app 匯出的 JSON 檔。");
  } finally {
    event.target.value = "";
  }
});

function render() {
  const date = selectedDate();
  const foods = state.foods.filter((item) => item.date === date);
  const workouts = state.workouts.filter((item) => item.date === date);

  $("#totalCalories").textContent = formatNum(
    foods.reduce((sum, item) => sum + item.calories, 0)
  );

  $("#totalProtein").textContent = formatNum(
    foods.reduce((sum, item) => sum + item.protein, 0)
  );

  $("#totalCarbs").textContent = formatNum(
    foods.reduce((sum, item) => sum + item.carbs, 0)
  );

  $("#totalFat").textContent = formatNum(
    foods.reduce((sum, item) => sum + item.fat, 0)
  );

  $("#totalVolume").textContent = formatNum(
    workouts.reduce((sum, item) => sum + item.weight * item.sets * item.reps, 0)
  );

  renderFoodNameOptions();
  renderFoodList(foods);
  renderWorkoutList(workouts);
  renderHistory();
}

function renderFoodList(foods) {
  const list = $("#foodList");
  list.innerHTML = "";

  if (!foods.length) {
    list.textContent = "還沒有飲食紀錄";
    return;
  }

  foods
    .slice()
    .reverse()
    .forEach((item) => {
      const el = $("#itemTemplate").content.cloneNode(true);

      el.querySelector(".item-title").textContent = `${item.meal}｜${item.name}${
        item.amount ? `（${item.amount}）` : ""
      }`;

      el.querySelector(
        ".item-meta"
      ).textContent = `${item.calories} kcal｜蛋白 ${item.protein}g｜碳水 ${item.carbs}g｜脂肪 ${item.fat}g`;

      el.querySelector(".item-note").textContent = item.note || "";
      el.querySelector(".delete-btn").onclick = () => deleteItem("food", item.id);

      list.appendChild(el);
    });
}

function renderWorkoutList(workouts) {
  const list = $("#workoutList");
  list.innerHTML = "";

  if (!workouts.length) {
    list.textContent = "還沒有訓練紀錄";
    return;
  }

  workouts
    .slice()
    .reverse()
    .forEach((item) => {
      const volume = item.weight * item.sets * item.reps;
      const el = $("#itemTemplate").content.cloneNode(true);

      el.querySelector(".item-title").textContent = `${item.part}｜${item.name}`;
      el.querySelector(
        ".item-meta"
      ).textContent = `${item.weight}kg × ${item.sets}組 × ${item.reps}下｜總量 ${formatNum(volume)}kg`;

      el.querySelector(".item-note").textContent = item.note || "";
      el.querySelector(".delete-btn").onclick = () =>
        deleteItem("workout", item.id);

      list.appendChild(el);
    });
}

function renderHistory() {
  const list = $("#historyList");

  const dates = [
    ...new Set([...state.foods, ...state.workouts].map((item) => item.date)),
  ]
    .sort()
    .reverse();

  list.innerHTML = "";

  if (!dates.length) {
    list.textContent = "尚無歷史紀錄";
    return;
  }

  dates.forEach((date) => {
    const foods = state.foods.filter((item) => item.date === date);
    const workouts = state.workouts.filter((item) => item.date === date);

    const calories = foods.reduce((sum, item) => sum + item.calories, 0);
    const protein = foods.reduce((sum, item) => sum + item.protein, 0);
    const volume = workouts.reduce(
      (sum, item) => sum + item.weight * item.sets * item.reps,
      0
    );

    const div = document.createElement("div");
    div.className = "history-day";

    div.innerHTML = `
      <h3>${date}</h3>
      <p class="muted">熱量 ${formatNum(calories)} kcal｜蛋白 ${formatNum(
      protein
    )}g｜訓練 ${workouts.length} 筆｜總量 ${formatNum(volume)}kg</p>
      <p class="muted">飲食：${foods.map((f) => f.name).join("、") || "無"}</p>
      <p class="muted">訓練：${workouts.map((w) => w.name).join("、") || "無"}</p>
    `;

    list.appendChild(div);
  });
}

let deferredPrompt;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  $("#installBtn").classList.remove("hidden");
});

$("#installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;

  deferredPrompt = null;
  $("#installBtn").classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

render();
