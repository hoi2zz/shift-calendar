'use strict';
const KEY='shift-calendar-v1'; // v1과 같은 저장 키: 기존 설정과 메모 유지
const names=['주간','야간','비번','휴무'],symbols=['주','야','비','휴'],classes=['day','night','off','rest'];
const {shift:calculateShift,iso,utcDay}=ShiftCore;
const now=new Date();const today=iso(now.getFullYear(),now.getMonth(),now.getDate());
const defaultState={baseDate:today,baseShift:0,dayHours:'07:30~18:00',nightHours:'17:30~익일 07:30',memos:{}};
function validState(raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('잘못된 데이터');utcDay(raw.baseDate);if(!Number.isInteger(raw.baseShift)||raw.baseShift<0||raw.baseShift>3)throw Error('근무 설정 오류');if(typeof raw.dayHours!=='string'||typeof raw.nightHours!=='string')throw Error('시간 설정 오류');if(!raw.memos||typeof raw.memos!=='object'||Array.isArray(raw.memos))throw Error('메모 오류');const memos={};for(const [k,v] of Object.entries(raw.memos)){utcDay(k);if(typeof v!=='string'||v.length>5000)throw Error('메모 형식 오류');memos[k]=v;}return {baseDate:raw.baseDate,baseShift:raw.baseShift,dayHours:raw.dayHours,nightHours:raw.nightHours,memos};}
let state;try{const stored=JSON.parse(localStorage.getItem(KEY)||'null');state=stored?validState({...defaultState,...stored}):{...defaultState};}catch{state={...defaultState};}
const persist=()=>localStorage.setItem(KEY,JSON.stringify(state));
const shift=date=>calculateShift(date,state.baseDate,state.baseShift);
let year=now.getFullYear(),month=now.getMonth(),selected=today;
const $=id=>document.getElementById(id);
function render(){
 $('monthTitle').textContent=`${year}년 ${month+1}월`;
 const grid=$('calendar');grid.replaceChildren();const start=new Date(year,month,1).getDay(),count=new Date(year,month+1,0).getDate();
 for(let i=0;i<Math.ceil((start+count)/7)*7;i++){
  const d=i-start+1;if(d<1||d>count){const blank=document.createElement('div');blank.className='cell blank';grid.append(blank);continue;}
  const date=iso(year,month,d),s=shift(date),btn=document.createElement('button');btn.type='button';btn.className=`cell ${i%7===0?'sunday':i%7===6?'saturday':''} ${selected===date?'selected':''} ${today===date?'today':''}`;
  const n=document.createElement('span');n.className='num';n.textContent=d;
  const badge=document.createElement('span');badge.className=`dot ${classes[s]}`;badge.textContent=symbols[s];btn.append(n,badge);
  if(state.memos[date]){const marker=document.createElement('span');marker.className='memo-marker';marker.setAttribute('aria-hidden','true');btn.append(marker);}
  btn.setAttribute('aria-label',`${date} ${names[s]}${today===date?' 오늘':''}${state.memos[date]?' 메모 있음':''}`);
  btn.addEventListener('click',()=>{selected=date;render();});grid.append(btn);
 }
 const s=shift(selected);$('selectedDate').textContent=selected;$('selectedShift').textContent=`${names[s]}${s<2?' 근무':''}`;
 $('selectedHours').textContent=s===0?state.dayHours:s===1?state.nightHours:'정규 근무시간 없음';
 $('memo').value=state.memos[selected]||'';$('saveStatus').textContent='';
}
function moveMonth(delta){const d=new Date(year,month+delta,1);year=d.getFullYear();month=d.getMonth();selected=iso(year,month,1);render();}
$('prev').addEventListener('click',()=>moveMonth(-1));$('next').addEventListener('click',()=>moveMonth(1));
$('todayBtn').addEventListener('click',()=>{const d=new Date();year=d.getFullYear();month=d.getMonth();selected=iso(year,month,d.getDate());render();});
$('saveMemo').addEventListener('click',()=>{const value=$('memo').value.trim();if(value.length>5000){$('saveStatus').textContent='메모는 5000자 이내로 입력하세요.';return;}const old=state.memos[selected];if(value)state.memos[selected]=value;else delete state.memos[selected];try{persist();render();$('saveStatus').textContent='저장됨';}catch{if(old===undefined)delete state.memos[selected];else state.memos[selected]=old;$('saveStatus').textContent='저장 실패';}});
$('settingsBtn').addEventListener('click',()=>{$('baseDate').value=state.baseDate;$('baseShift').value=String(state.baseShift);$('dayHours').value=state.dayHours;$('nightHours').value=state.nightHours;$('settings').showModal();});
$('saveSettings').addEventListener('click',e=>{if(!$('baseDate').value){e.preventDefault();$('baseDate').reportValidity();return;}const previous=state;state={...state,baseDate:$('baseDate').value,baseShift:Number($('baseShift').value),dayHours:$('dayHours').value.trim()||defaultState.dayHours,nightHours:$('nightHours').value.trim()||defaultState.nightHours};try{state=validState(state);persist();render();}catch{state=previous;alert('설정 저장에 실패했습니다.');}});
$('exportBtn').addEventListener('click',()=>{try{const blob=new Blob([JSON.stringify({app:'shift-calendar',version:1,exportedAt:new Date().toISOString(),data:state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`교대달력-백업-${today}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backupStatus').textContent='백업 파일을 저장해 주세요.';}catch{$('backupStatus').textContent='백업 생성 실패';}});
$('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2000000)throw Error('파일이 너무 큽니다');const obj=JSON.parse(await file.text());if(obj.app!=='shift-calendar'||obj.version!==1)throw Error('교대달력 백업 파일이 아닙니다');const restored=validState(obj.data);if(!confirm('기존 근무 설정과 메모를 백업 파일 내용으로 교체할까요?'))return;const old=state;state=restored;try{persist();render();$('backupStatus').textContent='복원 완료. 설정을 다시 열면 반영된 값을 확인할 수 있습니다.';}catch{state=old;throw Error('저장 실패');}}catch(err){$('backupStatus').textContent=`복원 실패: ${err.message}`;}finally{e.target.value='';}});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
