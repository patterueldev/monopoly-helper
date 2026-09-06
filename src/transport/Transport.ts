import {GameEvent} from '../ledger/types';
export interface Transport { submit(intent:GameEvent):Promise<GameEvent>; eventsAfter(seq:number):Promise<GameEvent[]>; close():void }
