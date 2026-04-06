// ── Constants ──────────────────────────────────────────────────────────────
const MEAL_COLORS = {
  Breakfast: '#0071e3',
  Lunch:     '#30d158',
  Snack:     '#ff9f0a',
  Dinner:    '#bf5af2'
};
const MEALS    = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
const UNIT_DIV = { g: 100, ml: 100, unit: 1 };
const UNIT_DEF = { g: 100, ml: 250, unit: 1 };

const DEFAULT_FOODS = [
  { name: 'Chicken breast (cooked)', kcal: 165, prot: 31,   carbs: 0,   fats: 3.6,  fibre: 0,    unit: 'g'    },
  { name: 'Soya chunks (cooked)',    kcal: 116, prot: 16.6, carbs: 10,  fats: 0.5,  fibre: 0.6,  unit: 'g'    },
  { name: 'Egg',                     kcal: 78,  prot: 6.5,  carbs: 0.6, fats: 5.3,  fibre: 0,    unit: 'unit' },
  { name: 'Paneer',                  kcal: 265, prot: 18,   carbs: 3.6, fats: 20.8, fibre: 0,    unit: 'g'    },
  { name: 'Milk (toned)',            kcal: 60,  prot: 3.2,  carbs: 5,   fats: 1.5,  fibre: 0,    unit: 'ml'   },
  { name: 'Curd',                    kcal: 58,  prot: 3.3,  carbs: 4.7, fats: 1.5,  fibre: 0,    unit: 'g'    },
  { name: 'Dal (cooked)',            kcal: 116, prot: 7.2,  carbs: 20,  fats: 0.4,  fibre: 7.9,  unit: 'g'    },
  { name: 'Oats',                    kcal: 389, prot: 16.9, carbs: 66,  fats: 6.9,  fibre: 10.6, unit: 'g'    },
  { name: 'Roti',                    kcal: 106, prot: 3.5,  carbs: 18,  fats: 2.8,  fibre: 2.7,  unit: 'unit' },
  { name: 'White rice (cooked)',     kcal: 130, prot: 2.4,  carbs: 28,  fats: 0.3,  fibre: 0.4,  unit: 'g'    },
  { name: 'Poha (cooked)',           kcal: 110, prot: 2.3,  carbs: 23,  fats: 0.5,  fibre: 0.6,  unit: 'g'    },
  { name: 'Banana',                  kcal: 89,  prot: 1.1,  carbs: 23,  fats: 0.3,  fibre: 2.6,  unit: 'unit' },
  { name: 'Orange',                  kcal: 62,  prot: 1.2,  carbs: 15,  fats: 0.2,  fibre: 3.1,  unit: 'unit' },
  { name: 'Kiwi',                    kcal: 55,  prot: 1.1,  carbs: 13,  fats: 0.5,  fibre: 3,    unit: 'unit' },
  { name: 'Peanut butter',           kcal: 588, prot: 25,   carbs: 20,  fats: 50,   fibre: 6,    unit: 'g'    },
  { name: 'Almonds',                 kcal: 579, prot: 21,   carbs: 22,  fats: 50,   fibre: 12.5, unit: 'g'    },
  { name: 'Whey protein',            kcal: 120, prot: 24,   carbs: 3,   fats: 1.5,  fibre: 0,    unit: 'unit' },
];

// ── State ───────────────────────────────────────────────────────────────────
let sb = null;
let foodDB = [];
let dayLog = {};
let currentDate = todayStr();
let goals   = { kcal: 2000, prot: 150, carbs: 250, fats: 70, fibre: 30 };
let profile = { height: 178, weight: 83, age: 28, sex: 'male', activity: 1.2, goalOffset: 0 };
let saveTimers = {};
let calViewDate = null;

// ── Config ──────────────────────────────────────────────────────────────────
function loadConfig() { return { url: localStorage.getItem('sb_url'), key: localStorage.getItem('sb_key') }; }

async function saveConfig() {
  const url = document.getElementById('cfg-url').value.trim();
  const key = document.getElementById('cfg-key').value.trim();
  const err = document.getElementById('setup-error');
  err.style.display = 'none';
  if (!url || !key) { err.textContent = 'Both fields are required.'; err.style.display = 'block'; return; }
  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  try {
    await initSupabase(url, key);
    await seedFoods();
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await loadAll();
  } catch (e) {
    err.textContent = 'Could not connect: ' + e.message;
    err.style.display = 'block';
  }
}

function resetConfig() {
  if (!confirm('Reset database connection?')) return;
  localStorage.removeItem('sb_url');
  localStorage.removeItem('sb_key');
  location.reload();
}

async function initSupabase(url, key) {
  sb = supabase.createClient(url, key);
  const { error } = await sb.from('food_db').select('id').limit(1);
  if (error) throw new Error(error.message);
  // weight_log is optional — ignore error if table doesn't exist yet
  await sb.from('weight_log').select('id').limit(1);
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDate(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDay(s) {
  const today = todayStr();
  if (s === today) return 'Today';
  const yD = new Date(); yD.setDate(yD.getDate()-1);
  if (s === dateStr(yD)) return 'Yesterday';
  return parseDate(s).toLocaleDateString('en-IN', { weekday: 'long' });
}
function fmtDateLong(s) {
  return parseDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
function changeDay(delta) {
  const d = parseDate(currentDate); d.setDate(d.getDate()+delta);
  currentDate = dateStr(d);
  loadDayLog();
}
function goToday() { currentDate = todayStr(); loadDayLog(); }
function overlayClose(e, id) { if (e.target === e.currentTarget) closePanel(id); }

// ── Food helpers ─────────────────────────────────────────────────────────────
function getFood(name) { return foodDB.find(f => f.name === name); }

function calcRow(name, qty) {
  const f = getFood(name);
  if (!f || qty === '' || isNaN(parseFloat(qty))) return { kcal:null, prot:null, carbs:null, fats:null, fibre:null };
  const q = parseFloat(qty), div = UNIT_DIV[f.unit];
  return {
    kcal:  (f.kcal        / div) * q,
    prot:  (f.prot        / div) * q,
    carbs: ((f.carbs||0)  / div) * q,
    fats:  ((f.fats||0)   / div) * q,
    fibre: ((f.fibre||0)  / div) * q,
  };
}

function unitLabel(f) {
  if (!f) return '';
  if (f.unit === 'unit') {
    const n = f.name.toLowerCase();
    if (n.includes('egg'))    return 'eggs';
    if (n.includes('roti'))   return 'rotis';
    if (n.includes('banana')||n.includes('orange')||n.includes('kiwi')||n.includes('apple')) return 'pcs';
    if (n.includes('whey')||n.includes('protein')) return 'scoops';
    return 'pcs';
  }
  return f.unit;
}

function setStatus(msg, cls) {
  const el = document.getElementById('status');
  el.textContent = msg; el.className = 'status ' + cls;
}

// ── TDEE ─────────────────────────────────────────────────────────────────────
function calcTDEE() {
  const { height, weight, age, sex, activity } = profile;
  if (!height || !weight || !age) return null;
  const bmr = sex === 'male'
    ? 10*weight + 6.25*height - 5*age + 5
    : 10*weight + 6.25*height - 5*age - 161;
  return Math.round(bmr * activity);
}

function updateTDEEDisplay() {
  const tdee = calcTDEE();
  const valEl = document.getElementById('tdee-val');
  const subEl = document.getElementById('tdee-sub');
  const unitEl = document.getElementById('tdee-unit-label');
  if (tdee) {
    valEl.childNodes[0].textContent = tdee;
    unitEl.textContent = ' kcal';
    subEl.textContent = `BMR × ${profile.activity} (${['Sedentary','Light','Moderate','Active','Very Active'][([1.2,1.375,1.55,1.725,1.9].indexOf(profile.activity))] || profile.activity}× factor)`;
    const goal = tdee + (profile.goalOffset || 0);
    document.getElementById('goal-kcal').value = goal;
  } else {
    valEl.childNodes[0].textContent = '—';
    unitEl.textContent = '';
    subEl.textContent = 'Fill in your stats above';
  }
}

function initProfilePanel() {
  document.getElementById('p-height').value = profile.height || '';
  document.getElementById('p-weight').value = profile.weight || '';
  document.getElementById('p-age').value    = profile.age    || '';
  document.getElementById('p-sex').value    = profile.sex    || 'male';
  document.getElementById('goal-kcal').value = goals.kcal;
  document.getElementById('goal-prot').value = goals.prot;

  // Activity buttons
  document.querySelectorAll('.act-btn').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.val) === profile.activity);
    btn.onclick = () => {
      profile.activity = parseFloat(btn.dataset.val);
      document.querySelectorAll('.act-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateTDEEDisplay();
    };
  });

  // Goal tabs
  const tabs = document.querySelectorAll('.goal-tab');
  const amountWrap = document.getElementById('goal-amount-wrap');
  const slider = document.getElementById('goal-amount-slider');
  const display = document.getElementById('goal-amount-display');
  const labelEl = document.getElementById('goal-amount-label');

  function applyGoalMode(mode, amount) {
    profile.goalMode = mode;
    profile.goalAmount = amount;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    if (mode === 'maintain') {
      amountWrap.classList.remove('visible');
      profile.goalOffset = 0;
    } else {
      amountWrap.classList.add('visible');
      const sign = mode === 'cut' ? -1 : 1;
      profile.goalOffset = sign * amount;
      labelEl.textContent = mode === 'cut' ? 'Cut by' : 'Add';
      display.textContent = `${mode === 'cut' ? '−' : '+'}${amount} kcal`;
      slider.value = amount;
    }
    updateTDEEDisplay();
  }

  tabs.forEach(tab => {
    tab.onclick = () => {
      const mode = tab.dataset.mode;
      const amt = parseInt(slider.value) || 250;
      applyGoalMode(mode, amt);
    };
  });

  window.onGoalSlider = () => {
    const mode = profile.goalMode || 'maintain';
    if (mode === 'maintain') return;
    applyGoalMode(mode, parseInt(slider.value));
  };

  // Restore saved state
  const savedMode = profile.goalMode || (profile.goalOffset === 0 ? 'maintain' : profile.goalOffset < 0 ? 'cut' : 'bulk');
  const savedAmt  = Math.abs(profile.goalOffset) || 250;
  applyGoalMode(savedMode, savedAmt);

  // Live recalc
  ['p-height','p-weight','p-age'].forEach(id => {
    document.getElementById(id).oninput = () => {
      profile.height = parseFloat(document.getElementById('p-height').value)||0;
      profile.weight = parseFloat(document.getElementById('p-weight').value)||0;
      profile.age    = parseFloat(document.getElementById('p-age').value)||0;
      updateTDEEDisplay();
    };
  });
  document.getElementById('p-sex').onchange = () => {
    profile.sex = document.getElementById('p-sex').value;
    updateTDEEDisplay();
  };

  updateTDEEDisplay();
}

async function saveProfile() {
  profile.height = parseFloat(document.getElementById('p-height').value)||0;
  profile.weight = parseFloat(document.getElementById('p-weight').value)||0;
  profile.age    = parseFloat(document.getElementById('p-age').value)||0;
  profile.sex    = document.getElementById('p-sex').value;
  goals.kcal     = parseFloat(document.getElementById('goal-kcal').value) || calcTDEE() || 2000;
  goals.prot     = parseFloat(document.getElementById('goal-prot').value) || 150;

  await sb.from('settings').upsert([
    { key:'goal_kcal',    value: String(goals.kcal) },
    { key:'goal_prot',    value: String(goals.prot) },
    { key:'p_height',     value: String(profile.height) },
    { key:'p_weight',     value: String(profile.weight) },
    { key:'p_age',        value: String(profile.age) },
    { key:'p_sex',        value: profile.sex },
    { key:'p_activity',   value: String(profile.activity) },
    { key:'p_goaloffset', value: String(profile.goalOffset||0) },
    { key:'p_goalmode',   value: profile.goalMode||'maintain' },
    { key:'p_goalamount', value: String(profile.goalAmount||250) },
  ]);
  renderTotals();
  closePanel('tdee-panel');
}

// ── Calendar ─────────────────────────────────────────────────────────────────
function toggleCalendar() {
  const dd = document.getElementById('cal-dropdown');
  if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }
  const d = parseDate(currentDate);
  calViewDate = { year: d.getFullYear(), month: d.getMonth() };
  renderCalendar();
  dd.classList.add('open');
  setTimeout(() => {
    document.addEventListener('click', closeCal, { once: true, capture: true });
  }, 10);
}
function closeCal(e) {
  const dd  = document.getElementById('cal-dropdown');
  const btn = document.getElementById('cal-btn');
  if (!dd.contains(e.target) && !btn.contains(e.target)) dd.classList.remove('open');
}
function calNav(delta) {
  calViewDate.month += delta;
  if (calViewDate.month < 0)  { calViewDate.month = 11; calViewDate.year--; }
  if (calViewDate.month > 11) { calViewDate.month = 0;  calViewDate.year++; }
  renderCalendar();
}
function renderCalendar() {
  const { year, month } = calViewDate;
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-month-label').textContent = `${names[month]} ${year}`;

  const grid    = document.getElementById('cal-grid');
  grid.innerHTML = '';
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today       = todayStr();

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el  = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    if (ds === today)       el.classList.add('today');
    if (ds === currentDate) el.classList.add('selected');
    el.onclick = () => {
      currentDate = ds;
      document.getElementById('cal-dropdown').classList.remove('open');
      loadDayLog();
    };
    grid.appendChild(el);
  }
}

// ── Load ─────────────────────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadFoodDB(), loadGoals()]);
  await loadDayLog();
}

async function loadFoodDB() {
  const { data, error } = await sb.from('food_db').select('*').order('name');
  if (!error) { foodDB = data; foodDB.sort((a,b) => a.name.localeCompare(b.name)); }
}

async function seedFoods() {
  const { data } = await sb.from('food_db').select('name');
  if (data && data.length > 0) return;
  await sb.from('food_db').insert(DEFAULT_FOODS);
}

async function loadGoals() {
  const { data } = await sb.from('settings').select('key,value');
  if (data) {
    data.forEach(r => {
      if (r.key === 'goal_kcal')    goals.kcal          = parseFloat(r.value)||2000;
      if (r.key === 'goal_prot')    goals.prot          = parseFloat(r.value)||150;
      if (r.key === 'p_height')     profile.height      = parseFloat(r.value)||178;
      if (r.key === 'p_weight')     profile.weight      = parseFloat(r.value)||83;
      if (r.key === 'p_age')        profile.age         = parseFloat(r.value)||28;
      if (r.key === 'p_sex')        profile.sex         = r.value||'male';
      if (r.key === 'p_activity')   profile.activity    = parseFloat(r.value)||1.2;
      if (r.key === 'p_goaloffset') profile.goalOffset  = parseInt(r.value)||0;
      if (r.key === 'p_goalmode')   profile.goalMode    = r.value||'maintain';
      if (r.key === 'p_goalamount') profile.goalAmount  = parseInt(r.value)||250;
    });
  }
}

// ── Day log ──────────────────────────────────────────────────────────────────
async function loadDayLog() {
  document.getElementById('day-name').textContent = fmtDay(currentDate);
  document.getElementById('day-date').textContent = fmtDateLong(currentDate);
  document.getElementById('meals-area').innerHTML = '<div class="loading">Loading…</div>';

  const { data, error } = await sb.from('food_log')
    .select('*').eq('log_date', currentDate).order('created_at');

  dayLog = { Breakfast:[], Lunch:[], Snack:[], Dinner:[] };
  if (!error && data) data.forEach(r => { if (dayLog[r.meal]) dayLog[r.meal].push(r); });
  MEALS.forEach(m => { if (dayLog[m].length === 0) dayLog[m].push({ id:null, food_name:'', qty:'' }); });
  renderMeals();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderMeals() {
  const area = document.getElementById('meals-area');
  area.innerHTML = '';
  MEALS.forEach(meal => area.appendChild(buildMealBlock(meal)));
  renderTotals();
}

function renderTotals() {
  let tk=0, tp=0, tc=0, tf=0, tfi=0;
  MEALS.forEach(m => dayLog[m].forEach(r => {
    const c = calcRow(r.food_name, r.qty);
    if (c.kcal !== null) { tk+=c.kcal; tp+=c.prot; tc+=c.carbs; tf+=c.fats; tfi+=c.fibre; }
  }));

  document.getElementById('t-kcal').textContent  = Math.round(tk);
  document.getElementById('t-prot').textContent  = tp.toFixed(1);
  document.getElementById('t-carbs').textContent = tc.toFixed(1);
  document.getElementById('t-fats').textContent  = tf.toFixed(1);
  document.getElementById('t-fibre').textContent = tfi.toFixed(1);

  const pct = (val, max) => Math.min(100, max > 0 ? val/max*100 : 0).toFixed(1) + '%';
  document.getElementById('kcal-prog').style.width  = pct(tk,  goals.kcal);
  document.getElementById('prot-prog').style.width  = pct(tp,  goals.prot);
  document.getElementById('carbs-prog').style.width = pct(tc,  250);
  document.getElementById('fats-prog').style.width  = pct(tf,  70);
  document.getElementById('fibre-prog').style.width = pct(tfi, 30);

  document.getElementById('kcal-sub').textContent  = `${Math.round(tk)} of ${goals.kcal} kcal`;
  document.getElementById('prot-sub').textContent  = `${tp.toFixed(1)} of ${goals.prot} g`;
  document.getElementById('carbs-sub').textContent = `${tc.toFixed(1)} of ${goals.carbs} g`;
  document.getElementById('fats-sub').textContent  = `${tf.toFixed(1)} of ${goals.fats} g`;
  document.getElementById('fibre-sub').textContent = `${tfi.toFixed(1)} of ${goals.fibre} g`;
}

function buildMealBlock(meal) {
  const rows = dayLog[meal];
  const mt = rows.reduce((a,r) => {
    const c = calcRow(r.food_name, r.qty);
    if (c.kcal !== null) { a.kcal+=c.kcal; a.prot+=c.prot; }
    return a;
  }, { kcal:0, prot:0 });

  const block = document.createElement('div');
  block.className = 'meal-block';
  block.setAttribute('data-meal', meal);

  block.innerHTML = `
    <div class="meal-header">
      <div class="meal-left">
        <div class="meal-pip" style="background:${MEAL_COLORS[meal]}"></div>
        <div class="meal-name">${meal}</div>
      </div>
      <div class="meal-totals">${Math.round(mt.kcal)} kcal · ${mt.prot.toFixed(1)}g protein</div>
    </div>
    <div class="col-labels">
      <div class="cl" style="text-align:left">Food</div>
      <div class="cl" style="text-align:left;padding-left:8px">Qty</div>
      <div class="cl">kcal</div>
      <div class="cl">prot</div>
      <div class="cl cl-carbs">carbs</div>
      <div class="cl cl-fats">fats</div>
      <div class="cl cl-fibre">fibre</div>
      <div></div>
    </div>`;

  rows.forEach((row, i) => block.appendChild(buildFoodRow(meal, i, row)));

  const addBtn = document.createElement('button');
  addBtn.className = 'add-row-btn';
  addBtn.textContent = '+ Add food';
  addBtn.onclick = () => {
    dayLog[meal].push({ id:null, food_name:'', qty:'' });
    renderMeals();
    setTimeout(() => {
      const inps = document.querySelector(`[data-meal="${meal}"]`).querySelectorAll('.food-inp');
      if (inps.length) inps[inps.length-1].focus();
    }, 30);
  };
  block.appendChild(addBtn);
  return block;
}

function buildFoodRow(meal, idx, row) {
  const f = getFood(row.food_name);
  const c = calcRow(row.food_name, row.qty);
  const div = document.createElement('div');
  div.className = 'food-row';

  // ── Searchable combobox ────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'food-search-wrap';

  const inp = document.createElement('input');
  inp.className = 'food-inp';
  inp.type = 'text';
  inp.placeholder = 'Search food…';
  inp.value = row.food_name;
  inp.autocomplete = 'off';

  const dd = document.createElement('div');
  dd.className = 'food-dropdown';

  let activeIdx = -1;

  function renderDD(q) {
    dd.innerHTML = '';
    activeIdx = -1;
    const ql = q.trim().toLowerCase();
    const matches = ql ? foodDB.filter(fd => fd.name.toLowerCase().includes(ql)) : foodDB;
    if (!matches.length) {
      const opt = document.createElement('div');
      opt.className = 'food-opt no-match';
      opt.textContent = 'No match — add via "Foods"';
      dd.appendChild(opt);
    } else {
      matches.forEach(fd => {
        const opt = document.createElement('div');
        opt.className = 'food-opt';
        if (ql) {
          const i = fd.name.toLowerCase().indexOf(ql);
          opt.innerHTML = fd.name.slice(0,i)
            + `<mark>${fd.name.slice(i, i+ql.length)}</mark>`
            + fd.name.slice(i+ql.length);
        } else {
          opt.textContent = fd.name;
        }
        opt.onmousedown = e => { e.preventDefault(); pick(fd.name); };
        dd.appendChild(opt);
      });
    }
    dd.classList.add('open');
  }

  function pick(name) {
    inp.value = name;
    dayLog[meal][idx].food_name = name;
    const fd = getFood(name);
    dayLog[meal][idx].qty = fd ? UNIT_DEF[fd.unit] : '';
    dd.classList.remove('open');
    scheduleSave(meal, idx);
    renderMeals();
  }

  inp.oninput  = () => renderDD(inp.value);
  inp.onfocus  = () => renderDD(inp.value);
  inp.onblur   = () => setTimeout(() => dd.classList.remove('open'), 150);
  inp.onkeydown = e => {
    const opts = [...dd.querySelectorAll('.food-opt:not(.no-match)')];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx+1, opts.length-1);
      opts.forEach((o,i) => o.classList.toggle('active', i===activeIdx));
      opts[activeIdx]?.scrollIntoView({ block:'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx-1, 0);
      opts.forEach((o,i) => o.classList.toggle('active', i===activeIdx));
      opts[activeIdx]?.scrollIntoView({ block:'nearest' });
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      pick(opts[activeIdx].innerText.trim());
    } else if (e.key === 'Escape') {
      dd.classList.remove('open');
    }
  };

  wrap.appendChild(inp);
  wrap.appendChild(dd);

  // ── Qty ───────────────────────────────────────────────────────────────────
  const qw = document.createElement('div');
  qw.className = 'qty-wrap';

  const qi = document.createElement('input');
  qi.className = 'qty-inp'; qi.type = 'number'; qi.min = '0';
  qi.step = f && f.unit === 'unit' ? '1' : '5';
  qi.value = row.qty; qi.disabled = !row.food_name;
  qi.oninput = () => { dayLog[meal][idx].qty = qi.value; scheduleSave(meal, idx); renderTotals(); };

  const qu = document.createElement('span');
  qu.className = 'qty-unit';
  qu.textContent = unitLabel(f);

  qw.appendChild(qi);
  qw.appendChild(qu);

  // ── Auto cells ────────────────────────────────────────────────────────────
  function cell(val, extraClass) {
    const el = document.createElement('div');
    const v = val !== null ? (Number.isInteger(val) ? val : parseFloat(val.toFixed(1))) : null;
    el.className = `auto-num${v !== null ? ' has-val' : ''}${extraClass ? ' '+extraClass : ''}`;
    el.textContent = v !== null ? v : '—';
    return el;
  }

  const kc  = cell(c.kcal  !== null ? Math.round(c.kcal)  : null);
  const pc  = cell(c.prot  !== null ? c.prot               : null);
  const car = cell(c.carbs !== null ? c.carbs              : null, 'auto-carbs');
  const fat = cell(c.fats  !== null ? c.fats               : null, 'auto-fats');
  const fib = cell(c.fibre !== null ? c.fibre              : null, 'auto-fibre');

  // ── Delete ────────────────────────────────────────────────────────────────
  const del = document.createElement('button');
  del.className = 'del-row';
  del.textContent = '×';
  del.onclick = async () => {
    const entry = dayLog[meal][idx];
    if (entry.id) await sb.from('food_log').delete().eq('id', entry.id);
    dayLog[meal].splice(idx, 1);
    if (!dayLog[meal].length) dayLog[meal].push({ id:null, food_name:'', qty:'' });
    renderMeals();
  };

  div.appendChild(wrap);
  div.appendChild(qw);
  div.appendChild(kc);
  div.appendChild(pc);
  div.appendChild(car);
  div.appendChild(fat);
  div.appendChild(fib);
  div.appendChild(del);
  return div;
}

// ── Save ─────────────────────────────────────────────────────────────────────
function scheduleSave(meal, idx) {
  const key = `${meal}_${idx}`;
  clearTimeout(saveTimers[key]);
  saveTimers[key] = setTimeout(() => saveRow(meal, idx), 800);
}

async function saveRow(meal, idx) {
  const row = dayLog[meal][idx];
  if (!row.food_name || row.qty === '') return;
  setStatus('Saving…', 'saving');
  try {
    if (row.id) {
      await sb.from('food_log')
        .update({ food_name: row.food_name, qty: parseFloat(row.qty) })
        .eq('id', row.id);
    } else {
      const { data, error } = await sb.from('food_log')
        .insert({ log_date: currentDate, meal, food_name: row.food_name, qty: parseFloat(row.qty) })
        .select().single();
      if (!error && data) dayLog[meal][idx].id = data.id;
    }
    setStatus('Saved', 'saved');
    setTimeout(() => setStatus('', ''), 1500);
  } catch(e) { setStatus('Save failed', 'error'); }
}

// ── Food DB panel ─────────────────────────────────────────────────────────────
function openPanel(id) {
  if (id === 'trends-panel') { openTrendsPanel(); return; }
  document.getElementById(id).classList.add('open');
  if (id === 'db-panel')   renderDBPanel();
  if (id === 'tdee-panel') initProfilePanel();
}
function closePanel(id) { document.getElementById(id).classList.remove('open'); }

function renderDBPanel() {
  const list = document.getElementById('db-list');
  const q = (document.getElementById('db-search')?.value || '').toLowerCase();
  list.innerHTML = '';
  const filtered = q ? foodDB.filter(f => f.name.toLowerCase().includes(q)) : foodDB;
  filtered.forEach(f => {
    const ri = foodDB.indexOf(f);
    const isPending = !!f._pending;
    const row = document.createElement('div');
    row.className = 'db-row';

    const ni = document.createElement('input');
    ni.className = 'db-inp'; ni.style.textAlign = 'left';
    ni.value = f.name; ni.placeholder = 'Food name…';
    ni.onchange = () => { foodDB[ri].name = ni.value; };
    ni.onblur = () => { foodDB[ri].name = ni.value; if (isPending) savePendingFood(ri); else updateFood(ri); };
    row.appendChild(ni);

    ['kcal','prot','carbs','fats','fibre'].forEach(key => {
      const inp = document.createElement('input');
      inp.className = 'db-inp'; inp.type = 'number';
      inp.value = f[key] ?? 0;
      inp.onchange = () => { foodDB[ri][key] = parseFloat(inp.value)||0; };
      inp.onblur = () => { foodDB[ri][key] = parseFloat(inp.value)||0; if (!isPending) updateFood(ri); };
      row.appendChild(inp);
    });

    const sel = document.createElement('select');
    sel.className = 'db-inp'; sel.style.padding = '4px';
    ['g','ml','unit'].forEach(u => {
      const opt = document.createElement('option');
      opt.value = u; opt.textContent = u;
      if (f.unit === u) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => { foodDB[ri].unit = sel.value; if (!isPending) updateFood(ri); };
    row.appendChild(sel);

    const del = document.createElement('button');
    del.className = 'del-row'; del.textContent = '×';
    del.onclick = () => deleteFood(ri);
    row.appendChild(del);

    list.appendChild(row);
  });
}

async function updateFood(i) {
  const f = foodDB[i];
  if (!f.name) return;
  await sb.from('food_db').upsert({
    id: f.id, name: f.name, kcal: f.kcal, prot: f.prot,
    carbs: f.carbs||0, fats: f.fats||0, fibre: f.fibre||0, unit: f.unit
  });
  foodDB.sort((a,b) => a.name.localeCompare(b.name));
  renderDBPanel();
}

async function deleteFood(i) {
  const f = foodDB[i];
  if (f.id) await sb.from('food_db').delete().eq('id', f.id);
  foodDB.splice(i, 1);
  renderDBPanel();
}

async function addFoodRow() {
  // Add a blank pending row to UI only — no DB insert until user fills it
  const pending = { id: null, name: '', kcal: 0, prot: 0, carbs: 0, fats: 0, fibre: 0, unit: 'g', _pending: true };
  foodDB.push(pending);
  document.getElementById('db-search').value = '';
  renderDBPanel();
  setTimeout(() => {
    const rows = document.querySelectorAll('#db-list .db-row');
    const last = rows[rows.length-1];
    if (last) { const ni = last.querySelector('input'); if (ni) { ni.focus(); ni.select(); } }
  }, 0);
}

async function savePendingFood(pendingIdx) {
  const f = foodDB[pendingIdx];
  if (!f || !f._pending) return;
  const name = f.name.trim();
  if (!name || name === '') { foodDB.splice(pendingIdx, 1); renderDBPanel(); return; }
  const { data, error } = await sb.from('food_db')
    .insert({ name: f.name, kcal: f.kcal, prot: f.prot, carbs: f.carbs||0, fats: f.fats||0, fibre: f.fibre||0, unit: f.unit })
    .select().single();
  if (error) { console.error(error); foodDB.splice(pendingIdx, 1); renderDBPanel(); return; }
  foodDB[pendingIdx] = data;
  foodDB.sort((a,b) => a.name.localeCompare(b.name));
  renderDBPanel();
}

// ── Trends & Weight Log ──────────────────────────────────────────────────────
let trendsWeekStart = null; // Monday of displayed week
let weightLog = [];         // [{id, log_date, weight_kg}] sorted asc

function getMondayOf(ds) {
  const d = parseDate(ds);
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return dateStr(d);
}

function weekDates(mondayStr) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = parseDate(mondayStr);
    d.setDate(d.getDate() + i);
    dates.push(dateStr(d));
  }
  return dates;
}

function trendsNav(delta) {
  const d = parseDate(trendsWeekStart);
  d.setDate(d.getDate() + delta * 7);
  trendsWeekStart = dateStr(d);
  renderTrendsCharts();
}

function trendsGoToday() {
  trendsWeekStart = getMondayOf(todayStr());
  renderTrendsCharts();
}

function switchTrendsTab(tab) {
  document.querySelectorAll('.trends-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('trends-charts-tab').style.display = tab === 'charts' ? '' : 'none';
  document.getElementById('trends-weight-tab').style.display  = tab === 'weight'  ? '' : 'none';
}

async function openTrendsPanel() {
  if (!sb) return;
  trendsWeekStart = getMondayOf(todayStr());
  document.getElementById('wl-date').value = todayStr();
  document.getElementById('trends-panel').classList.add('open');
  switchTrendsTab('charts');
  try {
    await loadWeightLog();
    await renderTrendsCharts();
    renderWeightList();
  } catch(e) { console.error('Trends load error:', e); }
}

async function loadWeightLog() {
  try {
    const { data, error } = await sb.from('weight_log').select('*').order('log_date', { ascending: true });
    weightLog = error ? [] : (data || []);
  } catch(e) { weightLog = []; }
}

async function addWeightEntry() {
  const dateVal   = document.getElementById('wl-date').value;
  const weightVal = parseFloat(document.getElementById('wl-weight').value);
  if (!dateVal || isNaN(weightVal) || weightVal <= 0) return;

  const existing = weightLog.find(e => e.log_date === dateVal);
  if (existing) {
    await sb.from('weight_log').update({ weight_kg: weightVal }).eq('id', existing.id);
    existing.weight_kg = weightVal;
  } else {
    const { data, error } = await sb.from('weight_log')
      .insert({ log_date: dateVal, weight_kg: weightVal })
      .select().single();
    if (!error && data) weightLog.push(data);
    weightLog.sort((a, b) => a.log_date.localeCompare(b.log_date));
  }
  document.getElementById('wl-weight').value = '';
  renderWeightList();
  renderTrendsCharts();
}

async function deleteWeightEntry(id) {
  await sb.from('weight_log').delete().eq('id', id);
  weightLog = weightLog.filter(e => e.id !== id);
  renderWeightList();
  renderTrendsCharts();
}

function renderWeightList() {
  const list = document.getElementById('wl-list');
  if (!list) return;
  const sorted = [...weightLog].reverse(); // newest first
  if (!sorted.length) {
    list.innerHTML = '<div class="loading" style="height:80px">No entries yet</div>';
    return;
  }
  list.innerHTML = '';
  sorted.forEach((entry, i) => {
    const prev = sorted[i + 1];
    const delta = prev ? (entry.weight_kg - prev.weight_kg) : null;
    const deltaClass = delta === null ? 'same' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
    const deltaText  = delta === null ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(1) + ' kg';

    const row = document.createElement('div');
    row.className = 'wl-row';
    row.innerHTML = `
      <div class="wl-date">${parseDate(entry.log_date).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}</div>
      <div class="wl-kg">${entry.weight_kg} kg</div>
      <div><span class="wl-delta ${deltaClass}">${deltaText}</span></div>
      <button class="del-row" onclick="deleteWeightEntry('${entry.id}')">×</button>`;
    list.appendChild(row);
  });
}

// ── Chart rendering ───────────────────────────────────────────────────────────
async function renderTrendsCharts() {
  const dates = weekDates(trendsWeekStart);
  const endDate = dates[6];

  // Range label
  const startD = parseDate(dates[0]);
  const endD   = parseDate(endDate);
  const fmt = d => d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  document.getElementById('trends-range-label').textContent =
    `${fmt(startD)} – ${fmt(endD)}, ${endD.getFullYear()}`;

  // Fetch food log for the week
  const { data: logs } = await sb.from('food_log')
    .select('*')
    .gte('log_date', dates[0])
    .lte('log_date', endDate);

  // Aggregate per day
  const dayData = {};
  dates.forEach(d => { dayData[d] = { kcal:0, prot:0, carbs:0, fats:0, fibre:0, logged: false }; });
  (logs || []).forEach(r => {
    const c = calcRow(r.food_name, r.qty);
    if (c.kcal !== null && dayData[r.log_date]) {
      dayData[r.log_date].kcal  += c.kcal;
      dayData[r.log_date].prot  += c.prot;
      dayData[r.log_date].carbs += c.carbs;
      dayData[r.log_date].fats  += c.fats;
      dayData[r.log_date].fibre += c.fibre;
      dayData[r.log_date].logged = true;
    }
  });

  renderKcalChart(dates, dayData);
  renderMacroChart(dates, dayData);
  renderWeightChartTrends(dates);
  renderWeeklyStats(dates, dayData);
}

function dayLabel(ds) {
  const d = parseDate(ds);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days[d.getDay()];
}

function renderKcalChart(dates, dayData) {
  const W = 620, H = 180, PAD = { top: 16, right: 16, bottom: 36, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.floor(chartW / 7 * 0.55);
  const colW = chartW / 7;
  const maxKcal = Math.max(goals.kcal * 1.3, ...dates.map(d => dayData[d].kcal), 500);
  const today = todayStr();

  const isDark = document.body.classList.contains('dark');
  const gridCol   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const textCol   = isDark ? '#636366' : '#aeaeb2';
  const goalCol   = isDark ? 'rgba(59,153,252,0.5)' : 'rgba(0,113,227,0.4)';

  const yScale = v => chartH - (v / maxKcal) * chartH;

  // Grid lines
  let gridLines = '';
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    const y = chartH - frac * chartH;
    const label = Math.round(maxKcal * frac);
    gridLines += `<line x1="0" y1="${y}" x2="${chartW}" y2="${y}" stroke="${gridCol}" stroke-width="1"/>
      <text x="-6" y="${y + 4}" text-anchor="end" font-size="10" fill="${textCol}">${label}</text>`;
  });

  // Goal line
  const goalY = yScale(goals.kcal);
  const goalLine = `<line x1="0" y1="${goalY}" x2="${chartW}" y2="${goalY}"
    stroke="${goalCol}" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${chartW + 4}" y="${goalY + 4}" font-size="9" fill="${goalCol}">goal</text>`;

  // Bars
  let bars = '';
  dates.forEach((d, i) => {
    const v = dayData[d].kcal;
    const x = i * colW + (colW - barW) / 2;
    const barH = v > 0 ? Math.max(2, (v / maxKcal) * chartH) : 0;
    const y = chartH - barH;
    const isToday = d === today;
    const overGoal = v > goals.kcal;
    const barColor = !dayData[d].logged ? (isDark ? '#2c2c2e' : '#ebebed')
      : overGoal ? 'var(--c-fats)' : 'var(--c-kcal)';
    const opacity = !dayData[d].logged ? '0.5' : '1';
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}"
      fill="${barColor}" opacity="${opacity}" rx="3"/>
      ${isToday ? `<rect x="${x - 2}" y="${chartH + 6}" width="${barW + 4}" height="3" fill="var(--blue)" rx="1.5"/>` : ''}
      <text x="${x + barW/2}" y="${H - PAD.bottom + 14}" text-anchor="middle" font-size="11" fill="${isToday ? 'var(--blue)' : textCol}" font-weight="${isToday ? '700' : '400'}">${dayLabel(d)}</text>
      ${v > 0 ? `<text x="${x + barW/2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="${textCol}">${Math.round(v)}</text>` : ''}`;
  });

  document.getElementById('kcal-chart').innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${PAD.left},${PAD.top})">
        ${gridLines}${goalLine}${bars}
      </g>
    </svg>`;
}

function renderMacroChart(dates, dayData) {
  const W = 620, H = 160, PAD = { top: 16, right: 16, bottom: 36, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.floor(chartW / 7 * 0.55);
  const colW = chartW / 7;
  const maxVal = Math.max(...dates.map(d => dayData[d].prot + dayData[d].carbs + dayData[d].fats), 50);
  const today = todayStr();

  const isDark = document.body.classList.contains('dark');
  const textCol = isDark ? '#636366' : '#aeaeb2';
  const gridCol = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  let gridLines = '';
  [0.5, 1].forEach(frac => {
    const y = chartH - frac * chartH;
    gridLines += `<line x1="0" y1="${y}" x2="${chartW}" y2="${y}" stroke="${gridCol}" stroke-width="1"/>
      <text x="-6" y="${y + 4}" text-anchor="end" font-size="10" fill="${textCol}">${Math.round(maxVal * frac)}g</text>`;
  });

  // Stacked bars: prot (bottom) → carbs → fats
  let bars = '';
  dates.forEach((d, i) => {
    const x = i * colW + (colW - barW) / 2;
    const isToday = d === today;
    const total = dayData[d].prot + dayData[d].carbs + dayData[d].fats;
    if (total === 0) {
      bars += `<rect x="${x}" y="${chartH - 2}" width="${barW}" height="2" fill="${isDark ? '#2c2c2e' : '#ebebed'}" rx="1"/>`;
    } else {
      let yOff = 0;
      [
        { key:'fats',  color:'var(--c-fats)'  },
        { key:'carbs', color:'var(--c-carbs)' },
        { key:'prot',  color:'var(--c-prot)'  },
      ].forEach(seg => {
        const v = dayData[d][seg.key];
        const h = (v / maxVal) * chartH;
        const y = chartH - yOff - h;
        if (h > 0) bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${seg.color}" opacity="0.85"/>`;
        yOff += h;
      });
    }
    bars += `<text x="${x + barW/2}" y="${H - PAD.bottom + 14}" text-anchor="middle" font-size="11"
      fill="${isToday ? 'var(--blue)' : textCol}" font-weight="${isToday ? '700' : '400'}">${dayLabel(d)}</text>`;
  });

  // Legend
  const legend = [
    { label:'Protein', color:'var(--c-prot)' },
    { label:'Carbs',   color:'var(--c-carbs)' },
    { label:'Fats',    color:'var(--c-fats)' },
  ].map((l, i) =>
    `<g transform="translate(${i * 80}, 0)">
      <rect width="10" height="10" fill="${l.color}" rx="2" opacity="0.85"/>
      <text x="14" y="9" font-size="11" fill="${textCol}">${l.label}</text>
    </g>`
  ).join('');

  document.getElementById('macro-chart').innerHTML =
    `<svg viewBox="0 0 ${W} ${H + 20}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${PAD.left},${PAD.top})">${gridLines}${bars}</g>
      <g transform="translate(${PAD.left}, ${H + 2})">${legend}</g>
    </svg>`;
}

function renderWeightChartTrends(dates) {
  const container = document.getElementById('weight-chart-trends');
  // Use last 30 days of weight entries for context, but highlight the week
  const relevant = weightLog.filter(e => e.log_date >= dates[0] && e.log_date <= dates[6]);
  const allRecent = weightLog.slice(-30);

  if (!allRecent.length) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-3);font-size:13px">No weight entries yet — log your weight in the Weight Log tab</div>';
    return;
  }

  const W = 620, H = 140, PAD = { top: 16, right: 16, bottom: 36, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const weights = allRecent.map(e => e.weight_kg);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const minDate = allRecent[0].log_date;
  const maxDate = allRecent[allRecent.length - 1].log_date;
  const dateRange = Math.max(1,
    (parseDate(maxDate) - parseDate(minDate)) / (1000 * 60 * 60 * 24));

  const isDark = document.body.classList.contains('dark');
  const textCol = isDark ? '#636366' : '#aeaeb2';
  const gridCol = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  const xScale = d => ((parseDate(d) - parseDate(minDate)) / (1000 * 60 * 60 * 24)) / dateRange * chartW;
  const yScale = w => chartH - ((w - minW) / (maxW - minW)) * chartH;

  // Grid
  let gridLines = '';
  const wRange = maxW - minW;
  const step = wRange < 2 ? 0.5 : 1;
  for (let w = Math.ceil(minW); w <= maxW; w += step) {
    const y = yScale(w);
    gridLines += `<line x1="0" y1="${y}" x2="${chartW}" y2="${y}" stroke="${gridCol}" stroke-width="1"/>
      <text x="-6" y="${y + 4}" text-anchor="end" font-size="10" fill="${textCol}">${w.toFixed(1)}</text>`;
  }

  // Week highlight band
  const weekX1 = Math.max(0, xScale(dates[0]));
  const weekX2 = Math.min(chartW, xScale(dates[6]) + 1);
  const weekBand = weekX2 > weekX1
    ? `<rect x="${weekX1}" y="0" width="${weekX2 - weekX1}" height="${chartH}" fill="${isDark ? 'rgba(59,153,252,0.07)' : 'rgba(0,113,227,0.05)'}" rx="2"/>`
    : '';

  // Line path
  const pts = allRecent.map(e => `${xScale(e.log_date)},${yScale(e.weight_kg)}`).join(' L ');
  const line = `<polyline points="${pts.replace(/ L /g, ' ')}" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

  // Dots
  const dots = allRecent.map(e => {
    const inWeek = e.log_date >= dates[0] && e.log_date <= dates[6];
    return `<circle cx="${xScale(e.log_date)}" cy="${yScale(e.weight_kg)}" r="${inWeek ? 4 : 2.5}"
      fill="${inWeek ? 'var(--blue)' : (isDark ? '#3a3a3c' : '#fff')}"
      stroke="var(--blue)" stroke-width="${inWeek ? 0 : 1.5}"/>`;
  }).join('');

  // Date labels: first, last, and week start/end if in range
  let dateLabels = '';
  [[allRecent[0].log_date, 'start'], [allRecent[allRecent.length-1].log_date, 'end']].forEach(([d, pos]) => {
    const x = xScale(d);
    const anchor = pos === 'start' ? 'start' : 'end';
    const label = parseDate(d).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    dateLabels += `<text x="${x}" y="${chartH + 16}" text-anchor="${anchor}" font-size="10" fill="${textCol}">${label}</text>`;
  });

  container.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${PAD.left},${PAD.top})">
        ${gridLines}${weekBand}
        <polyline points="${allRecent.map(e => `${xScale(e.log_date)},${yScale(e.weight_kg)}`).join(' ')}"
          fill="none" stroke="var(--blue)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}${dateLabels}
      </g>
    </svg>`;
}

function renderWeeklyStats(dates, dayData) {
  const loggedDays = dates.filter(d => dayData[d].logged);
  const avgKcal = loggedDays.length
    ? Math.round(loggedDays.reduce((s, d) => s + dayData[d].kcal, 0) / loggedDays.length)
    : 0;
  const avgProt = loggedDays.length
    ? (loggedDays.reduce((s, d) => s + dayData[d].prot, 0) / loggedDays.length).toFixed(1)
    : 0;
  const daysOnTarget = dates.filter(d => dayData[d].logged && Math.abs(dayData[d].kcal - goals.kcal) <= 150).length;

  // Weight delta over week
  const wStart = weightLog.find(e => e.log_date >= dates[0]);
  const wEnd   = [...weightLog].reverse().find(e => e.log_date <= dates[6]);
  const wDelta = (wStart && wEnd && wStart !== wEnd)
    ? (wEnd.weight_kg - wStart.weight_kg).toFixed(1)
    : null;

  const el = document.getElementById('weekly-stats');
  el.innerHTML = `
    <div class="wstat-card">
      <div class="wstat-label">Avg Calories</div>
      <div class="wstat-val">${avgKcal || '—'}</div>
      <div class="wstat-sub">goal: ${goals.kcal}</div>
    </div>
    <div class="wstat-card">
      <div class="wstat-label">Avg Protein</div>
      <div class="wstat-val">${avgProt || '—'}<span style="font-size:13px;font-weight:500;color:var(--text-3)">g</span></div>
      <div class="wstat-sub">goal: ${goals.prot}g</div>
    </div>
    <div class="wstat-card">
      <div class="wstat-label">On Target</div>
      <div class="wstat-val">${daysOnTarget}<span style="font-size:13px;font-weight:500;color:var(--text-3)"> days</span></div>
      <div class="wstat-sub">±150 kcal of goal</div>
    </div>
    <div class="wstat-card">
      <div class="wstat-label">Weight Δ</div>
      <div class="wstat-val">${wDelta !== null ? (wDelta > 0 ? '+' : '') + wDelta : '—'}<span style="font-size:13px;font-weight:500;color:var(--text-3)">${wDelta !== null ? 'kg' : ''}</span></div>
      <div class="wstat-sub">${loggedDays.length} days logged</div>
    </div>`;
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.getElementById('theme-btn').textContent = isDark ? '☀️' : '🌙';
}

function applyTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = saved ? saved === 'dark' : prefersDark;
  if (dark) document.body.classList.add('dark');
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  applyTheme();
  const { url, key } = loadConfig();
  if (url && key) {
    try {
      await initSupabase(url, key);
      document.getElementById('setup-screen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      await loadAll();
    } catch(e) {
      document.getElementById('setup-screen').style.display = 'flex';
    }
  } else {
    document.getElementById('setup-screen').style.display = 'flex';
  }
}
boot();
