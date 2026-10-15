export interface ChartLabel { name: string; x: number; y: number }
export interface PlacedLabel extends ChartLabel { left: number; top: number; width: number; height: number; lines: string[] }
/** Deterministic label packing in chart pixels; leaders retain marker identity. */
export function layoutChartLabels(labels: ChartLabel[], size: number, measure: (text: string) => number, lineHeight=20): PlacedLabel[] {
    const placed: PlacedLabel[] = [], margin = 12, bottom = size - 42;
    for (const label of labels) {
        const lines: string[] = []; let line = '';
        for (const word of label.name.split(/\s+/)) { const next = line ? `${line} ${word}` : word; if (measure(next) > Math.min(200, size * .4) && line) { lines.push(line); line = word; } else line = next; }
        if (line) lines.push(line);
        const width = Math.min(size - margin * 2, Math.max(...lines.map(measure)) + 12), height = lines.length * lineHeight + 6;
        const candidates = [];
        for (let ring = 0; ring < 12; ring++) for (const side of [1, -1]) for (const dy of [0, -1, 1]) {
            const left = Math.max(margin, Math.min(size - margin - width, side === 1 ? label.x + 12 + ring * 12 : label.x - width - 12 - ring * 12));
            const top = Math.max(margin, Math.min(bottom - height, label.y - height - 8 + dy * (height + 8) * (ring + 1)));
            const collisions = placed.reduce((n, p) => n + (left < p.left + p.width + 5 && left + width + 5 > p.left && top < p.top + p.height + 5 && top + height + 5 > p.top ? 1 : 0), 0);
            candidates.push({ left, top, cost: collisions * 1e6 + Math.hypot(left + width / 2 - label.x, top + height / 2 - label.y) });
        }
        // Dense edge clusters need a real free-space fallback, not repeated clamps
        // of the same off-chart candidate. Search the small chart in pixel space.
        for (let top = margin; top + height <= bottom; top += 8) for (let left = margin; left + width <= size - margin; left += 8) {
            if (placed.some(p => left < p.left + p.width + 5 && left + width + 5 > p.left && top < p.top + p.height + 5 && top + height + 5 > p.top)) continue;
            candidates.push({left,top,cost:Math.hypot(left+width/2-label.x,top+height/2-label.y)});
        }
        const best = candidates.sort((a, b) => a.cost - b.cost)[0];
        placed.push({ ...label, ...best, width, height, lines });
    }
    const overlaps = placed.some((a,i)=>placed.slice(i+1).some(b=>a.left<b.left+b.width+4&&a.left+a.width+4>b.left&&a.top<b.top+b.height+4&&a.top+a.height+4>b.top));
    if(overlaps){
        // Repack dense charts into balanced peripheral columns, ordered by
        // anchor height. Leaders make even a remote label unambiguous.
        const sorted=placed.slice().sort((a,b)=>a.x-b.x), half=Math.ceil(sorted.length/2);
        for(const [column,items] of [sorted.slice(0,half),sorted.slice(half)].entries()){
            items.sort((a,b)=>a.y-b.y);const total=items.reduce((n,l)=>n+l.height+6,0);let y=Math.max(margin,(bottom-total)/2);
            for(const label of items){label.left=column===0?margin:size-margin-label.width;label.top=y;y+=label.height+6;}
        }
    }
    return placed;
}
