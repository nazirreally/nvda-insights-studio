import {parseCSV,enrichRows,selectPeriod,summary,annualVolume,observations} from './analytics.js';
const DEMO='data/nvda-history-1999-2024.csv';
const KAGGLE='https://www.kaggle.com/datasets/caesarmario/nvidia-stock-historical-price';
const DEMO_SOURCE='Historical NVDA demo data (1999–2024), separate Apache-2.0-licensed source; import the linked Kaggle CSV for that dataset.';
const state={all:[],visible:[],diagnostics:null,source:'',filename:'',period:'1Y',view:'overview',mode:'line',hasAdjusted:false};
const $=id=>document.getElementById(id);
const money=x=>Number.isFinite(x)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(x):'—';
const num=x=>Number.isFinite(x)?Math.round(x).toLocaleString('en-US'):'—';
const pct=x=>Number.isFinite(x)?(x>=0?'+':'')+(100*x).toFixed(2)+'%':'—';
const absolutePct=x=>Number.isFinite(x)?(100*x).toFixed(2)+'%':'—';
const shortVol=x=>!Number.isFinite(x)?'—':x>=1e9?(x/1e9).toFixed(2)+'B':x>=1e6?(x/1e6).toFixed(1)+'M':x>=1e3?(x/1e3).toFixed(1)+'K':String(Math.round(x));
const chartColor={price:'#1764d9',violet:'#8d7cf3',teal:'#26b6a5',grid:'#ebf0f6',text:'#95a5b7',red:'#d55262',green:'#16a183'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function applyData(raw,source,filename) {
 const parsed=parseCSV(raw);
 state.all=enrichRows(parsed.rows);state.diagnostics=parsed.diagnostics;state.hasAdjusted=parsed.hasAdjusted;state.source=source;state.filename=filename;
 render();
}
function error(message) { const el=$('error-banner'); el.textContent=message;el.classList.remove('hidden'); }
function clearError(){ $('error-banner').classList.add('hidden');}
function setText(id,v){$(id).textContent=v;}
function setSigned(id,value){const node=$(id);node.textContent=pct(value);node.classList.toggle('positive',value>=0);node.classList.toggle('negative',value<0);}
function drawPrice(rows,nodeId,mode='line') {
 const el=$(nodeId);if(!rows.length){el.innerHTML='<div class="chart-empty">No data in this range.</div>';return;}
 const W=880,H=340,L=61,R=18,T=19,B=37,innerW=W-L-R,innerH=H-T-B;
 let plotted=rows,downsample=0;
 if(mode==='candles'&&rows.length>165){plotted=rows.slice(-165);downsample=rows.length-165;}
 else if(mode==='line'&&rows.length>680) {const step=Math.ceil(rows.length/620);plotted=rows.filter((v,i)=>i%step===0||i===rows.length-1);}
 const prices=mode==='candles'?plotted.flatMap(d=>[d.high,d.low]):plotted.flatMap(d=>[d.price,d.sma20,d.sma50].filter(Number.isFinite));
 let min=Math.min(...prices),max=Math.max(...prices),range=max-min||Math.max(max*.04,1);min-=range*.08;max+=range*.08;range=max-min;
 const xp=i=>L+(plotted.length<2?innerW/2:i/(plotted.length-1)*innerW);
 const yp=v=>T+(max-v)/range*innerH;
 const grid=Array.from({length:5},(_,i)=>{const value=min+(4-i)*range/4;const y=yp(value);return '<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" stroke="'+chartColor.grid+'"/><text x="'+(L-10)+'" y="'+(y+4)+'" font-size="11" text-anchor="end" fill="'+chartColor.text+'">'+money(value)+'</text>';}).join('');
 const xlabels=Array.from({length:5},(_,i)=>{const j=Math.round(i*(plotted.length-1)/4);return '<text x="'+xp(j)+'" y="'+(H-7)+'" text-anchor="middle" fill="'+chartColor.text+'" font-size="11">'+plotted[j].date.slice(0,7)+'</text>';}).join('');
 let shapes='',title='Price and moving averages';
 if(mode==='candles'){
  const candleW=Math.max(2,Math.min(8,innerW/plotted.length*.63));
  shapes=plotted.map((r,i)=>{const x=xp(i),up=r.close>=r.open,c=up?chartColor.green:chartColor.red;
   const top=Math.min(yp(r.open),yp(r.close)),bottom=Math.max(yp(r.open),yp(r.close));
   return '<line x1="'+x+'" x2="'+x+'" y1="'+yp(r.high)+'" y2="'+yp(r.low)+'" stroke="'+c+'" stroke-width="1.4"/><rect x="'+(x-candleW/2)+'" y="'+top+'" width="'+candleW+'" height="'+Math.max(1.5,bottom-top)+'" fill="'+c+'"/>';
  }).join('');
  title='Open-high-low-close candles (raw OHLC)';
 } else {
  const line=key=>plotted.filter(r=>Number.isFinite(r[key])).map((r,i)=>{
    const index=plotted.indexOf(r);
    return (i===0?'M':'L')+xp(index).toFixed(2)+' '+yp(r[key]).toFixed(2);
  }).join(' ');
  const main=plotted.map((r,i)=>(i?'L':'M')+xp(i).toFixed(2)+' '+yp(r.price).toFixed(2)).join(' ');
  const area=main+'L'+xp(plotted.length-1)+' '+(H-B)+'L'+xp(0)+' '+(H-B)+'Z';
  shapes='<defs><linearGradient id="fill-'+nodeId+'" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#468cff" stop-opacity=".17"/><stop offset="1" stop-color="#468cff" stop-opacity="0"/></linearGradient></defs><path d="'+area+'" fill="url(#fill-'+nodeId+')"/><path d="'+main+'" fill="none" stroke="'+chartColor.price+'" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="'+line('sma20')+'" fill="none" stroke="'+chartColor.violet+'" stroke-width="1.7" stroke-dasharray="5 4" opacity=".84"/><path d="'+line('sma50')+'" fill="none" stroke="'+chartColor.teal+'" stroke-width="1.7" opacity=".82"/>';
 }
 const label=downsample?'<text x="'+(W-R)+'" y="15" text-anchor="end" fill="#8da1bc" font-size="10">Showing last '+plotted.length.toString()+' candles</text>':'';
 el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(title)+'" xmlns="http://www.w3.org/2000/svg">'+grid+xlabels+shapes+label+'</svg>';
 const svg=el.querySelector('svg'); const tip=$('chart-tooltip');
 svg.addEventListener('mousemove',e=>{
  const bounds=svg.getBoundingClientRect();const local=(e.clientX-bounds.left)/bounds.width*W;const index=Math.max(0,Math.min(plotted.length-1,Math.round((local-L)/innerW*(plotted.length-1))));
  const row=plotted[index];if(!row)return;
  let extra=mode==='candles'?'Open: '+money(row.open)+' · High: '+money(row.high)+'<br/>Low: '+money(row.low)+' · Close: '+money(row.close):'Analysis price: '+money(row.price)+(row.sma20?' · 20MA: '+money(row.sma20):'');
  tip.innerHTML='<strong>'+esc(row.date)+'</strong><br/><span class="tip-accent">'+extra+'</span><br/>Volume: '+num(row.volume);
  tip.style.left=Math.min(window.innerWidth-235,e.clientX+14)+'px';tip.style.top=Math.max(10,e.clientY-75)+'px';tip.classList.remove('hidden');
 });
 svg.addEventListener('mouseleave',()=>tip.classList.add('hidden'));
}
function drawBars(rows,nodeId,kind) {
 const el=$(nodeId);if(!rows.length){el.innerHTML='';return;}
 const W=560,H=225,L=43,R=12,T=13,B=32,IH=H-T-B,IW=W-L-R;
 let values=[],labels=[],colors=[];
 if(kind==='volume'){
   const step=Math.max(1,Math.ceil(rows.length/76));
   for(let i=0;i<rows.length;i+=step) {const chunk=rows.slice(i,i+step);values.push(chunk.reduce((s,r)=>s+r.volume,0)/chunk.length);labels.push(chunk[0].date);colors.push('#84afea');}
 } else if(kind==='annual'){
   const d=annualVolume(rows);values=d.map(x=>x.volume);labels=d.map(x=>x.year);colors=d.map(()=>'#83afea');
 } else {
   const returns=rows.slice(1).map((r,i)=>(r.price??r.close)/(rows[i].price??rows[i].close)-1).filter(Number.isFinite);if(!returns.length){el.innerHTML='<div class="chart-empty">Not enough trading records.</div>';return;}
   const min=Math.min(...returns),max=Math.max(...returns),span=max-min||1,n=21;
   values=Array(n).fill(0);labels=values.map((_,i)=>((min+(i+.5)*span/n)*100).toFixed(1)+'%');
   colors=values.map((_,i)=>(min+(i+.5)*span/n)<0?'#f4adb6':'#85b5ef');
   for(const value of returns){const idx=Math.max(0,Math.min(n-1,Math.floor((value-min)/span*n)));values[idx]++;}
 }
 const maxVal=Math.max(1,...values);const maxN=values.length;const barWidth=IW/maxN;const barLimit=Math.min(14,Math.max(2,barWidth*.78));
 const bars=values.map((v,i)=>{const h=v/maxVal*IH,x=L+i*barWidth+(barWidth-barLimit)/2,y=T+IH-h;
 return '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+barLimit.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+colors[i]+'"><title>'+labels[i]+' · '+(kind==='hist'?num(v)+' days':shortVol(v))+'</title></rect>';
 }).join('');
 const grid=Array.from({length:4},(_,i)=>{const y=T+i*IH/3;return '<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" stroke="'+chartColor.grid+'"/><text x="'+(L-8)+'" y="'+(y+4)+'" text-anchor="end" fill="'+chartColor.text+'" font-size="10">'+(kind==='hist'?num(maxVal*(1-i/3)):shortVol(maxVal*(1-i/3)))+'</text>';}).join('');
 const xticks=Array.from({length:4},(_,i)=>{const j=Math.round(i*(labels.length-1)/3);return '<text x="'+(L+(j+.5)*barWidth)+'" y="'+(H-8)+'" text-anchor="middle" fill="'+chartColor.text+'" font-size="10">'+(kind==='volume'?labels[j].slice(0,7):labels[j])+'</text>';}).join('');
 el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+(kind==='hist'?'Histogram of daily returns':'Historical trading volume')+'">'+grid+bars+xticks+'</svg>';
}
function renderKPIs(rows){
 const s=summary(rows); if(!s)return;
 setText('kpi-price',money(s.end));setText('meta-price','As of '+s.last);setSigned('kpi-return',s.change);
 setText('meta-return',s.first+' → '+s.last);
 setText('kpi-volatility',s.volatility!==null?absolutePct(s.volatility):'—');
 setText('kpi-drawdown',absolutePct(s.maxDrawdown));
 setText('asof-date',state.all.at(-1).date);setText('chart-range',s.first+' — '+s.last);
 setText('price-subtitle',s.priceBasis+' · '+num(rows.length)+' trading records');
}
function renderInsights(rows){
 const out=observations(rows);
 $('insights-list').innerHTML=out.map((x,i)=>'<div class="insight"><span class="insight-num">0'+(i+1)+'</span><strong>'+esc(x.title)+'</strong><p>'+esc(x.text)+'</p></div>').join('');
}
function renderTable(rows){
 const latest=rows.slice(-20).reverse();setText('table-count',num(rows.length)+' rows · showing latest 20');
 $('price-table').innerHTML=latest.map(r=>'<tr><td>'+r.date+'</td><td>'+money(r.open)+'</td><td>'+money(r.high)+'</td><td>'+money(r.low)+'</td><td>'+money(r.close)+'</td><td>'+num(r.volume)+'</td><td class="'+((r.ret??0)>=0?'positive':'negative')+'">'+pct(r.ret)+'</td></tr>').join('');
}
function renderQuality(){
 const d=state.diagnostics;if(!d)return;
 setText('quality-total',num(d.total));setText('quality-valid',num(d.valid));setText('quality-rate',(100*d.valid/Math.max(1,d.total)).toFixed(2)+'%');
 const labels={blank:'Blank source rows',badDate:'Invalid dates',badPrice:'Missing / invalid prices',badRange:'Inconsistent OHLC ranges',badVolume:'Invalid trading volumes',duplicates:'Duplicate trading dates',unsorted:'Out-of-order source dates'};
 $('issue-list').innerHTML=Object.entries(labels).map(([k,label])=>'<div class="issue '+(d.issues[k]?'warning':'')+'"><span>'+label+'</span><strong>'+num(d.issues[k]||0)+'</strong></div>').join('');
 const s=summary(state.all);
 const items=[['File',state.filename],['Origin',state.source],['Rows received',num(d.total)],['Valid rows',num(d.valid)],['Date range',s.first+' — '+s.last],['Adjustment basis',s.priceBasis],['Calculations','Volatility: sample SD × √252; return: last / first − 1'],['Privacy','Local browser parsing; no dataset upload']];
 $('lineage-list').innerHTML=items.map(([a,b])=>'<div><dt>'+esc(a)+'</dt><dd>'+esc(b)+'</dd></div>').join('');
}
function renderReports(rows){
 const s=summary(rows);if(!s)return;
 setText('report-asof','Dataset through '+state.all.at(-1).date);
 $('report-statline').innerHTML=[['Closing price',money(s.end)],['Period return',pct(s.change)],['Trading days',num(s.days)]].map(([a,b])=>'<div><small>'+a+'</small><strong>'+b+'</strong></div>').join('');
 $('report-observations').innerHTML=observations(rows).map(x=>'<div class="report-item"><h3>'+esc(x.title)+'</h3><p>'+esc(x.text)+'</p></div>').join('');
}
function render(){
 if(!state.all.length)return;
 clearError();state.visible=selectPeriod(state.all,state.period);if(!state.visible.length)state.visible=state.all;
 const label=state.source==='Bundled demonstration history'?'Bundled real NVDA history · separate from Kaggle · 1999–2024':state.filename+' · imported locally from your computer';
 setText('dataset-notice',label+'  |  Last record: '+state.all.at(-1).date+'. Historical data, NOT a live market feed.');
 setText('status','Dataset ready');setText('sidebar-data',num(state.all.length)+' trading records');
 setText('data-origin-short','Historical, not live');
 renderKPIs(state.visible);renderInsights(state.visible);
 drawPrice(state.visible,'price-chart');
 drawBars(state.visible,'volume-chart','volume');
 drawBars(state.visible,'histogram-chart','hist');
 drawPrice(state.visible,'explorer-price-chart',state.mode);
 setText('explorer-subtitle',(state.hasAdjusted?'Adjusted closing prices available · ':'')+'Range '+state.period);
 setText('explorer-range',state.visible[0].date+' — '+state.visible.at(-1).date);
 renderTable(state.visible);renderQuality();renderReports(state.visible);
 document.querySelectorAll('[data-period]').forEach(x=>x.classList.toggle('active',x.dataset.period===state.period));
 document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x.dataset.mode===state.mode));
}
function setView(view){
 if(!['overview','explorer','quality','reports'].includes(view))return;
 state.view=view;
 document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===view));
 document.querySelectorAll('[data-screen]').forEach(n=>n.classList.toggle('active',n.dataset.screen===view));
 const names={overview:'Overview',explorer:'Price explorer',quality:'Dataset doctor',reports:'Reports'};
 setText('crumb',names[view]);window.scrollTo({top:0,behavior:'instant'});
 $('sidebar').classList.remove('open');if(state.all.length)render();
}
function download(name,contents,type){
 const a=document.createElement('a'); const url=URL.createObjectURL(new Blob([contents],{type}));
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function reportMarkdown(){
 const s=summary(state.visible);if(!s)return '';
 let lines=['# NVIDIA historical stock analysis','', '**Coverage:** '+s.first+' to '+s.last+' ('+s.days+' trading rows)', '**Dataset:** '+state.filename,'**Source:** '+state.source,'**Analysis price:** '+s.priceBasis,'',
 '## Metrics','','| Metric | Value |','|---|---:|','| Closing price | '+money(s.end)+' |','| Period return | '+pct(s.change)+' |','| Annualized realized volatility | '+absolutePct(s.volatility)+' |','| Maximum drawdown in window | '+absolutePct(s.maxDrawdown)+' |','| Average daily trading volume | '+num(s.averageVolume)+' shares |','','## Observations',''];
 for(const insight of observations(state.visible))lines.push('### '+insight.title,'',insight.text,'');
 lines.push('## Limitations','','Historic prices only, not live quotes. Results depend on source adjustments and possible splits. No investment advice, forecasts, or trading signals.','','Dataset import and analysis happen in the browser.','');
 return lines.join('\n');
}
function filteredCSV(){
 const cols=['Date','Open','High','Low','Close','Volume','Adj Close'];
 return [cols.join(',')].concat(state.visible.map(r=>[r.date,r.open,r.high,r.low,r.close,r.volume,r.adjClose??''].join(','))).join('\n')+'\n';
}
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
document.querySelectorAll('[data-period]').forEach(btn=>btn.addEventListener('click',()=>{state.period=btn.dataset.period;render();}));
document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{state.mode=btn.dataset.mode;render();}));
$('menu-toggle').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
$('export-csv').addEventListener('click',()=>{if(state.all.length)download('nvda-selected-'+state.period+'.csv',filteredCSV(),'text/csv;charset=utf-8');});
$('download-report').addEventListener('click',()=>{if(state.all.length)download('nvda-analysis-report.md',reportMarkdown(),'text/markdown');});
$('download-json').addEventListener('click',()=>{
 if(state.all.length)download('nvda-analytics-metrics.json',JSON.stringify({generatedAt:new Date().toISOString(),file:state.filename,source:state.source,period:state.period,summary:summary(state.visible),diagnostics:state.diagnostics,insights:observations(state.visible)},null,2),'application/json');
});
$('file-input').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(file.size>15*1024*1024){error('The CSV is larger than the 15 MB import limit.');e.target.value='';return;}
 try{setText('status','Importing data');const text=await file.text();applyData(text,'User-imported CSV (local only)',file.name);setView('overview');}
 catch(err){error('Unable to import CSV: '+err.message);setText('status','Import failed');}finally{e.target.value='';}
});
async function boot(){
 try{
 const response=await fetch(DEMO);if(!response.ok)throw new Error('HTTP '+response.status);
 applyData(await response.text(),'Bundled demonstration history','nvda-history-1999-2024.csv');
 }catch(e){error('Demo CSV could not be loaded ('+e.message+'). Serve this folder with a local HTTP server or import your own Kaggle CSV.');setText('status','Upload a CSV to begin');setText('sidebar-data','Awaiting CSV import');}
}
boot();
