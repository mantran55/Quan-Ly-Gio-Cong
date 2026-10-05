// ===== CONFIG & HELPERS =====
    const API_URL = "https://proxy.mantrandinhminh.workers.dev/api";
    const $ = s => document.querySelector(s);
    const $$ = s => Array.from(document.querySelectorAll(s));
    const escapeHtml = s => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
    
    function toast(msg, type) {
      var box = $('#toastContainer'); if (!box) return;
      while (box.children.length >= 3) box.removeChild(box.firstChild);
      var el = document.createElement('div');
      el.className = 'toast ' + (type === 'error' ? 'err' : 'ok');
      el.innerHTML = '<i class="fa-'+(type==='error'?'solid fa-circle-exclamation':'regular fa-circle-check')+'"></i><span>'+ escapeHtml(msg) +'</span>';
      box.appendChild(el);
      setTimeout(() => { el.style.opacity='0'; setTimeout(() => el.remove(), 300); }, 3000);
    }

    // ===== STATE & API =====
    var state = { token:null, email:null, empName:null, employees:[], credentials:null, tokenExpiry:null };
    function isTokenValid() { return state.token && state.tokenExpiry && new Date().getTime() < (state.tokenExpiry - 300000); }
    function makeApiCall(path, data) {
      return fetch(API_URL + '?path=' + encodeURIComponent(path), {
        method: 'POST', headers: { 'Content-Type':'text/plain;charset=UTF-8' }, body: JSON.stringify(data)
      }).then(async res => {
        var result;
        try { result = await res.json(); } catch (_) { result = null; }
        if (res.status === 401 || (result && result.ok === false && /(?:token|phiên).*hết hạn/i.test(result.message || ''))) {
          handleTokenExpired();
          throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        }
        if (!res.ok) {
          throw new Error('API ' + path + ' trả HTTP ' + res.status +
            (res.status === 404 ? ': máy chủ không tìm thấy tài nguyên được yêu cầu.' : '.') +
            (result && typeof result.message === 'string' ? ' ' + result.message : ''));
        }
        if (result === null) throw new Error('API ' + path + ' trả phản hồi không hợp lệ.');
        return result;
      });
    }
    var tokenRefreshPending = null;
    function refreshToken() {
      if (tokenRefreshPending) return tokenRefreshPending;
      if (!state.credentials) return Promise.reject();
      tokenRefreshPending = makeApiCall('login', state.credentials).then(r => {
        if (!r || !r.ok) throw new Error('Refresh failed');
        state.token = r.token; state.tokenExpiry = new Date().getTime() + 3600000;
        localStorage.setItem('sunday.token', state.token); localStorage.setItem('sunday.tokenExpiry', state.tokenExpiry);
        return r;
      }).finally(() => { tokenRefreshPending = null; });
      return tokenRefreshPending;
    }
    function handleTokenExpired() {
      localStorage.clear(); state.token = null;
      schedMeta = null; schedState = []; schedLoadedAt = 0; schedDirty = false;
      $('#cardApp')?.classList.add('hidden'); $('#mainNav')?.classList.add('hidden'); $('#cardLogin')?.classList.remove('hidden');
      toast('Phiên hết hạn', 'error');
    }
    function apiUncached(path, data) {
      data = data || {};
      if (state.token) data.token = state.token;
      if (!isTokenValid() && state.credentials) {
        return refreshToken().then(() => { data.token = state.token; return makeApiCall(path, data); });
      }
      return makeApiCall(path, data);
    }
    // Keep only successful read responses in memory, scoped to the current session.
    const readCache = new Map(), readPending = new Map();
    function api(path, data) {
      const ttl = path === 'hours' ? 15000 : path === 'employees' ? 60000 : 0;
      if (!ttl) return apiUncached(path, data);
      const key = JSON.stringify([state.token, path, data || {}]);
      const cached = readCache.get(key);
      if (isTokenValid() && cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
      if (readPending.has(key)) return readPending.get(key);
      const pending = apiUncached(path, data).then(result => {
        if (result && (result.ok === true || Array.isArray(result))) {
          if (readCache.size >= 20) readCache.clear();
          readCache.set(key, { value: result, expires: Date.now() + ttl });
        }
        return result;
      }).finally(() => readPending.delete(key));
      readPending.set(key, pending);
      return pending;
    }

    // ===== NAVIGATION =====
    const navItems = $$('.nav-item'), navIndicator = $('#navIndicator');
    function setIndicator(btn) { if(!btn || !navIndicator) return; const rect = btn.getBoundingClientRect(); navIndicator.style.left = (rect.left - btn.parentElement.getBoundingClientRect().left + (rect.width/2) - 10) + 'px'; }
    navItems.forEach(btn => {
      btn.addEventListener('click', function() {
        navItems.forEach(b => b.classList.remove('active')); btn.classList.add('active'); setIndicator(btn);
        const targetId = btn.getAttribute('data-tab');
        ['requestTab', 'hoursTab', 'scheduleTab'].forEach(id => { const el = $('#'+id); if(el) el.classList.toggle('hidden', id !== targetId); });
        if (targetId === 'scheduleTab') loadSchedule(); if (targetId === 'hoursTab') loadHours();
      });
    });

    // ===== LOGIC (LOGIN, REQUESTS, HOURS, SCHEDULE) =====
    // Giữ nguyên logic code JS cũ của bạn ở đây, chỉ cần copy phần logic xử lý sự kiện và load data
    // Để tiết kiệm không gian tôi sẽ rút gọn phần logic không thay đổi nhưng đảm bảo đầy đủ.
    
    $('#btnLogin')?.addEventListener('click', function(e) {
      var btn = e.target.closest('button'); var email = $('#email').value.trim(); var password = $('#password').value.trim();
      if(!email || !password) { toast('Nhập đủ thông tin', 'error'); return; }
      btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      api('login', { email, password }).then(r => {
        if (!r || !r.ok) throw new Error(r?.message || 'Thất bại');
        Object.assign(state, { token: r.token, email: r.email, empName: r.empName, credentials: { email, password }, tokenExpiry: new Date().getTime() + 3600000 });
        localStorage.setItem('sunday.token', state.token); localStorage.setItem('sunday.email', state.email); localStorage.setItem('sunday.empName', state.empName);
        localStorage.setItem('sunday.credentials', JSON.stringify(state.credentials)); localStorage.setItem('sunday.tokenExpiry', state.tokenExpiry);
        $('#whoami').textContent = state.empName; $('#cardLogin').classList.add('hidden'); $('#cardApp').classList.remove('hidden'); $('#mainNav').classList.remove('hidden');
        setIndicator($('.nav-item.active')); loadRequestList(); loadEmployees(); toast('Đăng nhập thành công', 'ok');
      }).catch(err => toast(err.message, 'error')).finally(() => { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Đăng nhập'; });
    });

    function restoreSession() {
      var t = localStorage.getItem('sunday.token'), emp = localStorage.getItem('sunday.empName');
      if (t && emp) {
        Object.assign(state, { token: t, empName: emp, email: localStorage.getItem('sunday.email'), credentials: JSON.parse(localStorage.getItem('sunday.credentials')||'null'), tokenExpiry: parseInt(localStorage.getItem('sunday.tokenExpiry')||'0') });
        if (!isTokenValid() && state.credentials) refreshToken().catch(()=>{}); 
        $('#whoami').textContent = state.empName; $('#cardLogin').classList.add('hidden'); $('#cardApp').classList.remove('hidden'); $('#mainNav').classList.remove('hidden');
        setTimeout(() => setIndicator($('.nav-item.active')), 50); loadRequestList(); loadEmployees();
      }
    }
    function loadEmployees() { api('employees', {}).then(res => { var arr = Array.isArray(res) ? res : (res?.rows || res?.data || []); state.employees = arr.filter(Boolean).map(String); var sel = $('#passEmployee'); if (sel) sel.innerHTML = '<option value="">-- Chọn --</option>' + state.employees.map(n => '<option>'+escapeHtml(n)+'</option>').join(''); }); }

    var issueSel = $('#issueType');
    issueSel?.addEventListener('change', function() { var isPass = (issueSel.value === 'pass ca'); $('#passCaRow').classList.toggle('hidden', !isPass); $('#passShiftRow').classList.toggle('hidden', !isPass); });
    $('#btnSend')?.addEventListener('click', function() {
      var issue = $('#issueType').value, date = $('#requestDate').value, content = $('#content').value.trim(), passEmp = $('#passEmployee').value, passShift = $('#passShift').value;
      if (!issue || !date || !content) { toast('Điền đủ thông tin', 'error'); return; }
      if (issue === 'pass ca' && (!passEmp || !passShift)) { toast('Chọn NV và Ca', 'error'); return; }
      var btn = $('#btnSend'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      api('submit', { payload: { issueType: issue, requestDate: date, passEmployee: passEmp, passShift: passShift, content: content } }).then(r => { if(!r.ok) throw new Error(r.message); toast('Đã gửi', 'ok'); $('#content').value=''; loadRequestList(); }).catch(e => toast(e.message, 'error')).finally(() => { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi'; });
    });
    function loadRequestList() { var body = $('#reqBody'); body.innerHTML = '<tr><td colspan="3" class="muted">Đang tải...</td></tr>'; api('listRequests', { limit: 20 }).then(r => { if (!r.ok) throw new Error(''); var rows = r.rows || []; if (!rows.length) { body.innerHTML = '<tr><td colspan="3" style="text-align:center">Trống</td></tr>'; return; } body.innerHTML = rows.map(x => `<tr><td>${escapeHtml(x.reqDate||x.created)}</td><td><span style="color:${x.issue.includes('pass')?'var(--accent)':'var(--primary)'}">${escapeHtml(x.issue)}</span></td><td style="white-space:normal; font-size:12px">${escapeHtml(x.content)}</td></tr>`).join(''); }).catch(() => body.innerHTML = '<tr><td colspan="3">Lỗi</td></tr>'); }
    $('#btnRefreshReq')?.addEventListener('click', loadRequestList);

    function loadHours() {
      var box = $('#hoursBox'); box.innerHTML = '<div class="skeleton" style="height:50px; margin-bottom:8px;"></div>'; $('#totalHoursMonth').textContent = '...';
      api('hours', {}).then(r => {
        if (!r.ok) throw new Error(r.message || 'Không tải được giờ công.'); var headers = r.header || [], rows = r.row || [];
        var dateRow = Array.isArray(headers[0]) ? headers[0] : headers, dayRow = Array.isArray(headers[1]) ? headers[1] : [];
        var startIndex = 4, html = '', len = Math.min(dateRow.length, rows.length);
        var totalRaw = String(rows[3] || '0'), total = parseFloat(totalRaw.replace(',', '.'));
        $('#totalHoursMonth').textContent = (isNaN(total) ? '0' : total.toFixed(1).replace('.', ',')) + 'h';
        for (var i = startIndex; i < len; i++) {
          var dateVal = String(dateRow[i] || '').trim(), dayName = String(dayRow[i] || '').trim(); if (!dayName && !dateVal) continue;
          var displayDate = dayName; if (dateVal) displayDate += ' (' + dateVal + ')';
          var val = String(rows[i] || '-').trim(), valClass = 'hour-val';
          if (val === 'Off' || val === '0' || val === '') { valClass += ' off'; val = 'Nghỉ'; } else if (!isNaN(parseFloat(val))) { valClass += ' ok'; val += 'h'; }
          var modalDisplay = (dateVal ? dateVal + ' (' + dayName + ')' : dayName);
          html += `<div class="hour-item ripple-container" onclick="openComplaintModal('${escapeHtml(dateVal)}', '${escapeHtml(modalDisplay)}')"><div class="hour-date">${escapeHtml(displayDate)}</div><div class="${valClass}">${escapeHtml(val)}</div><button class="btn-complain"><i class="fa-solid fa-flag"></i></button></div>`;
        }
        if(!html) html = '<div class="muted" style="text-align:center; padding:20px">Không có dữ liệu</div>';
        box.innerHTML = html;
      }).catch(err => { $('#totalHoursMonth').textContent = '—'; box.innerHTML = '<div class="text-err" style="text-align:center">' + escapeHtml(err.message || 'Không tải được giờ công.') + '</div>'; });
    }
    function openComplaintModal(dateToSend, displayText) {
      $('#modalDateDisplay').textContent = displayText;
      if (!dateToSend && displayText) { var match = displayText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/); if(match) dateToSend = match[0]; }
      $('#complaintModal').setAttribute('data-date', dateToSend); $('#modalContent').value = ''; $('#complaintModal').classList.add('show');
    }
    function closeComplaintModal() { $('#complaintModal').classList.remove('show'); }
    function submitComplaint() {
      var btn = $('#btnModalSend'), note = $('#modalContent').value.trim(), dateRaw = $('#complaintModal').getAttribute('data-date');
      if(!note) { toast('Nhập nội dung', 'error'); return; } if(!dateRaw) { toast('Lỗi ngày', 'error'); return; }
      btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      api('submit', { payload: { issueType: "Khiếu nại giờ công", requestDate: dateRaw, content: note } }).then(r => { if(!r.ok) throw new Error(r.message); toast('Đã gửi', 'ok'); closeComplaintModal(); loadRequestList(); }).catch(e => toast(e.message, 'error')).finally(() => { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi'; });
    }

    var schedMeta = null, schedState = [], schedLoadedAt = 0, schedDirty = false, schedLoading = false, schedSaving = false;
    function loadSchedule(force = false) {
      if (schedLoading || schedSaving) return;
      if (!force && schedMeta && (schedDirty || Date.now() - schedLoadedAt < 30000)) return;
      schedLoading = true;
      var grid = $('#schedGrid'); grid.innerHTML = '<div class="skeleton" style="height:100px"></div>';
      schedMeta = null; schedState = []; $('#btnSchedSave').disabled = true;
      api('scheduleGet', {}).then(r => {
        if (!r.ok) throw new Error(r.message || 'Không tải được lịch làm việc.'); schedMeta = r.meta || { days: [] }; schedState = Array.isArray(r.selected) ? r.selected : [];
        schedState = schedState.slice(0, schedMeta.days.length * 3);
        while(schedState.length < schedMeta.days.length * 3) schedState.push(false); grid.innerHTML = '';
        schedMeta.days.forEach((d, i) => {
          var card = document.createElement('div'); card.className = 'shift-card ripple-container';
          card.innerHTML = `<div class="shift-head"><div style="color:#fff">${escapeHtml(d.dayName)}</div><div class="shift-date">${escapeHtml(d.date)}</div></div><div class="shift-actions"><button class="ca-btn ${schedState[i*3]?'active':''}" data-idx="${i*3}">Ca 1</button><button class="ca-btn ${schedState[i*3+1]?'active':''}" data-idx="${i*3+1}">Ca 2</button><button class="ca-btn ${schedState[i*3+2]?'active':''}" data-idx="${i*3+2}">Ca 3</button></div>`;
          grid.appendChild(card);
        });
        grid.querySelectorAll('.ca-btn').forEach(b => { b.addEventListener('click', function() { var idx = parseInt(this.dataset.idx); schedState[idx] = !schedState[idx]; schedDirty = true; this.classList.toggle('active'); }); });
        $('#scheduleNote').value = typeof r.note === 'string' ? r.note : '';
        $('#btnSchedSave').disabled = schedMeta.days.length === 0;
        schedLoadedAt = Date.now(); schedDirty = false;
      }).catch(err => grid.innerHTML = '<div class="text-err">' + escapeHtml(err.message || 'Không tải được lịch làm việc.') + '</div>').finally(() => { schedLoading = false; });
    }
    $('#btnSchedSave')?.addEventListener('click', function() {
      if (schedSaving || schedLoading || !schedMeta || !schedMeta.days.length) return;
      var btn = this;
      schedSaving = true; btn.disabled = true;
      const controls = [...$$('#schedGrid .ca-btn'), $('#scheduleNote'), $('#btnSchedClear'), $('#btnSchedReload')];
      controls.forEach(control => control.disabled = true);
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu';
      api('scheduleSave', { selected: schedState.slice(), note: $('#scheduleNote').value }).then(r => {
        if (!r.ok) throw new Error(r.message || 'Không lưu được lịch.');
        schedDirty = false; schedLoadedAt = Date.now();
        toast(r.warning || 'Đã lưu', r.warning ? 'error' : 'ok');
      }).catch(err => toast(err.message || 'Không lưu được lịch.', 'error')).finally(() => {
        schedSaving = false; btn.disabled = false;
        controls.forEach(control => control.disabled = false);
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Lưu';
      });
    });
    $('#scheduleNote')?.addEventListener('input', () => { schedDirty = true; });
    $('#btnSchedReload')?.addEventListener('click', () => loadSchedule(true));
    $('#btnSchedClear')?.addEventListener('click', function() { schedDirty = true; schedState = schedState.map(() => false); $$('#schedGrid .ca-btn').forEach(btn => btn.classList.remove('active')); });
    $('#btnLogout')?.addEventListener('click', function() { localStorage.clear(); location.reload(); });

    restoreSession();
    flatpickr("#requestDate", { dateFormat: "d-m-Y", allowInput: true, locale: "vn" });
    ['#email', '#password'].forEach(sel => { $(sel)?.addEventListener('keydown', e => { if(e.key === 'Enter') $('#btnLogin').click(); }); });

    // ===== EFFECTS (OPTIMIZED) =====
    // 1. Ripple Effect
    document.body.addEventListener('touchstart', function(e) {
        const target = e.target.closest('.ripple-container'); if (!target) return;
        const ripple = document.createElement('span'); ripple.className = 'ripple';
        const rect = target.getBoundingClientRect();
        ripple.style.left = (e.touches[0].clientX - rect.left) + 'px';
        ripple.style.top = (e.touches[0].clientY - rect.top) + 'px';
        target.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }, {passive: true});

    // 2. Active State Polyfill (Fix touch highlight)
    document.body.addEventListener('touchstart', function(e){
       const item = e.target.closest('.hour-item, .shift-card');
       if(item) item.classList.add('is-touched');
    }, {passive: true});
    document.body.addEventListener('touchend', function(e){
       const items = document.querySelectorAll('.is-touched');
       items.forEach(i => i.classList.remove('is-touched'));
    }, {passive: true});
