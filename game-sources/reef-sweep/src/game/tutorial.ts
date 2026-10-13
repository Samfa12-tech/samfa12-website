import type { Profile, Run, InputFrame, Settings } from './types.js';
export const LESSON_STEPS = 7;
export function startLesson(run: Run) { run.lesson = { step: 0, look: 0, move: 0, drawn: false }; }
export function lessonActive(run: Run) { return !!run.lesson && !run.lesson.skipped && run.lesson.step < LESSON_STEPS; }
/** Accumulate intentional inputs; currents and elapsed time cannot complete a lesson. */
export function advanceLesson(profile: Profile, run: Run, input: InputFrame, dt: number, aimedAtFish: boolean): boolean {
    const lesson = run.lesson;
    if (!lessonActive(run) || !lesson) return false;
    lesson.look = Math.min(10, lesson.look + Math.abs(input.lookX) + Math.abs(input.lookY));
    if (Math.abs(input.moveX) + Math.abs(input.moveZ) + Math.abs(input.vertical) > .1) lesson.move = Math.min(100, lesson.move + dt);
    if (input.cancelDraw) lesson.drawn = false;
    else if (input.draw && run.charge >= .65) lesson.drawn = true;
    const complete = [lesson.look >= .15, lesson.move >= .8, aimedAtFish, run.removed > 0, run.cargo.length > 0, run.cleaned + run.restored > 0, run.finished && !run.rescued][lesson.step];
    if (!complete) return false;
    lesson.step++;
    if (lesson.step >= LESSON_STEPS) profile.tutorial = Math.max(profile.tutorial, 1);
    return true;
}
export function skipLesson(profile: Profile, run: Run) { if (run.lesson) run.lesson.skipped = true; profile.tutorial = Math.max(profile.tutorial, 1); }
export function lessonPrompt(run: Run, mode: 'keyboard' | 'touch' | 'gamepad', settings: Settings) {
    const k = (name: keyof Settings['keys']) => settings.keys[name].replace('Key', '').replace('Left', '');
    const look = mode === 'touch' ? 'Drag the water to look around.' : mode === 'gamepad' ? 'Move the right stick to look around.' : 'Move the mouse to look around.';
    const move = mode === 'touch' ? 'Use the left thumb stick to swim.' : mode === 'gamepad' ? 'Use the left stick to swim.' : `${k('forward')}${k('left')}${k('back')}${k('right')} swims. Try moving a little.`;
    const draw = mode === 'touch' ? 'Hold Draw, aim, then release to strike.' : mode === 'gamepad' ? 'Hold your mapped spear control, then release to strike.' : 'Hold the mouse button to draw, then release to strike.';
    const interact = mode === 'touch' ? 'Hold Interact' : mode === 'gamepad' ? 'Hold your mapped Interact control' : `Hold ${k('interact')}`;
    const messages = [look, move, 'Approach a lionfish slowly. Get the aiming reticle within spear range.', draw, `${interact} to secure the fish in your tube.`, `${interact} beside discarded fishing gear or a nursery plot.`, `Follow HOME, ascend beside your buoy, then ${interact.toLowerCase()} to board.`];
    return messages[run.lesson?.step ?? 0] ?? 'First dive complete. The reef is yours to explore.';
}
