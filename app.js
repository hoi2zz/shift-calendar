'use strict';
const KEY='shift-calendar-v1';
const names=['주간','야간','비번','휴무'];
const symbols=['주','야','비','휴'];
const classes=['day','night','off','rest'];
const pad=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
const today=new Date();
const defaultState={baseDate:iso(today.getFullYear(),today.getMonth(),today.getDate()),baseShift:0,dayHours:'07:30~18:00',nightHours:'17:30~익일 07:30',memos:{}};
let state;
try{const stored=JSON.parse(localStorage.getItem(KEY)||'{}');state={...defaultState,...stored,memos:stored.memos&&typeof stored.memos==='object'?stored.memos:{}};}catch{state={...defaultState};}
const persist=()=>localStorage.setItem(KEY,JSON.stringify(state));
const utcDay=s=>{const [y,m,d]=s.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000)};
function shift(date){return ((state.baseShift+(utcDay(date)-utcDay(state.baseDate)))%4+4)%4;}
let year=today.getFullYear(),month=today.getMonth(),selected=iso(year,month,today.getDate());
const $=id=>document.getElementById(id);
function render(){
 $('monthTitle').textContent=`${year}년 ${month+1}월`;
 const grid=$('calendar');grid.replaceChildren();
 const start=new Date(year,month,1).getDay();const count=new Date(year,month+1,0).getDate();
 for(let i=0;i<Math.ceil((start+count)/7)*7;i++){
  const d=i-start+1;
  if(d<1||d>count){const blank=document.createElement('div');blank.className='cell blank';grid.append(blank);continue;}
  const date=iso(year,month,d),s=shift(date),btn=document.createElement('button');btn.type='button';btn.className=`cell ${i%7===0?'sunday':i%7===6?'saturday':''} ${selected===date?'selected':''}`;
  const n=document.createElement('span');n.className='num';n.textContent=d;
  const badge=document.createElement('span');badge.className=`dot ${classes[s]}`;badge.textContent=symbols[s];
  btn.append(n,badge);if(state.memos[date])btn.title='메모 있음';
  btn.setAttribute('aria-label',`${date} ${names[s]}${state.memos[date]?' 메모 있음':''}`);
  btn.addEventListener('click',()=>{selected=date;render();});grid.append(btn);
 }
 const s=shift(selected);$('selectedDate').textContent=selected;$('selectedShift').textContent=`${names[s]} 근무`;
 $('selectedHours').textContent=s===0?state.dayHours:s===1?state.nightHours:'정규 근무시간 없음';
 $('memo').value=state.memos[selected]||'';$('saveStatus').textContent='';
}
$('prev').addEventListener('click',()=>{const d=new Date(year,month-1,1);year=d.getFullYear();month=d.getMonth();selected=iso(year,month,1);render();});
$('next').addEventListener('click',()=>{const d=new Date(year,month+1,1);year=d.getFullYear();month=d.getMonth();selected=iso(year,month,1);render();});
$('saveMemo').addEventListener('click',()=>{const value=$('memo').value.trim();if(value)state.memos[selected]=value;else delete state.memos[selected];try{persist();$('saveStatus').textContent='저장됨';render();$('saveStatus').textContent='저장됨';}catch{$('saveStatus').textContent='저장 실패: 저장 공간을 확인하세요.';}});
$('settingsBtn').addEventListener('click',()=>{$('baseDate').value=state.baseDate;$('baseShift').value=String(state.baseShift);$('dayHours').value=state.dayHours;$('nightHours').value=state.nightHours;$('settings').showModal();});
$('saveSettings').addEventListener('click',e=>{if(!$('baseDate').value){e.preventDefault();$('baseDate').reportValidity();return;}state.baseDate=$('baseDate').value;state.baseShift=Number($('baseShift').value);state.dayHours=$('dayHours').value.trim()||defaultState.dayHours;state.nightHours=$('nightHours').value.trim()||defaultState.nightHours;try{persist();render();}catch{alert('설정 저장에 실패했습니다.');}});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
render();
