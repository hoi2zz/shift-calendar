(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ShiftCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const pad=n=>String(n).padStart(2,'0');
function utcDay(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('잘못된 날짜');const [y,m,d]=s.split('-').map(Number);const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw Error('잘못된 날짜');return Math.floor(date.getTime()/86400000);}
function shift(date,baseDate,baseShift){const n=Number(baseShift);if(!Number.isInteger(n)||n<0||n>3)throw Error('잘못된 근무');return ((n+utcDay(date)-utcDay(baseDate))%4+4)%4;}
function iso(y,m,d){return `${y}-${pad(m+1)}-${pad(d)}`;}
return {shift,utcDay,iso};
});
