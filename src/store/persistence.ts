import { createMMKV } from 'react-native-mmkv';
import { GameEvent } from '../ledger/types';
export interface PersistedGame {version:1;events:GameEvent[];lastSeq:number}
const storage=createMMKV({id:'monopoly-banker'});
export function saveGame(id:string,events:GameEvent[]):void {storage.set(`game:${id}`,JSON.stringify({version:1,events,lastSeq:events.at(-1)?.seq??-1}));storage.set('lastGameId',id)}
export function loadGame(id:string):PersistedGame|null {const raw=storage.getString(`game:${id}`);if(!raw)return null;try{const p=JSON.parse(raw);return p.version===1&&Array.isArray(p.events)?p:null}catch{return null}}
export function lastGameId(){return storage.getString('lastGameId')??null}
export function recoverEvents(raw:string):{events:GameEvent[];recovered:number;corrupt:boolean}{const events:GameEvent[]=[];let depth=0,start=-1,quoted=false,escaped=false;for(let i=0;i<raw.length;i++){const c=raw[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c==='{'){if(depth===0)start=i;depth++}if(c==='}'&&depth>0){depth--;if(depth===0&&start>=0){try{const e=JSON.parse(raw.slice(start,i+1));if(e.seq!==events.length)break;events.push(e)}catch{break}}}}return {events,recovered:events.length,corrupt:!raw.trim().endsWith(']')||depth!==0}}
