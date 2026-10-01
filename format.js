function compactNumber(value) {
 if(!Number.isSafeInteger(value)||value<0)return '—';
 if(value<1000)return String(value);
 const [div,suffix]=value>=1e9?[1e9,'B']:value>=1e6?[1e6,'M']:[1e3,'K'];
 return Number((value/div).toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2})+suffix;
}
function fullNumber(value){return Number.isSafeInteger(value)?value.toLocaleString('en-US'):'Unavailable';}
function changeLabel(value,current,previous){
 if(typeof value!=='number'||!Number.isFinite(value))return previous===0?(current===0?'No change':'No prior views'):'Connection required';
 return (value>0?'▲ ':value<0?'▼ ':'')+Math.abs(value).toFixed(1)+'%';
}
