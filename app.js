/* ===== CONFIG ===== */
const API_URL = "https://proxy.mantrandinhminh.workers.dev/api"; // thay domain proxy của bạn

/* ===== Helpers ===== */
const $ = s => document.querySelector(s);
const state = { token:null, email:null, empName:null, employees:[] };

function toast(msg, type='ok'){
  const box = $('#toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type==='error'?'err':'ok'}`;
  el.innerHTML = `<i class="fa-${type==='error'?'solid fa-triangle-exclamation':'regular fa-circle-check'}"></i>
                  <span>${msg}</span>
                  <button class="ghost" aria-label="close"><i class="fa-solid fa-xmark"></i></button>`;
  el.querySelector('button').onclick = ()=> el.remove();
  box.appendChild(el);
  setTimeout(()=> el.remove(), 3200);
}

async function api(path, data={}){
  const res = await fetch(`${API_URL}?path=${encodeURIComponent(path)}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ===== Theme toggle ===== */
$('#themeToggle').onclick = ()=>{
  const dark = document.body.classList.toggle('theme-dark');
  if(!dark) document.body.classList.add('theme-light'); else document.body.classList.remove('theme-light');
};

/* ===== Tabs underline ===== */
document.querySelectorAll('.tabs .tab').forEach((btn, idx)=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const underline = document.querySelector('.tabs .underline');
    underline.style.transform = `translateX(${idx*160}px)`;

    ['requestTab','hoursTab'].forEach(id => $('#'+id).classList.add('hidden'));
    const tab = btn.dataset.tab; $('#'+tab).classList.remove('hidden');
    if(tab==='hoursTab') loadHours();
  });
});

/* ===== Login ===== */
$('#btnLogin').addEventListener('click', async ()=>{
  const email = $('#email').value.trim();
  const password = $('#password').value.trim();
  $('#btnLogin').disabled = true;
  $('#btnLogin').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập…';
  $('#loginMsg').textContent = '';

  if(!email || !password){
    $('#loginMsg').textContent = 'Nhập đầy đủ email và mật khẩu';
    $('#btnLogin').disabled=false; $('#btnLogin').innerHTML='<i class="fa-solid fa-unlock"></i> Đăng nhập';
    return;
  }
  try{
    const r = await api('login', { email, password });
    if(!r.ok){ $('#loginMsg').textContent=r.message||'Đăng nhập thất bại.'; toast(r.message||'Đăng nhập thất bại.','error'); return; }
    state.token=r.token; state.email=r.email; state.empName=r.empName;
    $('#whoami').innerHTML = `${state.empName} <span class="muted">(${state.email})</span>`;

    const list = await api('employees', {});
    state.employees = Array.isArray(list) ? list : [];
    const sel = $('#passEmployee'); sel.innerHTML = '<option value="">-- Chọn nhân viên --</option>';
    state.employees.forEach(n => sel.insertAdjacentHTML('beforeend', `<option>${n}</option>`));

    $('#cardLogin').classList.add('hidden'); $('#cardApp').classList.remove('hidden');
    toast(`Chào mừng, ${state.empName}!`, 'ok');
    loadRequestList();
  }catch(e){ toast(e.message,'error'); }
  finally{ $('#btnLogin').disabled=false; $('#btnLogin').innerHTML='<i class="fa-solid fa-unlock"></i> Đăng nhập'; }
});

/* Toggle pass-ca employee */
$('#issueType').addEventListener('change', ()=>{
  $('#passCaRow').classList.toggle('hidden', $('#issueType').value!=='pass ca');
});

/* ===== Submit request ===== */
$('#btnRefreshReq').addEventListener('click', loadRequestList);

$('#btnSend').addEventListener('click', async ()=>{
  const issueType = $('#issueType').value;
  const requestDate = $('#requestDate').value.trim();
  const passEmployee = issueType==='pass ca' ? $('#passEmployee').value : '';
  const content = $('#content').value.trim();

  if(!issueType) return toast('Chọn loại vấn đề', 'error');
  if(!requestDate) return toast('Nhập ngày', 'error');
  if(issueType==='pass ca' && !passEmployee) return toast('Chọn nhân viên pass ca', 'error');
  if(!content) return toast('Nhập nội dung', 'error');

  $('#btnSend').disabled=true; $('#btnSend').innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi…';
  try{
    const r = await api('submit', { token: state.token, payload:{ issueType, requestDate, passEmployee, content } });
    if(!r.ok) return toast(r.message||'Gửi thất bại','error');

    $('#issueType').value=''; $('#requestDate').value=''; $('#passEmployee').value=''; $('#content').value=''; $('#passCaRow').classList.add('hidden');
    toast('Đã gửi phiếu yêu cầu!', 'ok');
    loadRequestList();
  }catch(e){ toast(e.message,'error'); }
  finally{ $('#btnSend').disabled=false; $('#btnSend').innerHTML='<i class="fa-solid fa-paper-plane"></i> Gửi'; }
});

/* ===== Hours ===== */
async function loadHours(){
  $('#hoursBox').classList.add('skeleton'); $('#hoursBox').textContent='Đang tải…';
  $('#hoursTable').classList.add('hidden'); $('#hoursHead').innerHTML=''; $('#hoursRow').innerHTML='';

  try{
    const r = await api('hours', { token: state.token });
    if(!r.ok){ $('#hoursBox').classList.remove('skeleton'); $('#hoursBox').textContent=r.message||'Không tải được.'; return; }

    $('#hoursTitle').innerHTML = `<i class="fa-regular fa-clock"></i> ${r.title?`${r.title} — ${state.empName}`:`Giờ Công — ${state.empName}`}`;

    let headerRows = Array.isArray(r.header) ? r.header : [];
    let row = Array.isArray(r.row) ? r.row : [];
    if(headerRows.length<2 || !row.length){
      $('#hoursBox').classList.remove('skeleton'); $('#hoursBox').textContent='Không thấy dữ liệu cho '+(state.empName||'');
      return;
    }
    const maxLen = Math.max(headerRows[0].length, headerRows[1].length, row.length);
    headerRows = headerRows.map(a=>{ a=a.slice(0,maxLen); while(a.length<maxLen)a.push(''); return a; });
    row = row.slice(0,maxLen); while(row.length<maxLen) row.push('');

    renderTwoRowHeader(headerRows[0], headerRows[1]);
    row.forEach(c=>{ const td=document.createElement('td'); td.textContent=c; if(/^\d+([.,]\d+)?$/.test(String(c).trim())) td.classList.add('num'); $('#hoursRow').appendChild(td); });

    $('#hoursBox').classList.remove('skeleton'); $('#hoursBox').textContent='';
    $('#hoursTable').classList.remove('hidden');
  }catch(e){
    $('#hoursBox').classList.remove('skeleton'); $('#hoursBox').textContent=String(e);
  }
}

function renderTwoRowHeader(topRow, bottomRow){
  const thead = $('#hoursHead'); const trTop = document.createElement('tr'); const trBot = document.createElement('tr');
  const groups = []; let i=0;
  while(i<topRow.length){
    const label = String(topRow[i]||'').trim(); let span=1;
    while(i+span<topRow.length && String(topRow[i+span]||'').trim()==='') span++;
    groups.push({ text:label, span }); i+=span;
  }
  groups.forEach(g=>{ const th=document.createElement('th'); th.textContent=g.text||''; if(g.span>1) th.colSpan=g.span; trTop.appendChild(th); });
  let idx=0; groups.forEach(g=>{ for(let k=0;k<g.span;k++){ const th=document.createElement('th'); th.textContent=bottomRow[idx]||''; trBot.appendChild(th); idx++; } });
  thead.appendChild(trTop); thead.appendChild(trBot);
}
async function loadRequestList(){
  const body = $('#reqBody');
  body.innerHTML = `<tr><td colspan="6" class="muted">Đang tải…</td></tr>`;
  try{
    const r = await api('listRequests', { token: state.token, limit: 100 });
    if(!r.ok){ body.innerHTML = `<tr><td colspan="6">${r.message||'Không tải được.'}</td></tr>`; return; }
    const rows = r.rows || [];
    if(!rows.length){ body.innerHTML = `<tr><td colspan="6" class="muted">Chưa có yêu cầu.</td></tr>`; return; }

    // render
    body.innerHTML = rows.map(x => `
      <tr>
        <td>${escapeHtml(x.created)}</td>
        <td>${escapeHtml(x.name)}</td>
        <td>${escapeHtml(x.issue)}</td>
        <td>${escapeHtml(x.reqDate)}</td>
        <td>${escapeHtml(x.passEmp)}</td>
        <td>${escapeHtml(x.content)}</td>
      </tr>
    `).join('');
  }catch(e){
    body.innerHTML = `<tr><td colspan="6">${String(e)}</td></tr>`;
  }
}

// đơn giản hoá: escape để tránh chèn HTML
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

