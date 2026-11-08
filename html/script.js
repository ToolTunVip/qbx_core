const state = {
    slots: [],
    maxSlots: 3,
    selected: -1,
    enableDelete: true,
    nationalities: [],
    limitNationalities: true,
    gender: 0,
    pendingDelete: null,
    busy: false,
    dateFormat: 'YYYY-MM-DD',
    dateMin: '',
    dateMax: '',
    heightMin: 140,
    heightMax: 210,
    backstoryMin: 10,
};

const $ = (id) => document.getElementById(id);

function hasNui() {
    return typeof GetParentResourceName === 'function';
}

function parentResourceName() {
    return typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'qbx_core';
}

async function post(name, data) {
    if (!hasNui()) return null;
    try {
        const res = await fetch(`https://${parentResourceName()}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data || {}),
        });
        return await res.json();
    } catch (e) {
        return null;
    }
}

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function pad(num) {
    return String(num).padStart(2, '0');
}

function initials(first, last) {
    const a = String(first || '').trim().charAt(0);
    const b = String(last || '').trim().charAt(0);
    return (a + b || '??').toUpperCase();
}

function money(value) {
    return '$' + String(value ?? '0');
}

/* ---------------- DATE HELPERS ---------------- */

/* Parse chuỗi theo dateFormat (vd DD-MM-YYYY) -> 'YYYY-MM-DD', sai thì trả null */
function parseDate(str, format) {
    const value = String(str || '').trim();
    if (!value) return null;

    const fmt = String(format || 'YYYY-MM-DD').toUpperCase();
    const order = [];
    const pattern = fmt
        .replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
        .replace(/YYYY|MM|DD/g, (token) => {
            order.push(token);
            return token === 'YYYY' ? '(\\d{4})' : '(\\d{2})';
        });

    const match = new RegExp(`^${pattern}$`).exec(value);
    if (!match) return null;

    const parts = {};
    order.forEach((token, i) => { parts[token] = Number(match[i + 1]); });

    const { YYYY: y, MM: m, DD: d } = parts;
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;

    return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
}

/* Tự chèn dấu phân cách khi gõ ngày sinh */
function maskDate(raw, format) {
    const fmt = String(format || 'YYYY-MM-DD').toUpperCase();
    const digits = String(raw || '').replace(/\D/g, '');
    let out = '';
    let di = 0;
    for (const ch of fmt) {
        if (di >= digits.length) break;
        if (ch === 'Y' || ch === 'M' || ch === 'D') out += digits[di++];
        else out += ch;
    }
    return out;
}

function prettyDate(value) {
    return value || '-';
}

/* ---------------- BARCODE ---------------- */

function barcodeBackground(seed) {
    let h = 2166136261;
    const text = String(seed || 'tooltun');
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;

    let x = h || 1;
    const widths = [];
    let total = 0;
    for (let i = 0; i < 72; i++) {
        x ^= x << 13; x >>>= 0;
        x ^= x >>> 17;
        x ^= x << 5; x >>>= 0;
        const w = 1 + (x % 4);
        widths.push(w);
        total += w;
    }

    let pos = 0;
    const stops = [];
    widths.forEach((w, i) => {
        const color = i % 2 === 0 ? '#000' : 'transparent';
        const start = (pos / total) * 100;
        pos += w;
        const end = (pos / total) * 100;
        stops.push(`${color} ${start.toFixed(2)}%`, `${color} ${end.toFixed(2)}%`);
    });
    return `linear-gradient(90deg, ${stops.join(',')})`;
}

/* ---------------- VIEW SWITCH ---------------- */

function setView(view) {
    document.body.dataset.view = view; // 'card' | 'register'
    $('right-panel').classList.toggle('is-card', view === 'card');
}

/* ---------------- RENDER ---------------- */

function lastPlayedOf(char) {
    return char.lastPlayed || char.lastLoggedOut || char.last_logged_out || '';
}

function renderSlots() {
    const list = $('slot-list');
    list.innerHTML = '';

    for (let i = 0; i < state.maxSlots; i++) {
        const char = state.slots[i];
        const card = document.createElement('div');
        card.className = 'slot-card' + (state.selected === i ? ' active' : '');

        const played = char ? lastPlayedOf(char) : '';

        card.innerHTML = `
            <div class="slot-num">${pad(i + 1)}</div>
            <div class="slot-info">
                <h4>${char ? esc(char.firstname + ' ' + char.lastname) : 'NEW CHARACTER'}</h4>
                <p>${char ? esc(char.job || 'CIVILIAN') : 'EMPTY SLOT'}</p>
                ${char ? `<div class="meta"><span class="cash">${esc(money(char.cash))}</span>${played ? `<span>${esc(played)}</span>` : ''}</div>` : ''}
            </div>
            <div class="slot-action">${char ? '&rsaquo;' : '+'}</div>`;

        card.addEventListener('click', () => selectSlot(i));
        list.appendChild(card);
    }

    const used = state.slots.filter(Boolean).length;
    $('slot-count').textContent = `${used} OF ${state.maxSlots} SLOTS USED`;
}

function selectSlot(index) {
    if (state.slots[index]) showIdCard(index);
    else openRegister(index);
}

function showIdCard(index) {
    const char = state.slots[index];
    if (!char) return;

    state.selected = index;
    renderSlots();

    $('id-slot-num').textContent = pad(index + 1);
    $('id-avatar').textContent = initials(char.firstname, char.lastname);
    $('id-name').textContent = `${char.firstname} ${char.lastname}`;
    $('id-birthdate').textContent = prettyDate(char.birthdate);
    $('id-gender').textContent = Number(char.gender) === 1 ? 'Female' : 'Male';
    $('id-height').textContent = char.height ? `${char.height} cm` : '-';
    $('id-nationality').textContent = char.nationality || '-';
    $('id-citizenid').textContent = char.citizenid || '-';
    $('id-job').textContent = char.job || 'CIVILIAN';
    $('id-cash').textContent = money(char.cash);
    $('id-bank').textContent = money(char.bank);

    const backstory = String(char.backstory || '').trim();
    $('id-backstory').textContent = backstory;
    $('id-backstory-row').classList.toggle('hidden', !backstory);

    const played = lastPlayedOf(char);
    $('id-lastplayed').textContent = played || '-';
    $('id-lastplayed-row').classList.toggle('hidden', !played);

    $('id-barcode').style.backgroundImage = barcodeBackground(char.citizenid);
    $('btn-delete').classList.toggle('hidden', !state.enableDelete);

    $('view-id-card').classList.remove('hidden');
    $('view-register').classList.remove('active');
    setView('card');

    post('selectCharacter', { citizenid: char.citizenid });
}

function openRegister(index) {
    state.selected = index;
    state.gender = 0;
    renderSlots();

    $('reg-slot-num').textContent = pad(index + 1);
    $('reg-firstname').value = '';
    $('reg-lastname').value = '';

    const fmt = String(state.dateFormat || 'YYYY-MM-DD').toUpperCase();
    const birth = $('reg-birthdate');
    birth.value = '';
    birth.placeholder = fmt;
    birth.maxLength = fmt.length;
    $('reg-date-hint').textContent = `Format ${fmt}`;

    $('reg-height').value = '';
    $('reg-height-hint').textContent = `Between ${state.heightMin} and ${state.heightMax}`;

    $('reg-backstory').value = '';
    $('reg-count').textContent = '0 / 300';
    hideError();
    setGender(0);
    renderNationalities();

    $('view-id-card').classList.add('hidden');
    $('view-register').classList.add('active');
    setView('register');

    post('selectCharacter', {});
}

function renderNationalities() {
    const wrap = $('reg-nationality-wrap');
    wrap.innerHTML = '';

    let field;
    if (state.limitNationalities && state.nationalities.length) {
        field = document.createElement('select');
        field.className = 'form-control';
        const options = state.nationalities.slice();
        if (!options.includes('American')) options.unshift('American');
        for (const name of options) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            field.appendChild(opt);
        }
        field.value = options.includes('American') ? 'American' : options[0];
    } else {
        field = document.createElement('input');
        field.type = 'text';
        field.className = 'form-control';
        field.placeholder = 'American';
        field.maxLength = 50;
    }
    field.id = 'reg-nationality';
    wrap.appendChild(field);
}

function setGender(gender) {
    state.gender = gender;
    document.querySelectorAll('.btn-gender').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.gender) === gender);
    });
}

function showError(message) {
    const box = $('form-error');
    box.textContent = message;
    box.classList.add('show');
    const panel = $('right-panel');
    if (panel) panel.scrollTop = 0;
}

function hideError() {
    $('form-error').classList.remove('show');
}

/* ---------------- ACTIONS ---------------- */

async function playSelected() {
    const char = state.slots[state.selected];
    if (!char || state.busy) return;
    state.busy = true;
    const btn = $('btn-play');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'LOADING...';
    await post('playCharacter', { citizenid: char.citizenid });
    state.busy = false;
    btn.disabled = false;
    btn.innerHTML = original;
}

function askDelete() {
    const char = state.slots[state.selected];
    if (!char) return;
    state.pendingDelete = char.citizenid;
    $('confirm-modal').classList.add('show');
}

async function confirmDelete() {
    const citizenid = state.pendingDelete;
    $('confirm-modal').classList.remove('show');
    state.pendingDelete = null;
    if (!citizenid) return;
    await post('deleteCharacter', { citizenid });
}

async function submitCreate() {
    if (state.busy) return;
    hideError();

    const firstname = $('reg-firstname').value.trim();
    const lastname = $('reg-lastname').value.trim();
    const birthRaw = $('reg-birthdate').value.trim();
    const heightRaw = $('reg-height').value.trim();
    const nationalityField = $('reg-nationality');
    const nationality = (nationalityField ? nationalityField.value : '').trim();
    const backstory = $('reg-backstory').value.trim();

    if (!firstname || !lastname) {
        showError('First name and last name are required.');
        return;
    }

    if (!birthRaw) {
        showError('Date of birth is required.');
        return;
    }
    const birthIso = parseDate(birthRaw, state.dateFormat);
    if (!birthIso) {
        showError(`Date of birth must be a valid date in ${String(state.dateFormat).toUpperCase()} format.`);
        return;
    }
    const minIso = parseDate(state.dateMin, state.dateFormat);
    const maxIso = parseDate(state.dateMax, state.dateFormat);
    if (minIso && birthIso < minIso) {
        showError(`Date of birth cannot be earlier than ${state.dateMin}.`);
        return;
    }
    if (maxIso && birthIso > maxIso) {
        showError(`Date of birth cannot be later than ${state.dateMax}.`);
        return;
    }

    const height = Number(heightRaw);
    if (!heightRaw || !Number.isInteger(height) || height < state.heightMin || height > state.heightMax) {
        showError(`Height must be between ${state.heightMin} and ${state.heightMax} cm.`);
        return;
    }

    if (!nationality) {
        showError('Nationality is required.');
        return;
    }

    if (backstory && backstory.length < state.backstoryMin) {
        showError(`Backstory needs at least ${state.backstoryMin} characters.`);
        return;
    }

    state.busy = true;
    const btn = $('btn-create');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'CREATING...';

    const res = await post('createCharacter', {
        firstname,
        lastname,
        birthdate: birthRaw,
        height,
        nationality,
        gender: state.gender,
        backstory,
    });

    state.busy = false;
    btn.disabled = false;
    btn.innerHTML = original;

    if (!res) {
        showError('Could not reach the server. Press F8 and check for errors.');
        return;
    }
    if (res.ok === false) {
        showError(res.message || 'Could not create character.');
    }
}

function backToIdCard() {
    if (!$('view-register').classList.contains('active')) return;
    const firstExisting = state.slots.findIndex(Boolean);
    if (firstExisting >= 0) showIdCard(firstExisting);
}

function cycleSlot(step) {
    if (!state.maxSlots) return;
    const start = state.selected < 0 ? 0 : state.selected;
    const next = (start + step + state.maxSlots) % state.maxSlots;
    selectSlot(next);
}

/* ---------------- NUI BRIDGE ---------------- */

function openUI(data) {
    state.slots = Array.isArray(data.slots) ? data.slots : [];
    state.maxSlots = Number(data.maxSlots) || state.slots.length || 3;
    state.enableDelete = data.enableDelete !== false;
    state.nationalities = Array.isArray(data.nationalities) ? data.nationalities : [];
    state.limitNationalities = data.limitNationalities !== false;
    state.dateFormat = data.dateFormat || 'YYYY-MM-DD';
    state.dateMin = data.dateMin || '';
    state.dateMax = data.dateMax || '';
    state.heightMin = Number(data.heightMin) || 140;
    state.heightMax = Number(data.heightMax) || 210;
    state.selected = -1;

    document.body.classList.add('ui-open');
    renderSlots();

    const firstExisting = state.slots.findIndex(Boolean);
    if (firstExisting >= 0) showIdCard(firstExisting);
    else openRegister(0);
}

window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.action === 'open') openUI(data);
    if (data.action === 'close') document.body.classList.remove('ui-open');
});

/* ---------------- EVENTS ---------------- */

$('btn-play').addEventListener('click', playSelected);
$('btn-delete').addEventListener('click', askDelete);
$('btn-create').addEventListener('click', submitCreate);
$('btn-back').addEventListener('click', backToIdCard);
$('btn-cancel-delete').addEventListener('click', () => {
    $('confirm-modal').classList.remove('show');
    state.pendingDelete = null;
});
$('btn-confirm-delete').addEventListener('click', confirmDelete);

document.querySelectorAll('.btn-gender').forEach((btn) => {
    btn.addEventListener('click', () => setGender(Number(btn.dataset.gender)));
});

$('reg-backstory').addEventListener('input', (e) => {
    $('reg-count').textContent = `${e.target.value.length} / 300`;
});

$('reg-birthdate').addEventListener('input', (e) => {
    e.target.value = maskDate(e.target.value, state.dateFormat);
});

$('reg-height').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
});

document.addEventListener('keydown', (e) => {
    const modalOpen = $('confirm-modal').classList.contains('show');
    const inCardView = !$('view-id-card').classList.contains('hidden');
    const inRegister = $('view-register').classList.contains('active');
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 'Escape') {
        if (modalOpen) {
            $('confirm-modal').classList.remove('show');
            state.pendingDelete = null;
        } else {
            backToIdCard();
        }
        return;
    }

    if (modalOpen) return;

    if (inCardView) {
        if (e.key === 'Enter') playSelected();
        if (e.key === 'ArrowDown') { e.preventDefault(); cycleSlot(1); }
        if (e.key === 'ArrowUp') { e.preventDefault(); cycleSlot(-1); }
        return;
    }

    if (inRegister && e.key === 'Enter' && typing && tag !== 'TEXTAREA') {
        submitCreate();
    }
});

/* ---------------- NUI READY HANDSHAKE ---------------- */

if (hasNui()) {
    window.addEventListener('load', () => {
        // Báo cho client biết UI đã load xong, client sẽ gửi lại payload 'open'
        post('nuiReady', {});
    });
}

/* ---------------- DEMO (xem thử trên trình duyệt) ---------------- */

if (!hasNui()) {
    window.addEventListener('load', () => {
        openUI({
            slots: [
                {
                    citizenid: 'WE9ZR5AL',
                    firstname: 'Test',
                    lastname: 'Tester',
                    birthdate: '01-12-1999',
                    gender: 0,
                    height: 188,
                    nationality: 'American',
                    job: 'Civilian',
                    cash: '55,000',
                    bank: '0',
                    backstory: 'Just arrived in the city with a duffel bag and a plan.',
                    lastPlayed: '09/10/2026 16:15',
                },
                false,
                false,
            ],
            maxSlots: 3,
            enableDelete: true,
            limitNationalities: true,
            nationalities: ['American', 'Vietnamese', 'British'],
            dateFormat: 'DD-MM-YYYY',
            dateMin: '01-01-1900',
            dateMax: '31-12-2006',
            heightMin: 140,
            heightMax: 210,
        });
    });
}