import {GameEvent,GameState,TransferReason} from './types';
export const makeEvent=<T extends GameEvent>(type:T['type'],payload:T['payload'],actorId:string,seq:number,intentId=String(Date.now())+Math.random()):T=>({type,payload,actorId,seq,ts:Date.now(),intentId} as T);
export const buildTransfer=(s:GameState,from:string,to:string,amount:number,reason:TransferReason,seq:number)=>makeEvent('transfer',{from,to,amount,reason},from,seq);
export const canTransfer=(s:GameState,from:string,to:string,amount:number)=>!s.ended&&from!==to&&amount>0&&Number.isSafeInteger(amount)&&!!s.accounts[from]&&!!s.accounts[to]&&!s.eliminated.has(from);
