/* ===== CONFIG (GIỮ NGUYÊN URL) ===== */
const API_URL = "https://proxy.mantrandinhminh.workers.dev/api";

/* ===== Helpers ===== */
const $  = function (s) { return document.querySelector(s); };
const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
}

function toast(msg, type){
  if (type !== 'error') type = 'ok';
  var box = $('#toastContainer');
  if (!box) { alert(msg); return; }
  var el = document.createElement('div');
  el.className = 'toast ' + (type === 'error' ? 'err' : 'ok');
  el.innerHTML =
    '<i class="fa-'+(type === 'error' ? 'solid fa-triangle-exclamation' : 'regular fa-circle-check')+'"></i>' +
    '<span class="toast-message">'+ escapeHtml(msg) +'</span>' +
    '<button class="toast-close" aria-label="close"><i class="fa-solid fa-xmark"></i></button>';
  el.querySelector('.toast-close').onclick = function(){ el.remove(); };
  box.appendChild(el);
  setTimeout(function(){ el.remove(); }, 3000);
}

function api(path, data){
  if (!data) data = {};
  return fetch(API_URL + '?path=' + encodeURIComponent(path), {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(data)
  }).then(function(res){
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  });
}

/* ===== State ===== */
var state = { token:null, email:null, empName:null, employees:[] };

/* ===== Theme toggle (không dùng cũng không sao) ===== */
var themeBtn = $('#themeToggle');
if (themeBtn){
  themeBtn.addEventListener('click', function(){
    var dark = document.body.classList.toggle('theme-dark');
    if (!dark) document.body.classList.add('theme-light');
    else document.body.classList.remove('theme-light');
  });
}

/* ===== Tabs + underline ===== */
function ensureUnderline(){
  var tabs = $('.tabs'); if (!tabs) return null;
  var ul = document.querySelector('.tabs .underline');
  if (!ul){
    ul = document.createElement('div');
    ul.className = 'underline';
    ul.style.position = 'absolute';
    ul.style.height = '2px';
    ul.style.bottom = '-1px';
    ul.style.background = 'linear-gradient(90deg,var(--pri),var(--ok))';
    ul.style.transition = 'transform .25s, width .25s';
    tabs.appendChild(ul);
  }
  return ul;
}

function setUnderlineTo(btn){
  var ul = ensureUnderline();
  if (!ul || !btn) return;
  ul.style.width = btn.offsetWidth + 'px';
  ul.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
}

$$('.tabs .tab').forEach(function(btn){
  btn.addEventListener('click', function(){
    $$('.tabs .tab').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    setUnderlineTo(btn);

    ['requestTab','hoursTab','scheduleTab'].forEach(function(id){
      var el = $('#'+id);
      if (el) el.classList.add('hidden');
    });
    var on = $('#'+btn.getAttribute('data-tab'));
    if (on) on.classList.remove('hidden');

    var tab = btn.getAttribute('data-tab');
    if (tab === 'scheduleTab') loadSchedule();
    if (tab === 'hoursTab')    loadHours();
  });
});

window.addEventListener('load', function(){
  ensureUnderline();
  setUnderlineTo(document.querySelector('.tabs .tab.active'));
  restoreSession();
});

/* ===== Enter để đăng nhập ===== */
['#email','#password'].forEach(function(sel){
  var el = $(sel);
  if (el){
    el.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){
        var btn = $('#btnLogin');
        if (btn) btn.click();
      }
    });
  }
});

/* ===== Login ===== */
document.addEventListener('click', function(e){
  var btn = e.target && e.target.closest ? e.target.closest('#btnLogin') : null;
  if (!btn) return;

  var email = $('#email') ? $('#email').value.trim() : '';
  var password = $('#password') ? $('#password').value.trim() : '';
  btn.disabled = true;
  var old = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập…';
  var msg = $('#loginMsg'); if (msg) msg.textContent = '';

  if (!email || !password){
    if (msg) msg.textContent = 'Nhập đầy đủ email và mật khẩu';
    btn.disabled = false; btn.innerHTML = old;
    return;
  }

  api('login', { email: email, password: password })
  .then(function(r){
    if (!r || !r.ok){
      if (msg) msg.textContent = (r && r.message) ? r.message : 'Đăng nhập thất bại.';
      toast((r && r.message) ? r.message : 'Đăng nhập thất bại.', 'error');
      return;
    }
    state.token = r.token; state.email = r.email; state.empName = r.empName;

    // Lưu phiên
    try{
      localStorage.setItem('sunday.token', state.token || '');
      localStorage.setItem('sunday.email', state.email || '');
      localStorage.setItem('sunday.empName', state.empName || '');
    }catch(_){}

    var who = $('#whoami');
    if (who) who.innerHTML = escapeHtml(state.empName) + ' <span class="muted">(' + escapeHtml(state.email) + ')</span>';

    // Employees
    // Employees (robust parsing, không dùng await ở đây)
api('employees', {})
  .then(function(res){
    var arr = [];
    if (Array.isArray(res)) arr = res;                   // API trả mảng trực tiếp
    else if (res && Array.isArray(res.rows)) arr = res.rows; // { rows: [...] }
    else if (res && Array.isArray(res.data)) arr = res.data; // { data: [...] }

    state.employees = (arr || []).filter(Boolean).map(String);

    var sel = $('#passEmployee');
    if (sel){
      sel.innerHTML = '<option value="">-- Chọn nhân viên --</option>';
      state.employees.forEach(function(n){
        sel.insertAdjacentHTML('beforeend', '<option>'+ escapeHtml(n) +'</option>');
      });
    }
  })
  .catch(function(e){
    console.warn('employees load failed', e);
  });


    var login = $('#cardLogin'); if (login) login.classList.add('hidden');
    var app = $('#cardApp'); if (app) app.classList.remove('hidden');
    toast('Chào mừng, ' + state.empName + '!', 'ok');
    loadRequestList();
  })
  .catch(function(err){
    toast(err.message, 'error');
  })
  .finally(function(){
    btn.disabled = false;
    btn.innerHTML = old;
  });
});

/* Toggle pass-ca employee row */
var issueSel = $('#issueType');
if (issueSel){
  issueSel.addEventListener('change', function(){
  var isPass = (issueSel.value === 'pass ca');
  var row = $('#passCaRow');
  if (row) row.classList.toggle('hidden', !isPass);

  // Nếu vừa chọn "pass ca" mà chưa có danh sách -> tải ngay
  if (isPass && (!state.employees || state.employees.length === 0)) {
    api('employees', {})
      .then(function(res){
        var arr = Array.isArray(res) ? res : ((res && res.rows) || (res && res.data) || []);
        state.employees = (arr || []).filter(Boolean).map(String);

        var sel = $('#passEmployee');
        if (sel){
          sel.innerHTML = '<option value="">-- Chọn nhân viên --</option>';
          state.employees.forEach(function(n){
            sel.insertAdjacentHTML('beforeend', '<option>'+ escapeHtml(n) +'</option>');
          });
        }
      })
      .catch(function(){
        toast('Không tải được danh sách nhân viên', 'error');
      });
    }
  });

}

/* ===== Phiếu yêu cầu ===== */
var btnRefresh = $('#btnRefreshReq');
if (btnRefresh) btnRefresh.addEventListener('click', loadRequestList);

var btnSend = $('#btnSend');
if (btnSend){
  btnSend.addEventListener('click', function(){
    var issueType = $('#issueType') ? $('#issueType').value : '';
    var requestDate = $('#requestDate') ? $('#requestDate').value.trim() : '';
    var passEmployee = (issueType === 'pass ca') ? ($('#passEmployee') ? $('#passEmployee').value : '') : '';
    var content = $('#content') ? $('#content').value.trim() : '';

    if (!issueType) { toast('Chọn loại vấn đề','error'); return; }
    if (!requestDate) { toast('Nhập ngày','error'); return; }
    if (issueType === 'pass ca' && !passEmployee) { toast('Chọn nhân viên pass ca','error'); return; }
    if (!content) { toast('Nhập nội dung','error'); return; }

    btnSend.disabled = true;
    var old = btnSend.innerHTML;
    btnSend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi…';

    api('submit', { token: state.token, payload:{ issueType:issueType, requestDate:requestDate, passEmployee:passEmployee, content:content } })
    .then(function(r){
      if (!r || !r.ok){ toast((r && r.message) ? r.message : 'Gửi thất bại', 'error'); return; }

      var isel = $('#issueType'); if (isel) isel.value = '';
      var dsel = $('#requestDate'); if (dsel) dsel.value = '';
      var psel = $('#passEmployee'); if (psel) psel.value = '';
      var csel = $('#content'); if (csel) csel.value = '';
      var row = $('#passCaRow'); if (row) row.classList.add('hidden');

      toast('Đã gửi phiếu yêu cầu!', 'ok');
      loadRequestList();
    })
    .catch(function(e){ toast(String(e), 'error'); })
    .finally(function(){
      btnSend.disabled = false;
      btnSend.innerHTML = old;
    });
  });
}

function loadRequestList(){
  var body = $('#reqBody'); if (!body) return;
  body.innerHTML = '<tr><td colspan="6" class="muted">Đang tải…</td></tr>';
  api('listRequests', { token: state.token, limit: 100 })
  .then(function(r){
    if (!r || !r.ok){
      body.innerHTML = '<tr><td colspan="6">' + escapeHtml((r && r.message) || 'Không tải được.') + '</td></tr>';
      return;
    }
    var rows = r.rows || [];
    if (!rows.length){
      body.innerHTML = '<tr><td colspan="6" class="muted">Chưa có yêu cầu.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function(x){
      return '<tr>'
        + '<td>'+escapeHtml(x.created) +'</td>'
        + '<td>'+escapeHtml(x.name)    +'</td>'
        + '<td>'+escapeHtml(x.issue)   +'</td>'
        + '<td>'+escapeHtml(x.reqDate) +'</td>'
        + '<td>'+escapeHtml(x.passEmp) +'</td>'
        + '<td>'+escapeHtml(x.content) +'</td>'
        + '</tr>';
    }).join('');
  })
  .catch(function(e){
    body.innerHTML = '<tr><td colspan="6">'+ escapeHtml(String(e)) +'</td></tr>';
  });
}

/* ===== Giờ công ===== */
function loadHours(){
  var box = $('#hoursBox'); if (!box) return;
  box.classList.add('skeleton');
  box.textContent = 'Đang tải…';
  var tbl = $('#hoursTable'); if (tbl) tbl.classList.add('hidden');
  var thd = $('#hoursHead'); if (thd) thd.innerHTML = '';
  var tr  = $('#hoursRow');  if (tr)  tr.innerHTML = '';

  api('hours', { token: state.token })
  .then(function(r){
    if (!r || !r.ok){
      box.classList.remove('skeleton');
      box.textContent = (r && r.message) ? r.message : 'Không tải được.';
      return;
    }

    var title = $('#hoursTitle');
    if (title){
      title.innerHTML = '<i class="fa-regular fa-clock"></i> '
        + (r.title ? (escapeHtml(r.title) + ' — ' + escapeHtml(state.empName)) : ('Giờ Công — ' + escapeHtml(state.empName)));
    }

    var headerRows = Array.isArray(r.header) ? r.header : [];
    var rowRaw     = Array.isArray(r.row)    ? r.row    : [];

    if (headerRows.length < 1 || !rowRaw.length){
      box.classList.remove('skeleton');
      box.textContent = 'Không thấy dữ liệu cho ' + (state.empName || '');
      return;
    }

    var totalCols = 0;
    if (headerRows.length >= 2) totalCols = renderTwoRowHeader(headerRows[0], headerRows[1]);
    else totalCols = renderOneRowHeader(headerRows[0]);

    var data = rowRaw.slice(0, totalCols);
    var trEl = $('#hoursRow'); if (trEl) trEl.innerHTML = '';
    for (var i=0;i<data.length;i++){
      var td = document.createElement('td');
      var c = data[i];
      td.textContent = c;
      if (/^\d+([.,]\d+)?$/.test(String(c).trim())) td.classList.add('num');
      if (trEl) trEl.appendChild(td);
    }

    box.classList.remove('skeleton');
    box.textContent = '';
    if (tbl) tbl.classList.remove('hidden');
  })
  .catch(function(e){
    box.classList.remove('skeleton');
    box.textContent = String(e);
  });
}

function renderOneRowHeader(row){
  var thead = $('#hoursHead'); if (!thead) return 0;
  thead.innerHTML = '';
  var tr = document.createElement('tr');
  for (var i=0;i<row.length;i++){
    var th = document.createElement('th');
    th.textContent = String(row[i] || '').trim();
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  return row.length;
}

function renderTwoRowHeader(topRow, bottomRow){
  var thead = $('#hoursHead'); if (!thead) return 0;
  thead.innerHTML = '';

  var top = topRow.map(function(v){ return String(v||'').trim(); });
  var bot = bottomRow.map(function(v){ return String(v||'').trim(); });

  var groups = [];
  for (var i=0;i<top.length;i++){
    var t = top[i];
    if (t === '' && groups.length) groups[groups.length-1].span += 1;
    else groups.push({ text:t, span:1 });
  }
  var totalSpan = groups.reduce(function(s,g){ return s + g.span; }, 0);

  while (bot.length < totalSpan) bot.push('');
  if (bot.length > totalSpan) bot.length = totalSpan;

  var trTop = document.createElement('tr');
  groups.forEach(function(g){
    var th = document.createElement('th');
    th.textContent = g.text || '';
    th.colSpan = g.span;
    trTop.appendChild(th);
  });

  var trBot = document.createElement('tr');
  var idx = 0;
  groups.forEach(function(g){
    for (var k=0;k<g.span;k++){
      var th = document.createElement('th');
      th.textContent = bot[idx++] || '';
      trBot.appendChild(th);
    }
  });

  thead.appendChild(trTop);
  thead.appendChild(trBot);
  return totalSpan;
}

/* ===== ĐĂNG KÝ LỊCH ===== */
var schedMeta = null; // { days: [...] }
var schedState = [];  // boolean[]

function loadSchedule(){
  var grid = $('#schedGrid'); if (!grid) return;
  grid.innerHTML = '<div class="glass card skeleton" style="height:120px">Đang tải…</div>';

  api('scheduleGet', { token: state.token })
  .then(function(r){
    if (!r || !r.ok){
      grid.innerHTML = '<div class="muted">' + escapeHtml((r && r.message) || 'Không tải được.') + '</div>';
      return;
    }

    schedMeta = r.meta || { days: [] };
    var expected = (schedMeta.days && schedMeta.days.length ? schedMeta.days.length : 0) * 3;
    var sel = Array.isArray(r.selected) ? r.selected.slice(0, expected) : [];
    while (sel.length < expected) sel.push(false);
    schedState = sel;

    renderScheduleGrid();

    var noteEl = $('#scheduleNote');
    if (noteEl && typeof r.note === 'string') noteEl.value = r.note;
  })
  .catch(function(e){
    grid.innerHTML = '<div class="muted">' + escapeHtml(String(e)) + '</div>';
  });
}

function renderScheduleGrid(){
  var grid = $('#schedGrid'); if (!grid) return;
  grid.innerHTML = '';
  if (!schedMeta || !schedMeta.days || !schedMeta.days.length){
    grid.innerHTML = '<div class="muted">Không có ngày nào.</div>';
    return;
  }

  schedMeta.days.forEach(function(d, i){
    var k1 = i*3, k2 = i*3+1, k3 = i*3+2;

    var card = document.createElement('div');
    card.className = 'shift-card';
    card.innerHTML =
      '<div class="shift-head">' +
        '<div>'+ escapeHtml(d.dayName || '') +'</div>' +
        '<span class="badge">Chọn ca:</span>' +
        '<div class="shift-date">'+ escapeHtml(d.date || '') +'</div>' +
      '</div>' +
      '<div class="shift-actions">' +
        '<button class="ca-btn '+(schedState[k1]?'active':'')+'" data-idx="'+k1+'" type="button">CA 1</button>' +
        '<button class="ca-btn '+(schedState[k2]?'active':'')+'" data-idx="'+k2+'" type="button">CA 2</button>' +
        '<button class="ca-btn '+(schedState[k3]?'active':'')+'" data-idx="'+k3+'" type="button">CA 3</button>' +
      '</div>';

    card.addEventListener('click', function(e){
      var b = e.target && e.target.closest ? e.target.closest('.ca-btn') : null;
      if (!b) return;
      var idx = Number(b.getAttribute('data-idx'));
      schedState[idx] = !schedState[idx];
      b.classList.toggle('active', schedState[idx]);
    });

    grid.appendChild(card);
  });
}

/* Nút đăng ký lịch */
var btnSchedReload = $('#btnSchedReload');
if (btnSchedReload) btnSchedReload.addEventListener('click', loadSchedule);

var btnSchedClear = $('#btnSchedClear');
if (btnSchedClear){
  btnSchedClear.addEventListener('click', function(){
    if (!schedState || !schedState.length) return;
    schedState.fill(false);
    renderScheduleGrid();
  });
}

var btnSchedSave = $('#btnSchedSave');
if (btnSchedSave){
  btnSchedSave.addEventListener('click', function(){
    btnSchedSave.disabled = true;
    var old = btnSchedSave.innerHTML;
    btnSchedSave.innerHTML = '<div class="spinner"></div> Đang lưu...';

    var noteEl = $('#scheduleNote');
    var note = noteEl && noteEl.value ? noteEl.value.trim() : '';

    api('scheduleSave', { token: state.token, selected: schedState, note: note })
    .then(function(r){
      if (!r || !r.ok){ toast((r && r.message) ? r.message : 'Lưu thất bại','error'); return; }
      alert('Lưu thành công! Nhấn OK để đóng.');
      if (r.warning) toast(r.warning, 'error');
    })
    .catch(function(e){ toast(String(e), 'error'); })
    .finally(function(){
      btnSchedSave.disabled = false;
      btnSchedSave.innerHTML = old;
    });
  });
}

/* ===== Logout ===== */
var btnLogout = $('#btnLogout');
if (btnLogout){
  btnLogout.addEventListener('click', function(){
    // Xoá localStorage
    try {
      localStorage.removeItem('sunday.token');
      localStorage.removeItem('sunday.email');
      localStorage.removeItem('sunday.empName');
    } catch(_){}

    // Reset state
    state.token = null;
    state.email = null;
    state.empName = null;
    state.employees = [];

    // Chuyển UI về màn login
    var app = $('#cardApp'); if (app) app.classList.add('hidden');
    var login = $('#cardLogin'); if (login) login.classList.remove('hidden');

    toast('Đã đăng xuất', 'ok');
  });
}

/* ===== Khôi phục phiên nếu có ===== */
function restoreSession(){
  var t    = null, email = null, emp = null;
  try{
    t = localStorage.getItem('sunday.token');
    email = localStorage.getItem('sunday.email');
    emp = localStorage.getItem('sunday.empName');
  }catch(_){}

  if (!t || !emp) return;

  state.token = t;
  state.email = email || '';
  state.empName = emp || '';

  var who = $('#whoami');
  if (who) who.innerHTML = escapeHtml(state.empName) + ' <span class="muted">(' + escapeHtml(state.email) + ')</span>';

  var login = $('#cardLogin'); if (login) login.classList.add('hidden');
  var app = $('#cardApp'); if (app) app.classList.remove('hidden');

  loadRequestList();
}
