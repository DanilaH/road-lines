import { describe, it, expect } from 'vitest';
import { routeDots } from '../src/presentation/geometry';
import { directionSteps } from '../src/services/input';
import { nextLevel } from '../src/core/progression';
import { levels } from '../src/content/levels';
import { complete } from '../src/core/model';
import { decodeSave, defaultSave } from '../src/services/save';
describe('physical playtest fixes', () => {
  it('keeps one dot phase across non-multiple segment lengths and no doubled corners', () => {
    const dots = routeDots([{x:0,y:0},{x:40,y:0},{x:40,y:37},{x:84,y:37}],9,1.2);
    const distances = dots.map(p => p.y===0?p.x:p.x===40?40+p.y:77+p.x-40);
    for (let i=1;i<distances.length;i++) expect(distances[i]!-distances[i-1]!).toBeCloseTo(9);
    expect(distances[0]).toBe(4.5); expect(new Set(dots.map(p=>`${p.x},${p.y}`)).size).toBe(dots.length);
    for(let i=1;i<dots.length;i++)expect(Math.hypot(dots[i]!.x-dots[i-1]!.x,dots[i]!.y-dots[i-1]!.y)).toBeGreaterThan(6);
  });
  it('converts off-board thumb travel to bounded orthogonal steps without diagonal phantom turns', () => {
    expect(directionSteps({x:20,y:10},30).steps).toEqual([]);
    expect(directionSteps({x:95,y:40},30)).toEqual({steps:[{x:1,y:0},{x:1,y:0},{x:1,y:0}],remainder:{x:5,y:0}});
    expect(directionSteps({x:10,y:-65},30).steps).toEqual([{x:0,y:-1},{x:0,y:-1}]);
    expect(directionSteps({x:10000,y:10},30).steps).toHaveLength(12);
  });
  it('continues through both set boundaries and stops only at the bank end', () => {
    expect(nextLevel('checkpoints-05')?.id).toBe('turns-01'); expect(nextLevel('turns-30')?.id).toBe('shapes-01');
    expect(nextLevel('shapes-30')).toBeUndefined(); expect(nextLevel('missing')).toBeUndefined();
  });
  it('teaches numbered endpoints and repairs only the three older drafts, preserving earned state', () => {
    for(const id of ['checkpoints-01','checkpoints-02','checkpoints-03']) {
      const l=levels.find(x=>x.id===id)!;
      expect(l.version).toBe(2); expect(l.finish).toBe(l.checkpoints?.at(-1)); expect(complete(l,l.witness)).toBe(true);
      const old={...defaultSave(),levelId:id,levelVersion:1,path:l.witness.slice(0,4),drafts:{[id]:{version:1,path:l.witness.slice(0,4)}},coins:777,hints:2,completed:[id],ownedThemes:['classic','mint','dusk'],themeId:'dusk'};
      expect(decodeSave(JSON.stringify(old))).toMatchObject({coins:777,hints:2,completed:[id],themeId:'dusk',ownedThemes:old.ownedThemes,path:[l.start],levelVersion:2});
    }
  });
});
