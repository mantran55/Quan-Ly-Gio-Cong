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
  // Giới hạn số toast
  while (box.children.length >= 5) { box.removeChild(box.firstChild); }

  var el = document.createElement('div');
  el.className = 'toast ' + (type === 'error' ? 'err' : 'ok');
  el.innerHTML =
    '<i class="fa-'+(type === 'error' ? 'solid fa-triangle-exclamation' : 'regular fa-circle-check')+'"></i>' +
    '<span class="toast-message">'+ escapeHtml(msg) +'</span>' +
    '<button class="toast-close" aria-label="close"><i class="fa-solid fa-xmark"></i></button>';
  el.querySelector('.toast-close').onclick = function(){ 
    el.style.animation = 'slideOut 0.3s forwards';
    setTimeout(function(){ el.remove(); }, 300);
  };
  box.appendChild(el);
  setTimeout(function(){ 
    if (el.parentNode) {
      el.style.animation = 'slideOut 0.3s forwards';
      setTimeout(function(){ el.remove(); }, 300);
    }
  }, 10000);
}

// Thêm animation slideOut cho toast
const style = document.createElement('style');
style.textContent = `@keyframes slideOut { to { opacity: 0; transform: translateX(100%) scale(0.9); } }`;
document.head.appendChild(style);

/* ===== STATE (ĐÃ CẬP NHẬT) ===== */
var state = { 
  token:null, 
  email:null, 
  empName:null, 
  employees:[], 
  hoursTotals:{},
  // === THÊM MỚI ===
  // Lưu thông tin đăng nhập để tự động làm mới token
  credentials: null, 
  // Lưu thời gian hết hạn của token (dạng timestamp)
  tokenExpiry: null 
};

/* ===== CORE API & SESSION MANAGEMENT (ĐÃ VIẾT LẠI HOÀN TOÀN) ===== */

// Kiểm tra token có còn hiệu lực không (còn 5 phút dự trữ)
function isTokenValid() {
  if (!state.token || !state.tokenExpiry) return false;
  // Cộng thêm 5 phút (300000 ms) để làm mới token trước khi nó thực sự hết hạn
  return new Date().getTime() < (state.tokenExpiry - 300000); 
}

// Thực hiện lời gọi API gốc
function makeApiCall(path, data) {
  return fetch(API_URL + '?path=' + encodeURIComponent(path), {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(data)
  }).then(function(res){
    if (!res.ok) {
      // Nếu server trả về 401, token đã bị vô hiệu hóa
      if (res.status === 401) {
        handleTokenExpired();
      }
      throw new Error('HTTP ' + res.status);
    }
    return res.json();
  });
}

// Làm mới token bằng cách đăng nhập lại
function refreshToken() {
  if (!state.credentials) return Promise.reject(new Error('No credentials to refresh token.'));
  
  console.log("Token is expiring, refreshing...");
  return api('login', { 
    email: state.credentials.email, 
    password: state.credentials.password 
  }).then(function(r) {
    if (!r || !r.ok) {
      throw new Error('Token refresh failed');
    }
    // Cập nhật token và thời gian hết hạn mới
    state.token = r.token;
    // Giả sử token có hiệu lực 1 giờ (3600000 ms)
    state.tokenExpiry = new Date().getTime() + 3600000; 
    
    // Lưu token mới vào localStorage
    try {
      localStorage.setItem('sunday.token', state.token);
      localStorage.setItem('sunday.tokenExpiry', state.tokenExpiry);
    } catch(_) {}
    
    console.log("Token refreshed successfully.");
    return r;
  });
}

// Xử lý khi token hết hạn và không thể làm mới
function handleTokenExpired() {
  console.warn("Token expired. Logging out.");
  // Xóa phiên
  try {
    localStorage.removeItem('sunday.token');
    localStorage.removeItem('sunday.tokenExpiry');
    // Không xóa credentials để có thể tự động đăng nhập lại lần sau
  } catch(_) {}
  
  state.token = null;
  state.tokenExpiry = null;

  // Chuyển về màn hình đăng nhập
  var app = $('#cardApp'); if (app) app.classList.add('hidden');
  var login = $('#cardLogin'); if (login) login.classList.remove('hidden');
  
  toast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
}

// Hàm API chính, bây giờ đã có khả năng tự làm mới token
function api(path, data) {
  if (!data) data = {};
  // Thêm token vào payload nếu có
  if (state.token) {
    data.token = state.token;
  }

  // Kiểm tra token trước khi gọi
  if (!isTokenValid() && state.credentials) {
    // Token sắp hết hạn, thử làm mới trước
    return refreshToken().then(function() {
      // Gọi lại API với token mới
      data.token = state.token; // Cập nhật token mới
      return makeApiCall(path, data);
    }).catch(function(err) {
      // Làm mới thất bại, xử lý logout
      handleTokenExpired();
      return Promise.reject(err);
    });
  } else {
    // Token còn hiệu lực hoặc không có credentials, gọi API bình thường
    return makeApiCall(path, data);
  }
}

/* ===== UI HELPERS ===== */
function showAppLoading() {
  const app = $('#cardApp');
  if (app) { app.style.opacity = '0.6'; app.style.pointerEvents = 'none'; }
}
function hideAppLoading() {
  const app = $('#cardApp');
  if (app) { app.style.opacity = '1'; app.style.pointerEvents = 'auto'; }
}

/* ===== Theme toggle ===== */
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
    ul = document.createElement('div'); ul.className = 'underline';
    ul.style.cssText = 'position:absolute;height:2px;bottom:-1px;background:linear-gradient(90deg,var(--pri),var(--ok));transition:transform .25s, width .25s';
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
    ['requestTab','hoursTab','scheduleTab'].forEach(function(id){ var el = $('#'+id); if (el) el.classList.add('hidden'); });
    var on = $('#'+btn.getAttribute('data-tab')); if (on) on.classList.remove('hidden');
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
  if (el){ el.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ var btn = $('#btnLogin'); if (btn) btn.click(); } }); }
});

/* ===== Login (ĐÃ CẬP NHẬT) ===== */
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

    // === THÊM MỚI: Lưu thông tin đăng nhập và thời gian hết hạn ===
    state.credentials = { email: email, password: password };
    // Giả sử token có hiệu lực 1 giờ (3600000 ms)
    state.tokenExpiry = new Date().getTime() + 3600000;

    // Lưu phiên
    try{
      localStorage.setItem('sunday.token', state.token);
      localStorage.setItem('sunday.email', state.email);
      localStorage.setItem('sunday.empName', state.empName);
      localStorage.setItem('sunday.credentials', JSON.stringify(state.credentials));
      localStorage.setItem('sunday.tokenExpiry', state.tokenExpiry);
    }catch(_){}

    var who = $('#whoami');
    if (who) who.innerHTML = escapeHtml(state.empName) + ' <span class="muted">(' + escapeHtml(state.email) + ')</span>';

    // Employees
    api('employees', {}).then(function(res){
        var arr = Array.isArray(res) ? res : ((res && res.rows) || (res && res.data) || []);
        state.employees = (arr || []).filter(Boolean).map(String);
        var sel = $('#passEmployee');
        if (sel){ sel.innerHTML = '<option value="">-- Chọn nhân viên --</option>'; state.employees.forEach(function(n){ sel.insertAdjacentHTML('beforeend', '<option>'+ escapeHtml(n) +'</option>'); }); }
      }).catch(function(e){ console.warn('employees load failed', e); });

    // Tổng giờ
    api('hoursTotals', {}).then(function(res){
        var map = {};
        if (res && res.ok && Array.isArray(res.totals)) {
          res.totals.forEach(function(x){ var name = String(x.name||'').trim(); var total = Number(x.total||0); if (name) map[name.toLowerCase()] = total; });
        }
        state.hoursTotals = map;
      }).catch(function(e){ console.warn('hoursTotals load failed', e); });

    var login = $('#cardLogin'); if (login) login.classList.add('hidden');
    var app = $('#cardApp'); if (app) app.classList.remove('hidden');
    toast('Chào mừng, ' + state.empName + '!', 'ok');
    loadRequestList();
  })
  .catch(function(err){ toast(err.message, 'error'); })
  .finally(function(){ btn.disabled = false; btn.innerHTML = old; });
});

/* ===== Toggle “pass ca” ===== */
function countMyPassCa(rows){
  var me = (state.empName || '').trim().toLowerCase(); var c = 0;
  rows.forEach(function(r){ var name = String(r.name || '').trim().toLowerCase(); var issue = String(r.issue || '').trim().toLowerCase(); if (name === me && issue === 'pass ca') c++; });
  return c;
}
var issueSel = $('#issueType');
if (issueSel){
  issueSel.addEventListener('change', function(){
    var isPass = (issueSel.value === 'pass ca');
    var rowEmp = $('#passCaRow'); var rowShift = $('#passShiftRow');
    if (rowEmp) rowEmp.classList.toggle('hidden', !isPass);
    if (rowShift) rowShift.classList.toggle('hidden', !isPass);
    if (isPass && (!state.employees || state.employees.length === 0)) {
      api('employees', {}).then(function(res){
          var arr = Array.isArray(res) ? res : ((res && res.rows) || (res && res.data) || []);
          state.employees = (arr || []).filter(Boolean).map(String);
          var sel = $('#passEmployee');
          if (sel){ sel.innerHTML = '<option value="">-- Chọn nhân viên --</option>'; state.employees.forEach(function(n){ sel.insertAdjacentHTML('beforeend', '<option>'+ escapeHtml(n) +'</option>'); }); }
        }).catch(function(){ toast('Không tải được danh sách nhân viên', 'error'); });
    }
    var btn = $('#btnSend');
    if (isPass) {
      api('listRequests', { limit: 500 }).then(function(r){
          if (!r || !r.ok) return;
          var n = countMyPassCa(r.rows || []); var btn2 = $('#btnSend');
          if (n >= 5 && btn2){ btn2.disabled = true; toast('Đã pass ca tối đa 5 lần. Bạn không còn quyền pass ca nữa — Hãy làm chăm chỉ.', 'error'); }
        }).catch(function(){ /* im lặng */ });
    }
  });
}
var passEmpSel = $('#passEmployee');
if (passEmpSel){
  passEmpSel.addEventListener('change', function(){
    var name = (passEmpSel.value || '').trim(); var total = state.hoursTotals[(name||'').toLowerCase()] || 0; var btn = $('#btnSend');
    if (total > 200){ toast(name + ' đã có hơn 200 giờ công, không thể thực hiện pass ca.', 'error'); if (btn) btn.disabled = true; } else { if (btn) btn.disabled = false; }
  });
}

/* ===== Phiếu yêu cầu ===== */
var btnRefresh = $('#btnRefreshReq');
if (btnRefresh) btnRefresh.addEventListener('click', loadRequestList);
function parseDMY(dmy){
  if (!dmy) return null;
  var m = dmy.trim().replace(/\//g,'-').match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  var d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3]);
  var dt = new Date(y, mo, d, 0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}
var btnSend = $('#btnSend');
if (btnSend){
  btnSend.addEventListener('click', function(){
    var issueType = $('#issueType') ? $('#issueType').value : '';
    var requestDate = $('#requestDate') ? $('#requestDate').value.trim() : '';
    var passEmployee = (issueType === 'pass ca') ? ($('#passEmployee') ? $('#passEmployee').value : '') : '';
    var passShift = (issueType === 'pass ca') ? ($('#passShift') ? $('#passShift').value : '') : '';
    var content = $('#content') ? $('#content').value.trim() : '';
    if (!issueType) { toast('Chọn loại vấn đề','error'); return; } if (!requestDate) { toast('Nhập ngày','error'); return; } if (issueType === 'pass ca' && !passEmployee) { toast('Chọn nhân viên pass ca','error'); return; } if (issueType === 'pass ca' && !passShift) { toast('Chọn ca cần pass','error'); return; } if (!content) { toast('Nhập nội dung','error'); return; }
    if (issueType === 'pass ca') { var name = (passEmployee || '').trim(); var totalLocal = state.hoursTotals[(name||'').toLowerCase()] || 0; if (totalLocal > 200){ toast(name + ' đã có hơn 200 giờ công, không thể thực hiện pass ca.', 'error'); return; } }
    if (issueType === 'pass ca') {
      var passDate = parseDMY(requestDate); if (!passDate){ toast('Ngày pass ca không hợp lệ (định dạng dd-mm-yyyy).', 'error'); return; }
      var now = new Date(); var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
      var diffDays = Math.floor((passDate.getTime() - today0.getTime()) / (24*3600*1000));
      if (diffDays < 0) { toast('Ngày pass ca đã qua — không thể gửi.', 'error'); return; }
      if (diffDays === 0) { var cutoffMap = { ca1:{h:5,m:0}, ca2:{h:10,m:0}, ca3:{h:15,m:0} }; var cfg = cutoffMap[String(passShift || '').toLowerCase()]; if (!cfg){ toast('Vui lòng chọn ca hợp lệ.', 'error'); return; } var cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cfg.h, cfg.m, 0, 0); if (now.getTime() > cutoff.getTime()){ toast('Bạn cần phải tạo Pass ca trước 2 tiếng. Phiếu của bạn không được duyệt.', 'error'); return; } }
    }
    btnSend.disabled = true; var old = btnSend.innerHTML; btnSend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi…';
    var contentToSend = content;
    if (issueType === 'pass ca') { var labelMap = { ca1: 'ca 1', ca2: 'ca 2', ca3: 'ca 3' }; var label = labelMap[String(passShift || '').toLowerCase()] || ''; if (label) contentToSend = (content + ' ' + label).trim(); }
    api('submit', { payload:{ issueType: issueType, requestDate: requestDate, passEmployee: passEmployee, passShift: passShift, content: contentToSend }})
    .then(function(r){ if (!r || !r.ok){ toast((r && r.message) ? r.message : 'Gửi thất bại', 'error'); return; } var isel = $('#issueType'); if (isel) isel.value = ''; var dsel = $('#requestDate'); if (dsel) dsel.value = ''; var psel = $('#passEmployee'); if (psel) psel.value = ''; var ssel = $('#passShift'); if (ssel) ssel.value = ''; var csel = $('#content'); if (csel) csel.value = ''; var row1 = $('#passCaRow'); if (row1) row1.classList.add('hidden'); var row2 = $('#passShiftRow'); if (row2) row2.classList.add('hidden'); toast('Đã gửi phiếu yêu cầu!', 'ok'); loadRequestList(); })
    .catch(function(e){ toast(String(e), 'error'); })
    .finally(function(){ btnSend.disabled = false; btnSend.innerHTML = old; });
  });
}
function loadRequestList(){
  var body = $('#reqBody'); if (!body) return;
  showAppLoading(); body.innerHTML = '<tr><td colspan="6" class="muted">Đang tải…</td></tr>';
  api('listRequests', { limit: 100 }).then(function(r){
      if (!r || !r.ok){ body.innerHTML = '<tr><td colspan="6">' + escapeHtml((r && r.message) || 'Không tải được.') + '</td></tr>'; return; }
      var rows = r.rows || [];
      if (!rows.length){ body.innerHTML = '<tr><td colspan="6" class="muted">Chưa có yêu cầu.</td></tr>'; return; }
      body.innerHTML = rows.map(function(x){ return '<tr><td>'+escapeHtml(x.created) +'</td><td>'+escapeHtml(x.name) +'</td><td>'+escapeHtml(x.issue) +'</td><td>'+escapeHtml(x.reqDate) +'</td><td>'+escapeHtml(x.passEmp) +'</td><td>'+escapeHtml(x.content) +'</td></tr>'; }).join('');
    }).catch(function(e){ body.innerHTML = '<tr><td colspan="6">'+ escapeHtml(String(e)) +'</td></tr>'; })
    .finally(function() { hideAppLoading(); });
}

/* ===== Giờ công ===== */
function loadHours(){
  var box = $('#hoursBox'); if (!box) return;
  showAppLoading(); box.classList.add('skeleton'); box.textContent = 'Đang tải…';
  var tbl = $('#hoursTable'); if (tbl) tbl.classList.add('hidden'); var thd = $('#hoursHead'); if (thd) thd.innerHTML = ''; var tr = $('#hoursRow'); if (tr) tr.innerHTML = '';
  api('hours', {}).then(function(r){
      if (!r || !r.ok){ box.classList.remove('skeleton'); box.textContent = (r && r.message) ? r.message : 'Không tải được.'; return; }
      var title = $('#hoursTitle'); if (title){ title.innerHTML = '<i class="fa-regular fa-clock"></i> ' + (r.title ? (escapeHtml(r.title) + ' — ' + escapeHtml(state.empName)) : ('Giờ Công — ' + escapeHtml(state.empName))); }
      var headerRows = Array.isArray(r.header) ? r.header : []; var rowRaw = Array.isArray(r.row) ? r.row : [];
      if (headerRows.length < 1 || !rowRaw.length){ box.classList.remove('skeleton'); box.textContent = 'Không thấy dữ liệu cho ' + (state.empName || ''); return; }
      var totalCols = 0; if (headerRows.length >= 2) totalCols = renderTwoRowHeader(headerRows[0], headerRows[1]); else totalCols = renderOneRowHeader(headerRows[0]);
      var data = rowRaw.slice(0, totalCols); var trEl = $('#hoursRow'); if (trEl) trEl.innerHTML = '';
      for (var i=0;i<data.length;i++){ var td = document.createElement('td'); var c = data[i]; td.textContent = c; if (/^\d+([.,]\d+)?$/.test(String(c).trim())) td.classList.add('num'); if (trEl) trEl.appendChild(td); }
      box.classList.remove('skeleton'); box.textContent = ''; if (tbl) tbl.classList.remove('hidden');
    }).catch(function(e){ box.classList.remove('skeleton'); box.textContent = String(e); })
    .finally(function() { hideAppLoading(); });
}
function renderOneRowHeader(row){ var thead = $('#hoursHead'); if (!thead) return 0; thead.innerHTML = ''; var tr = document.createElement('tr'); for (var i=0;i<row.length;i++){ var th = document.createElement('th'); th.textContent = String(row[i] || '').trim(); tr.appendChild(th); } thead.appendChild(tr); return row.length; }
function renderTwoRowHeader(topRow, bottomRow){ var thead = $('#hoursHead'); if (!thead) return 0; thead.innerHTML = ''; var top = topRow.map(function(v){ return String(v||'').trim(); }); var bot = bottomRow.map(function(v){ return String(v||'').trim(); }); var groups = []; for (var i=0;i<top.length;i++){ var t = top[i]; if (t === '' && groups.length) groups[groups.length-1].span += 1; else groups.push({ text:t, span:1 }); } var totalSpan = groups.reduce(function(s,g){ return s + g.span; }, 0); while (bot.length < totalSpan) bot.push(''); if (bot.length > totalSpan) bot.length = totalSpan; var trTop = document.createElement('tr'); groups.forEach(function(g){ var th = document.createElement('th'); th.textContent = g.text || ''; th.colSpan = g.span; trTop.appendChild(th); }); var trBot = document.createElement('tr'); var idx = 0; groups.forEach(function(g){ for (var k=0;k<g.span;k++){ var th = document.createElement('th'); th.textContent = bot[idx++] || ''; trBot.appendChild(th); } }); thead.appendChild(trTop); thead.appendChild(trBot); return totalSpan; }

/* ===== ĐĂNG KÝ LỊCH ===== */
var schedMeta = null; var schedState = [];
function loadSchedule(){ var grid = $('#schedGrid'); if (!grid) return; showAppLoading(); grid.innerHTML = '<div class="glass card skeleton" style="height:120px">Đang tải…</div>'; api('scheduleGet', {}).then(function(r){ if (!r || !r.ok){ grid.innerHTML = '<div class="muted">' + escapeHtml((r && r.message) || 'Không tải được.') + '</div>'; return; } schedMeta = r.meta || { days: [] }; var expected = (schedMeta.days && schedMeta.days.length ? schedMeta.days.length : 0) * 3; var sel = Array.isArray(r.selected) ? r.selected.slice(0, expected) : []; while (sel.length < expected) sel.push(false); schedState = sel; renderScheduleGrid(); var noteEl = $('#scheduleNote'); if (noteEl && typeof r.note === 'string') noteEl.value = r.note; }).catch(function(e){ grid.innerHTML = '<div class="muted">' + escapeHtml(String(e)) + '</div>'; }).finally(function() { hideAppLoading(); }); }
function renderScheduleGrid(){ var grid = $('#schedGrid'); if (!grid) return; grid.innerHTML = ''; if (!schedMeta || !schedMeta.days || !schedMeta.days.length){ grid.innerHTML = '<div class="muted">Không có ngày nào.</div>'; return; } schedMeta.days.forEach(function(d, i){ var k1 = i*3, k2 = i*3+1, k3 = i*3+2; var card = document.createElement('div'); card.className = 'shift-card'; card.innerHTML = '<div class="shift-head"><div>'+ escapeHtml(d.dayName || '') +'</div><span class="badge">Chọn ca:</span><div class="shift-date">'+ escapeHtml(d.date || '') +'</div></div><div class="shift-actions"><button class="ca-btn '+(schedState[k1]?'active':'')+'" data-idx="'+k1+'" type="button">CA 1</button><button class="ca-btn '+(schedState[k2]?'active':'')+'" data-idx="'+k2+'" type="button">CA 2</button><button class="ca-btn '+(schedState[k3]?'active':'')+'" data-idx="'+k3+'" type="button">CA 3</button></div>'; card.addEventListener('click', function(e){ var b = e.target && e.target.closest ? e.target.closest('.ca-btn') : null; if (!b) return; var idx = Number(b.getAttribute('data-idx')); schedState[idx] = !schedState[idx]; b.classList.toggle('active', schedState[idx]); }); grid.appendChild(card); }); }
var btnSchedReload = $('#btnSchedReload'); if (btnSchedReload) btnSchedReload.addEventListener('click', loadSchedule);
var btnSchedClear = $('#btnSchedClear'); if (btnSchedClear){ btnSchedClear.addEventListener('click', function(){ if (!schedState || !schedState.length) return; schedState.fill(false); renderScheduleGrid(); }); }
var btnSchedSave = $('#btnSchedSave'); if (btnSchedSave){ btnSchedSave.addEventListener('click', function(){ btnSchedSave.disabled = true; var old = btnSchedSave.innerHTML; btnSchedSave.innerHTML = '<div class="spinner"></div> Đang lưu...'; var noteEl = $('#scheduleNote'); var note = noteEl && noteEl.value ? noteEl.value.trim() : ''; api('scheduleSave', { selected: schedState, note: note }).then(function(r){ if (!r || !r.ok){ toast((r && r.message) ? r.message : 'Lưu thất bại','error'); return; } alert('Lưu thành công! Nhấn OK để đóng.'); if (r.warning) toast(r.warning, 'error'); }).catch(function(e){ toast(String(e), 'error'); }).finally(function(){ btnSchedSave.disabled = false; btnSchedSave.innerHTML = old; }); }); }

/* ===== Logout (ĐÃ CẬP NHẬT) ===== */
var btnLogout = $('#btnLogout');
if (btnLogout){
  btnLogout.addEventListener('click', function(){
    try {
      localStorage.removeItem('sunday.token');
      localStorage.removeItem('sunday.email');
      localStorage.removeItem('sunday.empName');
      // === THÊM MỚI ===
      localStorage.removeItem('sunday.credentials');
      localStorage.removeItem('sunday.tokenExpiry');
    } catch(_){}
    state.token = null; state.email = null; state.empName = null; state.employees = []; state.hoursTotals = {};
    // === THÊM MỚI ===
    state.credentials = null; state.tokenExpiry = null;
    var app = $('#cardApp'); if (app) app.classList.add('hidden'); var login = $('#cardLogin'); if (login) login.classList.remove('hidden'); toast('Đã đăng xuất', 'ok');
  });
}

/* ===== Khôi phục phiên (ĐÃ VIẾT LẠI HOÀN TOÀN) ===== */
function restoreSession(){
  var t = null, email = null, emp = null, expiry = null, credentials = null;
  try {
    t = localStorage.getItem('sunday.token');
    email = localStorage.getItem('sunday.email');
    emp = localStorage.getItem('sunday.empName');
    expiry = localStorage.getItem('sunday.tokenExpiry');
    credentials = localStorage.getItem('sunday.credentials');
  } catch(_) {}

  if (!t || !emp) {
    // Không có phiên, ở lại màn hình đăng nhập
    return;
  }

  // Khôi phục state
  state.token = t; state.email = email || ''; state.empName = emp || ''; state.tokenExpiry = expiry ? parseInt(expiry) : null;
  try { state.credentials = credentials ? JSON.parse(credentials) : null; } catch(_) { state.credentials = null; }

  var who = $('#whoami'); if (who) who.innerHTML = escapeHtml(state.empName) + ' <span class="muted">(' + escapeHtml(state.email) + ')</span>';
  var login = $('#cardLogin'); if (login) login.classList.add('hidden'); var app = $('#cardApp'); if (app) app.classList.remove('hidden');

  // Kiểm tra token có còn hiệu lực không
  if (!isTokenValid()) {
    // Token đã hết hạn, thử làm mới
    if (state.credentials) {
      toast('Phiên đăng nhập cũ, đang tự động đăng nhập lại...', 'ok');
      refreshToken().then(function() {
        // Thành công, tải dữ liệu
        loadRequestList();
      }).catch(function(err) {
        // Thất bại, `handleTokenExpired` đã được gọi trong `refreshToken`
        console.error("Auto-refresh token failed:", err);
      });
    } else {
      // Không có thông tin để làm mới, chuyển về login
      handleTokenExpired();
    }
  } else {
    // Token còn hiệu lực, tải dữ liệu bình thường
    api('hoursTotals', {}).then(function(res){
        var map = {}; if (res && res.ok && Array.isArray(res.totals)) { res.totals.forEach(function(x){ var name = String(x.name||'').trim(); var total = Number(x.total||0); if (name) map[name.toLowerCase()] = total; }); } state.hoursTotals = map;
      }).catch(function(e){ console.warn('hoursTotals (restore) failed', e); });
    loadRequestList();
  }
}
