import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogs, chooseLanguage, copy, language, LANGUAGE_KEY, loadLanguage, setLanguage } from '../src/i18n';
import { instruction } from '../src/ui/instructions';
import { levels } from '../src/content/levels';
afterEach(() => { vi.unstubAllGlobals(); setLanguage('ru'); });
describe('language preferences and copy', () => {
  it('keeps RU for existing users and invalid/missing/unavailable noncritical preference', () => {
    for (const raw of [null, '', 'fr', '{bad']) { loadLanguage({getItem: () => raw}); expect(language).toBe('ru'); }
    loadLanguage({getItem: () => {throw Error('blocked');}}); expect(language).toBe('ru');
  });
  it('persists only the language key and never rewrites valuable progress', () => {
    const disk = new Map([['road-lines.save.v1', '{valuable snapshot}']]);
    expect(chooseLanguage('en', {setItem: (k, v) => {disk.set(k,v);}})).toBe(true);
    expect(disk.get('road-lines.save.v1')).toBe('{valuable snapshot}'); expect(disk.get(LANGUAGE_KEY)).toBe('en');
    setLanguage('ru'); loadLanguage({getItem: k => disk.get(k) ?? null}); expect(language).toBe('en'); expect(copy.pause).toBe('Pause');
  });
  it('reports a failed preference write while applying the chosen language in memory', () => {
    expect(chooseLanguage('en', {setItem: () => {throw Error('full');}})).toBe(false); expect(language).toBe('en'); expect(copy.pause).toBe('Pause');
  });
  it('updates document language and all live copy bindings', () => {
    const document={documentElement:{lang:''}}; vi.stubGlobal('document',document);
    const message=() => copy.deadEndReturn(1); setLanguage('en'); expect(document.documentElement.lang).toBe('en'); expect(message()).toContain('1 cell?');
    setLanguage('ru'); expect(document.documentElement.lang).toBe('ru'); expect(message()).toContain('1 клетку?');
  });
  it('uses correct RU/EN number forms for zero, teens and compound counts', () => {
    expect([0,1,2,5,11,14,21,22,111].map(copy.coins)).toEqual(['0 монет','1 монета','2 монеты','5 монет','11 монет','14 монет','21 монета','22 монеты','111 монет']);
    expect(copy.deadEndReturn(1)).toContain('1 клетку'); expect(copy.deadEndReturn(4)).toContain('4 клетки'); expect(copy.deadEndReturn(19)).toContain('19 клеток');
    setLanguage('en'); expect(copy.coins(1)).toBe('1 coin'); expect(copy.coins(21)).toBe('21 coins'); expect(copy.deadEndReturn(2)).toContain('2 cells?');
  });
  it('has complete matching catalogs and no Cyrillic left in English strings', () => {
    const visit=(a: object,b: object): void => {expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort()); for(const [key,value] of Object.entries(b)){if(typeof value==='string')expect(value).not.toMatch(/[А-Яа-яЁё]/);else if(typeof value==='object')visit((a as Record<string,object>)[key]!,value);}};
    visit(catalogs.ru,catalogs.en);
  });
});
describe('nonblocking first-gesture coaching', () => {
  it('explains fill, release/resume and actual reverse undo without changing the route', () => {
    const coach={released:false,backtracked:false}; const path=[0,1];
    expect(instruction(levels[0]!,path,[],coach)).toBe(copy.fill);
    expect(instruction(levels[1]!,[levels[1]!.start],[],coach)).toBe(copy.releaseTip);
    coach.released=true;expect(instruction(levels[1]!,[levels[1]!.start,levels[1]!.witness[1]!],[],coach)).toBe(copy.resumeTip);
    expect(instruction(levels[2]!,path,[],coach)).toBe(copy.undoTip);coach.backtracked=true;expect(instruction(levels[2]!,path,[],coach)).toBe(copy.undoDone);expect(path).toEqual([0,1]);
  });
  it('does not repeat coaching for completed puzzles or obscure rule goals', () => {
    const coach={released:true,backtracked:true};expect(instruction(levels[2]!,[0,1],['intro-03'],coach)).toBe(copy.continueHead);
    expect(instruction(levels[15]!,[levels[15]!.start],[],coach)).toBe(copy.finishLast);
  });
});
