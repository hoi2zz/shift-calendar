'use strict';
const KEY='shift-calendar-v1'; // v1과 같은 저장 키: 기존 설정과 메모 유지
const names=['주간','야간','비번','휴무'],symbols=['주','야','비','휴'],classes=['day','night','off','rest'];
const {shift:calculateShift,iso,utcDay}=ShiftCore;
const now=new Date();const today=iso(now.getFullYear(),now.getMonth(),now.getDate());
const defaultState={baseDate:today,baseShift:0,dayHours:'07:30~18:00',nightHours:'17:30~익일 08:00',memos:{},events:{},monthlyStandard:null,payRank:'경사',officialPay:{},viewTeam:1,teams:null};
function validateOfficial(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('수당 데이터 오류');const out={};for(const [month,v] of Object.entries(input)){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!v||typeof v!=='object')throw Error('월별 수당 형식 오류');const x={};for(const k of ['ot','night','holiday']){if(v[k]===null||v[k]===undefined||v[k]==='')continue;const n=Number(v[k]);if(!Number.isInteger(n)||n<0||n>744)throw Error('인정시간 오류');x[k]=n;}out[month]=x;}return out;}
function validState(raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('잘못된 데이터');utcDay(raw.baseDate);if(!Number.isInteger(raw.baseShift)||raw.baseShift<0||raw.baseShift>3)throw Error('근무 설정 오류');if(typeof raw.dayHours!=='string'||typeof raw.nightHours!=='string')throw Error('시간 설정 오류');if(!raw.memos||typeof raw.memos!=='object'||Array.isArray(raw.memos))throw Error('메모 오류');const memos={};for(const [k,v] of Object.entries(raw.memos)){utcDay(k);if(typeof v!=='string'||v.length>5000)throw Error('메모 형식 오류');memos[k]=v;}const events={};for(const [date,e] of Object.entries(raw.events||{})){utcDay(date);if(!e||typeof e!=='object'||!['leave','volunteer','swap','training','trip'].includes(e.type))throw Error('일정 형식 오류');if(e.override!==null&&e.override!==undefined&&(!Number.isInteger(e.override)||e.override<0||e.override>3))throw Error('실제 근무 오류');events[date]={type:e.type,override:e.override??null,volunteerShift:e.type==='volunteer'?(e.volunteerShift==='night'?'night':'day'):undefined,trainingMinutes:e.type==='training'?(Number.isInteger(e.trainingMinutes)&&e.trainingMinutes>=0&&e.trainingMinutes<=1440?e.trainingMinutes:0):undefined};}const standard=raw.monthlyStandard===null||raw.monthlyStandard===undefined||raw.monthlyStandard===''?null:Number(raw.monthlyStandard);if(standard!==null&&(!Number.isFinite(standard)||standard<0||standard>744))throw Error('월 기준시간 오류');return {baseDate:raw.baseDate,baseShift:raw.baseShift,dayHours:raw.dayHours,nightHours:raw.nightHours,memos,events,monthlyStandard:standard,payRank:["순경","경장","경사","경위","경감","경정"].includes(raw.payRank)?raw.payRank:"경사",officialPay:validateOfficial(raw.officialPay||{}),viewTeam:[1,2,3,4].includes(Number(raw.viewTeam))?Number(raw.viewTeam):1,teams:raw.teams??null};}
// 각 팀의 개인 기록은 서로 독립적으로 저장합니다. 기존 v2.3 기록은 1팀으로 이관합니다.
function teamProfile(raw){
 const base={...defaultState,baseDate:'2026-11-21',baseShift:0,memos:{},events:{},officialPay:{},payRank:'경사'};
 const v=validState({...base,...(raw||{}),teams:null});
 return {memos:v.memos,events:v.events,payRank:v.payRank,officialPay:v.officialPay};
}
function migrateTeams(st){
 const legacy={memos:st.memos,events:st.events,payRank:st.payRank,officialPay:st.officialPay};
 const input=st.teams&&typeof st.teams==='object'&&!Array.isArray(st.teams)?st.teams:null;
 const teams={};for(let t=1;t<=4;t++)teams[t]=teamProfile(input?.[t]||(t===1?legacy:null));
 return {...st,teams};
}
const profile=()=>state.teams[state.viewTeam];
let state;try{const stored=JSON.parse(localStorage.getItem(KEY)||'null');state=migrateTeams(stored?validState({...defaultState,...stored}):{...defaultState});}catch{state=migrateTeams({...defaultState});}
const persist=()=>localStorage.setItem(KEY,JSON.stringify(state));
// 모든 기기에서 동일한 팀별 공식 순환을 사용합니다. 기존 사용자 설정은 보존하되 순환에는 적용하지 않습니다.
const shift=date=>calculateShift(date,'2026-11-21',0);
// 1팀 기준 2026-11-21 주간. 팀별로 4일 순환 위상을 이동합니다.
const teamShift=(date,team=state.viewTeam)=>(shift(date)+[0,0,3,2,1][team])%4;
const viewingOwnTeam=()=>true;
const effectiveShift=date=>profile().events[date]?.override??teamShift(date);
const eventNames={leave:'연가',volunteer:'자원',training:'교육',trip:'출장'};
// Calendar labels for the same 2026 dates already used in allowance calculations.
const holidayNames2026={'2026-01-01':'신정','2026-02-16':'설날 연휴','2026-02-17':'설날','2026-02-18':'설날 연휴','2026-03-01':'삼일절','2026-03-02':'대체공휴일','2026-05-05':'어린이날','2026-05-24':'부처님오신날','2026-05-25':'대체공휴일','2026-06-03':'지방선거일','2026-06-06':'현충일','2026-08-15':'광복절','2026-08-17':'대체공휴일','2026-09-24':'추석 연휴','2026-09-25':'추석','2026-09-26':'추석 연휴','2026-10-03':'개천절','2026-10-05':'대체공휴일','2026-10-09':'한글날','2026-12-25':'성탄절'};
// Holiday data: bundled 2026/2027 fallback, refreshed yearly from public KASI-derived data.
const bundled2027={
'2027-01-01':'신정','2027-02-06':'설날 연휴','2027-02-07':'설날','2027-02-08':'설날 연휴','2027-02-09':'대체공휴일','2027-03-01':'삼일절','2027-05-01':'노동절','2027-05-03':'대체공휴일','2027-05-05':'어린이날','2027-05-13':'부처님오신날','2027-06-06':'현충일','2027-07-17':'제헌절','2027-07-19':'대체공휴일','2027-08-15':'광복절','2027-08-16':'대체공휴일','2027-09-14':'추석 연휴','2027-09-15':'추석','2027-09-16':'추석 연휴','2027-10-03':'개천절','2027-10-04':'대체공휴일','2027-10-09':'한글날','2027-10-11':'대체공휴일','2027-12-25':'성탄절','2027-12-27':'대체공휴일'};
const holidayYears={2026:{...holidayNames2026},2027:{...bundled2027}};
const holidayFetches=new Map();
function holidayNameForDate(date){return holidayYears[Number(date.slice(0,4))]?.[date]||'';}
function holidaysKnown(y){return Object.prototype.hasOwnProperty.call(holidayYears,y);}
function holidayCacheKey(y){return `shift-calendar-holidays-${y}`;}
function normalizeHolidays(data,y){if(!data||typeof data!=='object'||Array.isArray(data))throw Error('공휴일 형식 오류');const out={};for(const [date,names] of Object.entries(data)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!date.startsWith(`${y}-`))continue;const values=(Array.isArray(names)?names:[names]).filter(v=>typeof v==='string'&&v.length>0&&v.length<80);if(values.length)out[date]=values.join('·');}if(Object.keys(out).length<8)throw Error('공휴일 데이터 불완전');return out;}
async function loadHolidayYear(y){if(y<2020||y>2100)return;try{const cached=JSON.parse(localStorage.getItem(holidayCacheKey(y))||'null');if(cached?.data){const validated=normalizeHolidays(cached.data,y);holidayYears[y]=validated;}}catch{}const cachedAt=(()=>{try{return JSON.parse(localStorage.getItem(holidayCacheKey(y))||'null')?.savedAt||0;}catch{return 0;}})();if(Date.now()-cachedAt<7*86400000)return;if(holidayFetches.has(y))return holidayFetches.get(y);const promise=(async()=>{try{const url=`https://cdn.jsdelivr.net/gh/hyunbinseo/open-data@main/data/holidays/${y}.json`;const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('연도별 공휴일 미제공');const fresh=normalizeHolidays(await response.json(),y);holidayYears[y]=fresh;try{localStorage.setItem(holidayCacheKey(y),JSON.stringify({savedAt:Date.now(),data:fresh}));}catch{}if(year===y)render();}catch{if(year===y)render();}finally{holidayFetches.delete(y);}})();holidayFetches.set(y,promise);return promise;}
function ensureHolidayYear(y){void loadHolidayYear(y);}
function monthlyStats(){const count=new Date(year,month+1,0).getDate(),counts=[0,0,0,0];for(let d=1;d<=count;d++){const date=iso(year,month,d);counts[effectiveShift(date)]++;}return counts;}
function renderStats(){const counts=monthlyStats();$('statsGrid').replaceChildren();names.forEach((label,i)=>{const item=document.createElement('div');item.className='stat-item';const strong=document.createElement('strong');strong.textContent=`${counts[i]}일`;const small=document.createElement('small');small.textContent=label;item.append(strong,small);$('statsGrid').append(item);});}

let year=now.getFullYear(),month=now.getMonth(),selected=today;
const $=id=>document.getElementById(id);
function render(){
 $('monthTitle').textContent=`${year}년 ${month+1}월`;
 $('teamSelect').value=String(state.viewTeam);$('payTeamLabel').textContent=`(${state.viewTeam}팀 기준)`;
 $('teamHint').textContent=`${state.viewTeam}팀 · 이 팀의 일정·메모·예상 수당을 별도로 관리합니다. (기기별 저장)`;
 const grid=$('calendar');grid.replaceChildren();const start=new Date(year,month,1).getDay(),count=new Date(year,month+1,0).getDate();
 for(let i=0;i<Math.ceil((start+count)/7)*7;i++){
  const d=i-start+1;if(d<1||d>count){const blank=document.createElement('div');blank.className='cell blank';grid.append(blank);continue;}
  const date=iso(year,month,d),s=effectiveShift(date),event=profile().events[date],btn=document.createElement('button');btn.type='button';btn.className=`cell ${i%7===0?'sunday':i%7===6?'saturday':''} ${selected===date?'selected':''} ${today===date?'today':''}`;
  const n=document.createElement('span');n.className='num';n.textContent=d;const holidayName=holidayNameForDate(date);if(holidayName){btn.classList.add('public-holiday');btn.title=holidayName;}
  const badge=document.createElement('span');const volunteerOff=event?.type==='volunteer'&&s>=2;badge.className=volunteerOff?'dot volunteer-badge':`dot ${classes[s]}`;badge.textContent=volunteerOff?'자':symbols[s];btn.append(n,badge);if(holidayName){const h=document.createElement('span');h.className='holiday-label';h.textContent=holidayName;btn.append(h);}
  if(profile().memos[date]){const memo=document.createElement('span');memo.className='calendar-memo';memo.textContent=profile().memos[date].split('\n')[0].trim().slice(0,8);memo.title=profile().memos[date];btn.append(memo);}
  if(event){const tag=document.createElement('span');tag.className=`event-tag ${event.type}`;tag.textContent=event.type==='volunteer'?(event.volunteerShift==='night'?'야간자원':'주간자원'):(eventNames[event.type]||'일정');btn.append(tag);}btn.setAttribute('aria-label',`${date} ${volunteerOff?'자원근무':names[s]}${today===date?' 오늘':''}${holidayName?' '+holidayName:''}${profile().memos[date]?' 메모 있음':''}`);
  btn.addEventListener('click',()=>{selected=date;render();$('dayDialog').showModal();});grid.append(btn);
 }
 renderPay();$('dayDetail').hidden=false;const s=effectiveShift(selected);$('selectedDate').textContent=selected;$('selectedShift').textContent=`${names[s]}${s<2?' 근무':''}`;

 $('selectedHours').textContent=s===0?state.dayHours:s===1?state.nightHours:'정규 근무시간 없음';
 $('memo').value=profile().memos[selected]||'';const ev=profile().events[selected];$('eventType').value=ev?.type==='swap'?'':(ev?.type||'');$('overrideWrap').hidden=ev?.type==='volunteer';$('overrideShift').value=ev?.override===null||ev?.override===undefined?'':String(ev.override);$('volunteerWrap').hidden=ev?.type!=='volunteer';$('volunteerShift').value=ev?.volunteerShift||'day';$('trainingWrap').hidden=ev?.type!=='training';$('trainingHours').value=String(Math.floor((ev?.trainingMinutes||0)/60));$('trainingMinutes').value=String((ev?.trainingMinutes||0)%60);$('saveStatus').textContent='';
}
function moveMonth(delta){const d=new Date(year,month+delta,1);year=d.getFullYear();month=d.getMonth();selected=iso(year,month,1);render();ensureHolidayYear(year);}
$('teamSelect').addEventListener('change',()=>{state.viewTeam=Number($('teamSelect').value);persist();render();});
$('prev').addEventListener('click',()=>moveMonth(-1));$('next').addEventListener('click',()=>moveMonth(1));
$('todayBtn').addEventListener('click',()=>{const d=new Date();year=d.getFullYear();month=d.getMonth();selected=iso(year,month,d.getDate());render();ensureHolidayYear(year);});
$('closeDay').addEventListener('click',()=>$('dayDialog').close());
$('dayDialog').addEventListener('click',e=>{if(e.target===$('dayDialog'))$('dayDialog').close();});
$('saveMemo').addEventListener('click',()=>{const value=$('memo').value.trim(),type=$('eventType').value,override=$('overrideShift').value;if(value.length>5000){$('saveStatus').textContent='메모는 5000자 이내로 입력하세요.';return;}const before=JSON.stringify(state);if(value)profile().memos[selected]=value;else delete profile().memos[selected];if(type)profile().events[selected]={type,override:type==='volunteer'?null:(override===''?null:Number(override)),...(type==='volunteer'?{volunteerShift:$('volunteerShift').value}:{}),...(type==='training'?{trainingMinutes:Number($('trainingHours').value)*60+Number($('trainingMinutes').value)}:{})};else delete profile().events[selected];try{persist();render();$('saveStatus').textContent='저장됨';$('dayDialog').close();}catch{state=JSON.parse(before);$('saveStatus').textContent='저장 실패';}});
$('eventType').addEventListener('change',()=>{$('volunteerWrap').hidden=$('eventType').value!=='volunteer';$('overrideWrap').hidden=$('eventType').value==='volunteer';$('trainingWrap').hidden=$('eventType').value!=='training';});
$('settingsBtn').addEventListener('click',()=>{$('baseDate').value='2026-11-21';$('baseShift').value='0';$('dayHours').value=state.dayHours;$('nightHours').value=state.nightHours;$('settings').showModal();});
$('saveSettings').addEventListener('click',e=>{if(!$('baseDate').value){e.preventDefault();$('baseDate').reportValidity();return;}const previous=state;state={...state,baseDate:'2026-11-21',baseShift:0,dayHours:$('dayHours').value.trim()||defaultState.dayHours,nightHours:$('nightHours').value.trim()||defaultState.nightHours};try{state=validState(state);persist();render();}catch{state=previous;alert('설정 저장에 실패했습니다.');}});
$('exportBtn').addEventListener('click',()=>{try{const blob=new Blob([JSON.stringify({app:'shift-calendar',version:5,exportedAt:new Date().toISOString(),data:state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`교대달력-백업-${today}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backupStatus').textContent='백업 파일을 저장해 주세요.';}catch{$('backupStatus').textContent='백업 생성 실패';}});
$('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2000000)throw Error('파일이 너무 큽니다');const obj=JSON.parse(await file.text());if(obj.app!=='shift-calendar'||![1,2,3,4,5].includes(obj.version))throw Error('교대달력 백업 파일이 아닙니다');const restored=migrateTeams(validState({...defaultState,...obj.data}));if(!confirm('기존 근무 설정과 메모를 백업 파일 내용으로 교체할까요?'))return;const old=state;state=restored;try{persist();render();$('backupStatus').textContent='복원 완료. 설정을 다시 열면 반영된 값을 확인할 수 있습니다.';}catch{state=old;throw Error('저장 실패');}}catch(err){$('backupStatus').textContent=`복원 실패: ${err.message}`;}finally{e.target.value='';}});
$('shareCalendar').addEventListener('click',async()=>{const btn=$('shareCalendar');btn.disabled=true;try{const width=840,cellW=112,cellH=112,left=28,top=112,first=new Date(year,month,1).getDay(),count=new Date(year,month+1,0).getDate(),rows=Math.ceil((first+count)/7),height=top+40+rows*cellH+72;const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f2f5f9"/><text x="28" y="53" font-size="30" font-family="sans-serif" font-weight="bold" fill="#172b4d">교대달력 · ${year}년 ${month+1}월 · ${state.viewTeam}팀</text><text x="28" y="83" font-size="16" font-family="sans-serif" fill="#52627a">주간 · 야간 · 비번 · 휴무</text>`;['일','월','화','수','목','금','토'].forEach((w,i)=>svg+=`<text x="${left+i*cellW+cellW/2}" y="${top+15}" text-anchor="middle" font-size="17" font-family="sans-serif" fill="#52627a">${w}</text>`);const bg=['#ffd51b','#414b5a'];const fg=['#273449','#ffffff'];for(let d=1;d<=count;d++){const date=iso(year,month,d),i=first+d-1,x=left+(i%7)*cellW,y=top+30+Math.floor(i/7)*cellH,s=effectiveShift(date);svg+=`<rect x="${x+2}" y="${y}" width="${cellW-5}" height="${cellH-5}" rx="10" fill="${s===0?'#f0f5f9':s===1?'#edf1f5':'#fafbfc'}"/><text x="${x+15}" y="${y+23}" font-size="17" font-family="sans-serif" fill="#243247">${d}</text>`;const volunteerOff=profile().events[date]?.type==='volunteer'&&s>=2;if(s<2||volunteerOff){svg+=`<circle cx="${x+cellW/2}" cy="${y+51}" r="20" fill="${volunteerOff?'#17865b':bg[s]}"/><text x="${x+cellW/2}" y="${y+58}" text-anchor="middle" font-size="19" font-family="sans-serif" font-weight="bold" fill="${volunteerOff?'#ffffff':fg[s]}">${volunteerOff?'자':symbols[s]}</text>`;}else{svg+=`<text x="${x+cellW/2}" y="${y+58}" text-anchor="middle" font-size="17" font-family="sans-serif" font-weight="600" fill="${'#bd2336'}">${names[s]}</text>`;}if(holidayNameForDate(date))svg+=`<text x="${x+cellW/2}" y="${y+80}" text-anchor="middle" font-size="10" font-family="sans-serif" font-weight="bold" fill="#c52c38">${esc(holidayNameForDate(date))}</text>`;if(profile().memos[date]){svg+=`<text x="${x+cellW/2}" y="${y+95}" text-anchor="middle" font-size="12" font-family="sans-serif" font-weight="bold" fill="#7540ad">${esc(profile().memos[date].split('\n')[0].slice(0,7))}</text>`;}if(profile().events[date]){const ev=profile().events[date].type,short=({leave:"연가",volunteer:(profile().events[date].volunteerShift==="night"?"야간자원":"주간자원"),training:"교육",trip:"출장"})[ev]||"일정",tagBg=ev==="leave"?"#fff0d9":ev==="volunteer"?"#dcecfb":"#eceef2",tagFg="#087647";svg+=`<rect x="${x+cellW-73}" y="${y+5}" width="64" height="20" rx="5" fill="${tagBg}"/><text x="${x+cellW-41}" y="${y+19}" text-anchor="middle" font-size="12" font-family="sans-serif" font-weight="bold" fill="${tagFg}">${short}</text>`;}}svg+=`<text x="28" y="${height-25}" font-size="15" font-family="sans-serif" fill="#52627a">연가·자원근무는 날짜에 표시 · 공식 근무표와 대조 필요</text></svg>`;const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.drawImage(img,0,0);const png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('이미지 변환 실패')),'image/png'));const file=new File([png],`교대달력-${year}-${String(month+1).padStart(2,'0')}.png`,{type:'image/png'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'교대달력'});}else{const a=document.createElement('a');a.href=URL.createObjectURL(png);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);alert('이미지 저장을 요청했습니다. 다운로드 항목을 확인하세요.');}}finally{URL.revokeObjectURL(url);}}catch(err){if(err.name!=='AbortError')alert('이미지 공유에 실패했습니다. Safari에서 다시 시도해 주세요.');}finally{btn.disabled=false;}});
// 2026 reference rates. Official recognized hours, not raw shift lengths, determine final pay.
const payRates={'순경':[11545,3848,92808],'경장':[12584,4195,101153],'경사':[12934,4311,103969],'경위':[13779,4593,110763],'경감':[15082,5027,121237],'경정':[16960,5653,136331]};
const won=n=>Math.floor(n/10)*10;
const currency=n=>n.toLocaleString('ko-KR')+'원';
// Calendar-based provisional allowance estimate. No claim of official recognition.
const publicHolidays2026=new Set(['2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01','2026-03-02','2026-05-05','2026-05-24','2026-05-25','2026-06-03','2026-06-06','2026-08-15','2026-08-17','2026-09-24','2026-09-25','2026-09-26','2026-10-03','2026-10-05','2026-10-09','2026-12-25']);
function estimateMonth(){
 const last=new Date(year,month+1,0).getDate();let statutoryDays=0,scheduled=0,voluntary=0,training=0,night=0,holidays=0,volHoliday=0,leave=0,volDay=0,volNight=0;
 for(let d=1;d<=last;d++){
  const date=iso(year,month,d),weekday=new Date(year,month,d).getDay(),holiday=weekday===0||weekday===6||Boolean(holidayNameForDate(date)),workday=weekday!==0&&weekday!==6&&!Boolean(holidayNameForDate(date)),e=profile().events[date],regular=effectiveShift(date),onLeave=e?.type==='leave';
  if(workday)statutoryDays++;
  if(onLeave&&teamShift(date)<2)leave++;
  if(!onLeave&&regular<2){scheduled+=(regular===0?10.5:14.5)-(holiday&&regular===0?8:0);if(regular===1)night+=8;if(holiday&&regular===0)holidays++;}
  if(e?.type==='training')training+=(e.trainingMinutes||0)/60;
  if(e?.type==='volunteer'){
   const vn=e.volunteerShift==='night';if(vn)volNight++;else volDay++;
   // Volunteer shift hours use the recorded 10.5/14.5 reference; holiday pay replaces 8h overtime.
   voluntary+=(vn?14.5:10.5)-(holiday&&!vn?8:0);if(vn)night+=8;if(holiday&&!vn){holidays++;volHoliday++;}
  }
 }
 const legal=Math.max(0,(statutoryDays-leave)*8);
 const overtime=Math.max(0,Math.floor(scheduled+voluntary+training-legal));
 return {legal,scheduled,voluntary,training,night,holidays,leave,volDay,volNight,overtime,known:holidaysKnown(year)};
}
function renderPay(){
 const key=`${year}-${String(month+1).padStart(2,'0')}`,v=profile().officialPay[key]||{},rates=payRates[profile().payRank]||payRates['경사'],est=estimateMonth();
 $('payRank').value=profile().payRank;
 for(const [id,k] of [['officialOT','ot'],['officialNight','night'],['officialHoliday','holiday']])$(id).value=v[k]??'';
 const hasAll=['ot','night','holiday'].every(k=>Number.isInteger(v[k]));
 const el=$('paySummary');el.replaceChildren();
 const title=document.createElement('p');title.className='pay-main';
 const estimated=won(est.overtime*rates[0])+won(est.night*rates[1])+won(est.holidays*rates[2]);
 title.textContent=est.known?currency(estimated):'공휴일 자료 확인 필요';el.append(title);
 const sub=document.createElement('p');sub.className='hint';sub.textContent=est.known?'자동 예상액 · 실제 지급 확정액 아님':'공휴일 데이터를 불러오지 못해 자동 예상액을 표시하지 않습니다.';el.append(sub);
 const breakdown=document.createElement('div');breakdown.className='pay-facts';breakdown.textContent=`예상 인정시간 · 시간외 ${est.overtime}시간 / 야간 ${est.night}시간 / 휴일 ${est.holidays}일`;el.append(breakdown);
 const note=document.createElement('p');note.className='hint';note.textContent=`법정근무 ${est.legal}시간 · 실제 예정근무 ${est.scheduled}시간 · 자원 ${est.voluntary}시간 · 교육 ${est.training}시간 · 연가 ${est.leave}일 (주간 자원 ${est.volDay}회 / 야간 자원 ${est.volNight}회). 야간 정규·자원근무 모두 14시간 30분을 가정하며 휴일 주간 자원근무 1일당 8시간을 시간외에서 제외합니다. 교육 인정시간은 직접 입력하며 기존 근무에 추가됩니다. 휴게·휴일 인정 및 공휴일은 반드시 공식 내역서와 대조하세요.`;el.append(note);
 if(hasAll){const actual=won(v.ot*rates[0])+won(v.night*rates[1])+won(v.holiday*rates[2]);const comp=document.createElement('div');comp.className='pay-actual';comp.textContent=`공식 실적 기준 ${currency(actual)} · 시간외 ${v.ot}시간 / 야간 ${v.night}시간 / 휴일 ${v.holiday}일`;el.append(comp);}
}
$('payRank').addEventListener('change',()=>{profile().payRank=$('payRank').value;persist();renderPay();});
$('saveOfficial').addEventListener('click',()=>{const key=`${year}-${String(month+1).padStart(2,'0')}`,v={};for(const [id,k] of [['officialOT','ot'],['officialNight','night'],['officialHoliday','holiday']]){const raw=$(id).value.trim();if(raw==='')continue;const n=Number(raw);if(!Number.isInteger(n)||n<0||n>744){alert('인정시간과 일수는 0 이상의 정수로 입력하세요.');return;}v[k]=n;}if(Object.keys(v).length)profile().officialPay[key]=v;else delete profile().officialPay[key];persist();renderPay();alert('해당 월 공식 인정 실적을 저장했습니다.');});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();

// v2.7: tabs change presentation only; all team data and pay calculations stay unchanged.
function switchView(view){
 const calendar=view==='calendar';
 $('calendarPanel').hidden=!calendar; $('payPanel').hidden=calendar;
 $('calendarTab').classList.toggle('active',calendar); $('payTab').classList.toggle('active',!calendar);
 $('calendarTab').setAttribute('aria-selected',String(calendar)); $('payTab').setAttribute('aria-selected',String(!calendar));
 window.scrollTo({top:0,behavior:'instant'});
}
$('calendarTab').addEventListener('click',()=>switchView('calendar'));
$('payTab').addEventListener('click',()=>switchView('pay'));
switchView('calendar');
ensureHolidayYear(year);
