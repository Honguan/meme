import assert from 'node:assert/strict';
import { DEFAULT_DECK } from '../src/catalog.js';

const clients=Number(process.argv[2]||64),base=new URL(process.argv[3]||'http://127.0.0.1:8797');
assert.ok(Number.isInteger(clients)&&clients>=2&&clients<=256&&clients%2===0,'Use an even client count from 2 to 256.');
assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname),'This benchmark only targets a local server.');
const keys=Array.from({length:clients},()=>`${crypto.randomUUID()}-${crypto.randomUUID()}`),times=[];
async function call(key,action='state',data={}){
  const start=performance.now(),response=await fetch(new URL(`/api/match/${action}`,base),{
    method:action==='state'?'GET':'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},
    ...(action==='state'?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(10000),
  });
  const result=await response.json();times.push(performance.now()-start);
  assert.ok(response.ok,`${action}: HTTP ${response.status}: ${result.error}`);return result;
}
async function batch(action='state',data={}){
  const results=await Promise.allSettled(keys.map(key=>call(key,action,data))),failed=results.find(result=>result.status==='rejected');
  if(failed)throw failed.reason;
  return results.map(result=>result.value);
}
const start=performance.now();let states,polls=0;
try {
  await batch('join',{deck:DEFAULT_DECK,custom:[],field:'grid'});
  const deadline=performance.now()+30000;
  do {
    states=await batch();polls++;
    if(states.every(state=>state.status==='matched'))break;
  } while(performance.now()<deadline);
  assert.ok(states.every(state=>state.status==='matched'),'Some clients did not match within 30 seconds.');
  const pairs=new Map();
  for(const state of states){const sides=pairs.get(state.id)||[];sides.push(state.side);pairs.set(state.id,sides);}
  assert.equal(pairs.size,clients/2);for(const sides of pairs.values())assert.deepEqual(sides.sort(),[0,1]);
  const elapsed=performance.now()-start,samples=[...times].sort((a,b)=>a-b);
  console.log(JSON.stringify({clients,matches:pairs.size,polls,requests:times.length,elapsedMs:Math.round(elapsed),p50Ms:Math.round(samples[Math.floor(samples.length*.5)]),p95Ms:Math.round(samples[Math.floor(samples.length*.95)])}));
} catch(error) {
  console.error(error.message);process.exitCode=1;
} finally {
  const results=await Promise.allSettled(keys.map(key=>call(key,'leave')));
  if(!results.every(result=>result.status==='fulfilled'&&result.value.status==='idle')){console.error('Some benchmark tickets could not be removed.');process.exitCode=1;}
}
