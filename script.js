const MEAL_COLORS = { Breakfast: '#2563eb', Lunch: '#16a34a', Snack: '#d97706', Dinner: '#9333ea' };
const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
const UNIT_DIV = { g: 100, ml: 100, unit: 1 };
const UNIT_DEF = { g: 100, ml: 250, unit: 1 }; // unit foods: qty = number of pieces
const DEFAULT_FOODS = [
    { name: 'Chicken breast (cooked)', kcal: 165, prot: 31, unit: 'g' },
    { name: 'Soya chunks (cooked)', kcal: 116, prot: 16.6, unit: 'g' },
    { name: 'Egg', kcal: 78, prot: 6.5, unit: 'unit' },
    { name: 'Paneer', kcal: 265, prot: 18, unit: 'g' },
    { name: 'Milk (toned)', kcal: 60, prot: 3.2, unit: 'ml' },
    { name: 'Curd', kcal: 58, prot: 3.3, unit: 'g' },
    { name: 'Dal (cooked)', kcal: 116, prot: 7.2, unit: 'g' },
    { name: 'Oats', kcal: 389, prot: 16.9, unit: 'g' },
    { name: 'Roti', kcal: 106, prot: 3.5, unit: 'unit' },
    { name: 'White rice (cooked)', kcal: 130, prot: 2.4, unit: 'g' },
    { name: 'Poha (cooked)', kcal: 110, prot: 2.3, unit: 'g' },
    { name: 'Banana', kcal: 89, prot: 1.1, unit: 'unit' },
    { name: 'Orange', kcal: 62, prot: 1.2, unit: 'unit' },
    { name: 'Kiwi', kcal: 55, prot: 1.1, unit: 'unit' },
    { name: 'Peanut butter', kcal: 588, prot: 25, unit: 'g' },
    { name: 'Almonds', kcal: 579, prot: 21, unit: 'g' },
    { name: 'Whey protein', kcal: 120, prot: 24, unit: 'unit' },
];

let sb = null;
let foodDB = [];
let dayLog = {}; // { Breakfast: [{id,food_name,qty},...], ... }
let currentDate = todayStr();
let goals = { kcal: 2000, prot: 150 };
let saveTimers = {};

// ── Config ──────────────────────────────────────────────────────────────────
function loadConfig() {
    return { url: localStorage.getItem('sb_url'), key: localStorage.getItem('sb_key') };
}
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
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}
function fmtDay(s) {
    const d = parseDate(s), today = todayStr();
    if (s === today) return 'Today';
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
    if (s === yesterdayStr) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'long' });
}
function fmtDateLong(s) {
    return parseDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
function changeDay(delta) {
    const d = parseDate(currentDate);
    d.setDate(d.getDate() + delta);
    currentDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    loadDayLog();
}
function goToday() { currentDate = todayStr(); loadDayLog(); }
function getFood(name) { return foodDB.find(f => f.name === name); }
function calcRow(name, qty) {
    const f = getFood(name);
    if (!f || qty === '' || isNaN(parseFloat(qty))) return { kcal: null, prot: null };
    const q = parseFloat(qty), div = UNIT_DIV[f.unit];
    return { kcal: (f.kcal / div) * q, prot: (f.prot / div) * q };
}
function unitLabel(f) {
    if (!f) return '';
    if (f.unit === 'unit') {
        const n = f.name.toLowerCase();
        if (n.includes('egg')) return 'eggs';
        if (n.includes('roti')) return 'rotis';
        if (n.includes('banana') || n.includes('orange') || n.includes('kiwi') || n.includes('apple')) return 'pcs';
        if (n.includes('whey') || n.includes('protein')) return 'scoops';
        return 'pcs';
    }
    return f.unit;
}
function setStatus(msg, cls) {
    const el = document.getElementById('status');
    el.textContent = msg; el.className = 'status ' + cls;
}

// ── Load all ─────────────────────────────────────────────────────────────────
async function loadAll() {
    await Promise.all([loadFoodDB(), loadGoals()]);
    await loadDayLog();
}

async function loadFoodDB() {
    const { data, error } = await sb.from('food_db').select('*').order('name');
    if (!error) { foodDB = data; foodDB.sort((a, b) => a.name.localeCompare(b.name)); }
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
            if (r.key === 'goal_kcal') goals.kcal = parseFloat(r.value) || 2000;
            if (r.key === 'goal_prot') goals.prot = parseFloat(r.value) || 150;
        });
    }
    document.getElementById('goal-kcal').value = goals.kcal;
    document.getElementById('goal-prot').value = goals.prot;
}

async function saveGoals() {
    const kcal = parseFloat(document.getElementById('goal-kcal').value) || 2000;
    const prot = parseFloat(document.getElementById('goal-prot').value) || 150;
    goals = { kcal, prot };
    await sb.from('settings').upsert([{ key: 'goal_kcal', value: String(kcal) }, { key: 'goal_prot', value: String(prot) }]);
    renderTotals();
    closePanel('goals-panel');
}

// ── Day log ──────────────────────────────────────────────────────────────────
async function loadDayLog() {
    document.getElementById('day-name').textContent = fmtDay(currentDate);
    document.getElementById('day-date').textContent = fmtDateLong(currentDate);
    document.getElementById('meals-area').innerHTML = '<div class="loading">loading...</div>';

    const { data, error } = await sb.from('food_log')
        .select('*').eq('log_date', currentDate).order('created_at');

    dayLog = { Breakfast: [], Lunch: [], Snack: [], Dinner: [] };
    if (!error && data) {
        data.forEach(r => { if (dayLog[r.meal]) dayLog[r.meal].push(r); });
    }
    // ensure at least one empty slot per meal
    MEALS.forEach(m => { if (dayLog[m].length === 0) dayLog[m].push({ id: null, food_name: '', qty: '' }); });
    renderMeals();
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderMeals() {
    const area = document.getElementById('meals-area');
    area.innerHTML = '';
    MEALS.forEach(meal => area.appendChild(buildMealBlock(meal)));
    renderTotals();
}

function renderTotals() {
    let tk = 0, tp = 0;
    MEALS.forEach(m => dayLog[m].forEach(r => {
        const c = calcRow(r.food_name, r.qty);
        if (c.kcal !== null) { tk += c.kcal; tp += c.prot; }
    }));
    document.getElementById('t-kcal').innerHTML = `${Math.round(tk)} <span>kcal</span>`;
    document.getElementById('t-prot').innerHTML = `${tp.toFixed(1)} <span>g</span>`;
    document.getElementById('kcal-prog').style.width = Math.min(100, tk / goals.kcal * 100).toFixed(1) + '%';
    document.getElementById('prot-prog').style.width = Math.min(100, tp / goals.prot * 100).toFixed(1) + '%';
    document.getElementById('kcal-sub').textContent = `${Math.round(tk)} of ${goals.kcal} kcal`;
    document.getElementById('prot-sub').textContent = `${tp.toFixed(1)} of ${goals.prot} g`;
}

function buildMealBlock(meal) {
    const rows = dayLog[meal];
    const mk = rows.reduce((s, r) => { const c = calcRow(r.food_name, r.qty); return s + (c.kcal || 0); }, 0);
    const mp = rows.reduce((s, r) => { const c = calcRow(r.food_name, r.qty); return s + (c.prot || 0); }, 0);

    const block = document.createElement('div');
    block.className = 'meal-block';
    block.innerHTML = `
    <div class="meal-header">
      <div class="meal-left">
        <div class="meal-pip" style="background:${MEAL_COLORS[meal]}"></div>
        <div class="meal-title">${meal}</div>
      </div>
      <div class="meal-total">${mk > 0 ? Math.round(mk) + 'kcal · ' + mp.toFixed(1) + 'g' : '—'}</div>
    </div>
    <div class="col-labels">
      <div class="cl" style="text-align:left">food</div>
      <div class="cl">qty</div>
      <div class="cl">kcal</div>
      <div class="cl">protein</div>
      <div></div>
    </div>`;

    rows.forEach((row, i) => block.appendChild(buildFoodRow(meal, i, row)));

    const addBtn = document.createElement('button');
    addBtn.className = 'add-row-btn';
    addBtn.textContent = '+ add food';
    addBtn.onclick = () => {
        dayLog[meal].push({ id: null, food_name: '', qty: '' });
        renderMeals();
    };
    block.appendChild(addBtn);
    return block;
}

function buildFoodRow(meal, idx, row) {
    const f = getFood(row.food_name);
    const c = calcRow(row.food_name, row.qty);
    const div = document.createElement('div');
    div.className = 'food-row';

    // Food select
    const sel = document.createElement('select');
    sel.className = 'food-sel';
    sel.innerHTML = `<option value="">— select —</option>` +
        foodDB.map(fd => `<option value="${fd.name}"${fd.name === row.food_name ? ' selected' : ''}>${fd.name}</option>`).join('');
    sel.onchange = () => {
        dayLog[meal][idx].food_name = sel.value;
        const fd = getFood(sel.value);
        dayLog[meal][idx].qty = fd ? UNIT_DEF[fd.unit] : '';
        scheduleSave(meal, idx);
        renderMeals();
    };

    // Qty
    const qw = document.createElement('div');
    qw.className = 'qty-wrap';
    const qi = document.createElement('input');
    qi.className = 'qty-inp'; qi.type = 'number'; qi.min = '0';
    qi.step = f && f.unit === 'unit' ? '1' : '5';
    qi.value = row.qty; qi.disabled = !row.food_name;
    qi.oninput = () => { dayLog[meal][idx].qty = qi.value; scheduleSave(meal, idx); renderTotals(); };
    const qu = document.createElement('span');
    qu.className = 'qty-unit'; qu.textContent = unitLabel(f);
    qw.appendChild(qi); qw.appendChild(qu);

    // Auto vals
    const kc = document.createElement('div');
    kc.className = 'auto-num' + (c.kcal !== null ? ' has-val' : '');
    kc.textContent = c.kcal !== null ? Math.round(c.kcal) : '—';

    const pc = document.createElement('div');
    pc.className = 'auto-num' + (c.prot !== null ? ' has-val' : '');
    pc.textContent = c.prot !== null ? c.prot.toFixed(1) + 'g' : '—';

    // Delete
    const db = document.createElement('button');
    db.className = 'del-row'; db.textContent = '×';
    db.onclick = async () => {
        const entry = dayLog[meal][idx];
        if (entry.id) await sb.from('food_log').delete().eq('id', entry.id);
        dayLog[meal].splice(idx, 1);
        if (dayLog[meal].length === 0) dayLog[meal].push({ id: null, food_name: '', qty: '' });
        renderMeals();
    };

    div.appendChild(sel); div.appendChild(qw); div.appendChild(kc); div.appendChild(pc); div.appendChild(db);
    return div;
}

// ── Save logic ───────────────────────────────────────────────────────────────
function scheduleSave(meal, idx) {
    const key = `${meal}_${idx}`;
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(() => saveRow(meal, idx), 800);
}

async function saveRow(meal, idx) {
    const row = dayLog[meal][idx];
    if (!row.food_name || row.qty === '') return;
    setStatus('saving…', 'saving');
    try {
        if (row.id) {
            await sb.from('food_log').update({ food_name: row.food_name, qty: parseFloat(row.qty) }).eq('id', row.id);
        } else {
            const { data, error } = await sb.from('food_log').insert({
                log_date: currentDate, meal, food_name: row.food_name, qty: parseFloat(row.qty)
            }).select().single();
            if (!error && data) dayLog[meal][idx].id = data.id;
        }
        setStatus('saved', 'saved');
        setTimeout(() => setStatus('', ''), 1500);
    } catch (e) {
        setStatus('save failed', 'error');
    }
}

// ── Food DB panel ─────────────────────────────────────────────────────────────
function openPanel(id) { document.getElementById(id).classList.add('open'); if (id === 'db-panel') renderDBPanel(); }
function closePanel(id) { document.getElementById(id).classList.remove('open'); }

function renderDBPanel() {
    const list = document.getElementById('db-list');
    list.innerHTML = '';
    foodDB.forEach((f, i) => {
        const row = document.createElement('div');
        row.className = 'db-row';
        row.innerHTML = `
      <input class="db-inp" value="${f.name}" onchange="foodDB[${i}].name=this.value;" onblur="updateFood(${i})" />
      <input class="db-inp" type="number" value="${f.kcal}" style="text-align:center" onchange="foodDB[${i}].kcal=parseFloat(this.value)||0;" onblur="updateFood(${i})" />
      <input class="db-inp" type="number" value="${f.prot}" style="text-align:center" onchange="foodDB[${i}].prot=parseFloat(this.value)||0;" onblur="updateFood(${i})" />
      <select class="db-inp" style="padding:4px 4px;" onchange="foodDB[${i}].unit=this.value;updateFood(${i})">
        <option value="g"${f.unit === 'g' ? ' selected' : ''}>g</option>
        <option value="ml"${f.unit === 'ml' ? ' selected' : ''}>ml</option>
        <option value="unit"${f.unit === 'unit' ? ' selected' : ''}>unit</option>
      </select>
      <button class="del-row" onclick="deleteFood(${i})">×</button>`;
        list.appendChild(row);
    });
}

async function updateFood(i) {
    const f = foodDB[i];
    if (!f.name) return;
    await sb.from('food_db').upsert({ id: f.id, name: f.name, kcal: f.kcal, prot: f.prot, unit: f.unit });
    foodDB.sort((a, b) => a.name.localeCompare(b.name));
    renderDBPanel();
}

async function deleteFood(i) {
    const f = foodDB[i];
    if (f.id) await sb.from('food_db').delete().eq('id', f.id);
    foodDB.splice(i, 1);
    renderDBPanel();
}

async function addFoodRow() {
    const { data, error } = await sb
        .from('food_db')
        .insert({
            name: 'Food ' + Date.now(),
            kcal: 0,
            prot: 0,
            unit: 'g'
        })
        .select()
        .single();

    if (error) {
        console.error(error);
        return;
    }

    foodDB.push(data);
    renderDBPanel();

    // focus the name field of the newest row
    setTimeout(() => {
        const rows = document.querySelectorAll('#db-list .db-row');
        const lastRow = rows[rows.length - 1];
        if (!lastRow) return;

        const nameInput = lastRow.querySelector('input');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 0);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
    const { url, key } = loadConfig();
    if (url && key) {
        try {
            await initSupabase(url, key);
            document.getElementById('setup-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            await loadAll();
        } catch (e) {
            document.getElementById('setup-screen').style.display = 'flex';
        }
    } else {
        document.getElementById('setup-screen').style.display = 'flex';
    }
}
boot();