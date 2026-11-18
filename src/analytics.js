// Market data parsing and analytics for NVDA Insights Studio.
// All calculations are local. No trades, forecasts, or live market feeds.
export function parseCSV(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The CSV is empty.');
  const lines = []; let row = []; let cell = ''; let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => String(v).trim())) lines.push(row);
      row = []; cell = '';
    } else { cell += ch; }
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(cell); if (row.some(v => String(v).trim())) lines.push(row);
  if (lines.length < 2) throw new Error('The CSV needs a header and at least one data row.');
  const keys = lines[0].map(s => s.trim().toLowerCase().replace(/[\s_()-]/g, ''));
  const index = key => keys.indexOf(key);
  const positions = { date:index('date'),open:index('open'),high:index('high'),low:index('low'),close:index('close'),volume:index('volume') };
  if (Object.values(positions).some(i => i < 0)) {
    throw new Error('Required columns: Date, Open, High, Low, Close and Volume. Adj Close is optional.');
  }
  const adjusted = index('adjclose');
  const parsed = [], issues = { blank:0, badDate:0, badPrice:0, badRange:0, badVolume:0, duplicates:0, unsorted:0 };
  let previousDate = '';
  for (let n = 1; n < lines.length; n++) {
    const cells = lines[n];
    const date = String(cells[positions.date] || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T00:00:00Z')) || new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date) { issues.badDate++; continue; }
    const numeric = key => { const value=String(cells[positions[key]] ?? '').replace(/,/g, '').trim(); return value==='' ? NaN : Number(value); };
    const open = numeric('open'), high = numeric('high'), low = numeric('low'), close = numeric('close'), volume = numeric('volume');
    if (![open,high,low,close].every(v => Number.isFinite(v) && v > 0)) { issues.badPrice++; continue; }
    if (high < Math.max(open,close) * 0.999999 || low > Math.min(open,close) * 1.000001 || low > high) { issues.badRange++; continue; }
    if (!Number.isFinite(volume) || volume < 0) { issues.badVolume++; continue; }
    if (previousDate && date < previousDate) issues.unsorted++;
    previousDate = date;
    const adjRaw = adjusted >= 0 ? Number(String(cells[adjusted] ?? '').trim()) : NaN;
    parsed.push({ date,open,high,low,close,volume,adjClose:Number.isFinite(adjRaw)&&adjRaw>0?adjRaw:null });
  }
  if (!parsed.length) throw new Error('No valid stock-price rows were found. Check your CSV format.');
  parsed.sort((a,b) => a.date.localeCompare(b.date));
  const deduped = [];
  for (const entry of parsed) {
    if (deduped.length && deduped[deduped.length-1].date === entry.date) { issues.duplicates++; deduped[deduped.length-1] = entry; }
    else deduped.push(entry);
  }
  return { rows: deduped, diagnostics:{total:lines.length-1,valid:deduped.length,issues}, headers:lines[0].map(v=>v.trim()),hasAdjusted:adjusted>=0 };
}
export function enrichRows(rows) {
  let sum20=0,sum50=0,peak=-Infinity;
  const q20=[],q50=[];
  return rows.map((r,i) => {
    const price = r.adjClose ?? r.close;
    const prev = i ? (rows[i-1].adjClose ?? rows[i-1].close) : null;
    q20.push(price);q50.push(price);sum20+=price;sum50+=price;
    if(q20.length>20)sum20-=q20.shift();
    if(q50.length>50)sum50-=q50.shift();
    peak=Math.max(peak,price);
    return {...r,price,ret:prev ? price/prev - 1 : null,sma20:q20.length===20?sum20/20:null,sma50:q50.length===50?sum50/50:null,drawdown:peak>0?price/peak-1:0};
  });
}
export function selectPeriod(rows,code) {
  if(!rows.length||code==='ALL')return rows;
  const n=Number(code.slice(0,-1)),unit=code.slice(-1);
  if(!Number.isFinite(n)||!n) return rows;
  const end = new Date(rows[rows.length-1].date+'T00:00:00Z');
  const since = new Date(end);
  if(unit==='M') since.setUTCMonth(since.getUTCMonth()-n);
  else if(unit==='Y') since.setUTCFullYear(since.getUTCFullYear()-n);
  else return rows;
  const boundary=since.toISOString().slice(0,10);
  return rows.filter(r=>r.date>=boundary);
}
export function summary(rows) {
  if(!rows.length) return null;
  const first=rows[0],last=rows[rows.length-1], start=first.price ?? first.close, end=last.price??last.close;
  const returns=rows.slice(1).map((r,i)=>(r.price??r.close)/(rows[i].price??rows[i].close)-1).filter(Number.isFinite);
  const avg=returns.length?returns.reduce((a,b)=>a+b,0)/returns.length:0;
  const variance=returns.length>1?returns.reduce((a,b)=>a+(b-avg)**2,0)/(returns.length-1):0;
  const highs=rows.map(r=>r.high), lows=rows.map(r=>r.low);
  let peak=-Infinity,maxDD=0;
  for(const r of rows) { peak=Math.max(peak,r.price??r.close);maxDD=Math.min(maxDD,(r.price??r.close)/peak-1); }
  const volume=rows.reduce((a,b)=>a+b.volume,0);
  return {first:last?first.date:'',last:last.date,days:rows.length,start,end,change:end/start-1,volatility:returns.length>1?Math.sqrt(variance)*Math.sqrt(252):null,averageVolume:volume/rows.length,totalVolume:volume,maxDrawdown:maxDD,highest:Math.max(...highs),lowest:Math.min(...lows),positiveDays:returns.filter(x=>x>0).length,negativeDays:returns.filter(x=>x<0).length,returns,priceBasis:rows.some(r=>r.adjClose!==null)?'Adjusted close where available':'Close as supplied'};
}
export function annualVolume(rows) {
 const data=new Map();
 for(const r of rows) {const year=r.date.slice(0,4);data.set(year,(data.get(year)||0)+r.volume);}
 return [...data].map(([year,volume])=>({year,volume}));
}
export function observations(rows) {
 const s=summary(rows);if(!s)return [];
 const out=[];
 out.push({title:'Period performance',text:'The selected price series '+(s.change>=0?'rose ':'fell ')+Math.abs(s.change*100).toFixed(2)+'% from '+s.first+' to '+s.last+'.'});
 if(s.volatility!==null) out.push({title:'Realized volatility',text:'Annualized daily-return volatility was '+(s.volatility*100).toFixed(2)+'% in this window. This is a historical statistic, not a forecast.'});
 out.push({title:'Drawdown from peak',text:'The largest peak-to-trough decline within this selection was '+Math.abs(s.maxDrawdown*100).toFixed(2)+'%.'});
 out.push({title:'Coverage',text:'The current selection contains '+s.days.toLocaleString('en-US')+' trading records. The latest date in this file is '+s.last+'.'});
 return out;
}
