import { z } from 'zod';

export type AccountKind = 'player'|'bank'|'pot';
export type Asset = never;
export interface Account { id:string; kind:AccountKind; name:string; color:string; unlimited:boolean; assets:Asset[] }
export interface GameConfig { startingCash:number; goSalary:number; doubleOnExactGo:boolean; freeParkingPot:boolean; bankerMode:boolean; currencySymbol:string; quickAmounts:number[] }
export type TransferReason = {kind:'go'}|{kind:'rent'}|{kind:'buy'}|{kind:'tax'}|{kind:'card'}|{kind:'trade'}|{kind:'other';note?:string};
export interface Settlement { playerId:string; mode:'fast'|'itemized'; valuation:number; cash:number; assetTotal:number; netWorth:number; rank?:number }
export type EventType='game.started'|'player.joined'|'player.renamed'|'transfer'|'transfer.reversed'|'player.eliminated'|'game.ended';
export type Payload = { 'game.started':{config:GameConfig;accounts:Account[]}; 'player.joined':{account:Account}; 'player.renamed':{accountId:string;name:string;color:string}; transfer:{from:string;to:string;amount:number;reason:TransferReason}; 'transfer.reversed':{targetSeq:number}; 'player.eliminated':{accountId:string;creditorId:string|null}; 'game.ended':{tally:Settlement[]} };
export type GameEvent<T extends EventType=EventType> = { [K in T]: {seq:number;ts:number;actorId:string;intentId:string;type:K;payload:Payload[K]} }[T];
export interface GameState { started:boolean; ended:boolean; config?:GameConfig; accounts:Record<string,Account>; balances:Record<string,number>; eliminated:Set<string>; reversed:Set<number>; events:GameEvent[]; tally?:Settlement[]; lastPayer?:string; invalid:boolean }
export const reasonSchema=z.object({kind:z.enum(['go','rent','buy','tax','card','trade','other']),note:z.string().optional()});
export const configSchema=z.object({startingCash:z.number().int(),goSalary:z.number().int(),doubleOnExactGo:z.boolean(),freeParkingPot:z.boolean(),bankerMode:z.boolean(),currencySymbol:z.string(),quickAmounts:z.array(z.number().int())});
export const accountSchema=z.object({id:z.string(),kind:z.enum(['player','bank','pot']),name:z.string(),color:z.string(),unlimited:z.boolean(),assets:z.array(z.unknown())});
export const eventSchema=z.object({seq:z.number().int().nonnegative(),ts:z.number(),actorId:z.string(),intentId:z.string(),type:z.string(),payload:z.unknown()});
export const DEFAULT_CONFIG:GameConfig={startingCash:1500,goSalary:200,doubleOnExactGo:false,freeParkingPot:false,bankerMode:true,currencySymbol:'$',quickAmounts:[50,100,200,500]};
