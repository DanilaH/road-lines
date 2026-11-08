import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Resolve intersections/aliases too: a regex over Events would miss LevelInfo fields.
const file = resolve('src/services/analytics.ts');
const program = ts.createProgram([file], { target: ts.ScriptTarget.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, skipLibCheck: true });
const checker = program.getTypeChecker();
const source = program.getSourceFile(file)!;
const events = source.statements.find((s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === 'Events')!;
const eventType = checker.getTypeAtLocation(events);
const expectedEvents = eventType.getProperties().map(p => p.name).sort();
const expectedKeys = [...new Set(['schema', ...eventType.getProperties().flatMap(event =>
  checker.getTypeOfSymbolAtLocation(event, events).getProperties().map(p => p.name))])].sort();
const native = readFileSync('native/android/RoadAnalyticsPlugin.java', 'utf8');
function values(text: string, name: string): string[] {
  const initializer = text.match(new RegExp(`\\b${name} = new HashSet<>\\(Arrays.asList\\(([\\s\\S]*?)\\)\\);`));
  if (!initializer) throw Error(`Missing native ${name} initializer`);
  return [...initializer[1]!.matchAll(/"([a-z_]+)"/g)].map(m => m[1]!).sort();
}
describe('actual TypeScript/native analytics contract', () => {
  it('accepts every declared event and every resolved payload key including schema', () => {
    expect(expectedEvents.length).toBeGreaterThan(0);
    expect(values(native, 'EVENTS')).toEqual(expectedEvents);
    expect(values(native, 'KEYS')).toEqual(expectedKeys);
  });
  it('detects the historical silently rejected monetization events and parameters', () => {
    expect(values(native.replace('"ad_reward_granted",', ''), 'EVENTS')).not.toEqual(expectedEvents);
    expect(values(native.replace('"placement",', ''), 'KEYS')).not.toEqual(expectedKeys);
    // Every payload fits the actual native envelope; values still need device acceptance.
    const envelope = Number(native.match(/params\.length\(\)\s*>\s*(\d+)/)?.[1]);
    expect(Number.isSafeInteger(envelope) && envelope > 0).toBe(true);
    for (const event of eventType.getProperties()) {
      const fields = checker.getTypeOfSymbolAtLocation(event, events).getProperties();
      expect(fields.length + 1).toBeLessThanOrEqual(envelope);
      for (const field of fields) {
        const type = checker.getTypeOfSymbolAtLocation(field, events);
        const parts = type.isUnion() ? type.types : [type];
        const scalar = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.Undefined;
        expect(parts.every(t => Boolean(t.flags & scalar)), `${event.name}.${field.name} must fit native scalar parameters`).toBe(true);
      }
    }
  });
});
