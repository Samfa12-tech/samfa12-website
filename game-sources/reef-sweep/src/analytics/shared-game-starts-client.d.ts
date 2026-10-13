export function createGameStartTracker(options: {gameId:'reef-sweep'|'briarhold';enabled?:boolean;endpoint?:string}): {
 markReady():void; start():Promise<unknown>; activity():void; flush():Promise<unknown>; syncConsent():void; dispose():void;
};
