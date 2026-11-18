import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,enrichRows,selectPeriod,summary,annualVolume,observations} from '../src/analytics.js';
const input='Date,Open,High,Low,Close,Volume\n2024-01-02,10,12,9,11,100\n2024-01-03,11,13,10,12,120\n2024-01-04,12,13,10,10.5,140\n';
test('parses, sorts and summarizes the rows',()=>{
 const data=parseCSV(input);assert.equal(data.rows.length,3);assert.equal(data.diagnostics.issues.badPrice,0);
 const rows=enrichRows(data.rows);const s=summary(rows);
 assert.equal(s.days,3);assert.equal(s.end,10.5);assert.equal(s.totalVolume,360);assert.equal(annualVolume(rows)[0].year,'2024');
 assert.equal(observations(rows).length,4);
});
test('rejects malformed schema and dates',()=>{
 assert.throws(()=>parseCSV('Date,Price\n2024-01-02,10'),/Required columns/);
 const c=parseCSV(input+'2024-02-30,1,1,1,1,100\n');assert.equal(c.diagnostics.issues.badDate,1);
});
test('handles quoted fields, out of order rows and duplicates',()=>{
 const reversed='Date,Open,High,Low,Close,Volume\n2024-02-02,10,12,9,11,100\n2024-01-02,10,12,9,11,100\n2024-02-02,10,12,9,12,100\n';
 const data=parseCSV(reversed);assert.equal(data.diagnostics.issues.unsorted,1);assert.equal(data.diagnostics.issues.duplicates,1);assert.equal(data.rows.length,2);
});
test('computes rolling averages and stable moving windows',()=>{
 const s='Date,Open,High,Low,Close,Volume\n'+Array.from({length:55},(_,i)=>{
 const date=new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10);const c=i+1;return [date,c,c,c,c,100].join(',');
 }).join('\n');
 const rows=enrichRows(parseCSV(s).rows);
 assert.equal(rows[18].sma20,null);assert.equal(rows[19].sma20,10.5);assert.equal(rows[49].sma50,25.5);
 assert.equal(selectPeriod(rows,'1M').at(-1).price,55);assert.equal(selectPeriod(rows,'ALL').length,55);
});
test('nonpositive or inconsistent OHLC and volume are rejected',()=>{
 const x=parseCSV(input+'2024-01-05,0,1,1,1,10\n2024-01-06,10,9,8,11,10\n2024-01-07,10,11,9,10,-5\n');
 assert.equal(x.rows.length,3);assert.equal(x.diagnostics.issues.badPrice,1);assert.equal(x.diagnostics.issues.badRange,1);assert.equal(x.diagnostics.issues.badVolume,1);
});
