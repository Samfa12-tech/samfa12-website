import { createGameStartTracker } from './shared-game-starts-client.js';

type Tracker = { markReady(): unknown; start(): unknown; activity(): unknown; dispose(): unknown };
/** Guard even unexpected adapter errors. Gameplay never waits for telemetry. */
export function createGameStartLifecycle(tracker: Tracker, enabled=true) {
    let ready=false;
    const safely=(call:()=>unknown)=>{try{Promise.resolve(call()).catch(()=>{});}catch{/* Measurement is optional. */}};
    return {
        markReady(){ready=true;safely(()=>tracker.markReady());},
        start(){if(ready&&enabled)safely(()=>tracker.start());},
        activity(){if(ready&&enabled)safely(()=>tracker.activity());},
        dispose(){safely(()=>tracker.dispose());},
    };
}
export function prepareWebsiteGameStartHook() {
    // Shared contract b928454. Production activation remains held for approval.
    const config={gameId:'reef-sweep' as const,enabled:false,endpoint:''};
    return createGameStartLifecycle(createGameStartTracker(config),config.enabled);
}
