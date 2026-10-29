# Core primitives

Initial extraction source: `DanilaH/cases-yg` / Signal 2000, reference revision `26598606c8b0e143c9c97961bcdd8e03fd37bc61`.

## `PresentationSkipController`

A single-beat presentation checkpoint. It can fast-forward visual/audio time without owning durable gameplay state.

## RNG boundary

`RandomSource`, `nextUnit`, and `pickWeighted` keep gameplay randomness injectable and testable. Cosmetic randomness should use a separate source/path so presentation changes cannot perturb economy outcomes.

## Continuous interaction semantics

`normalizePositiveProgress` and `sampleContinuousInteraction` convert project-owned interaction geometry into bounded `progress`, `progressDelta`, `normalizedVelocity`, `active`, and `completed` semantics.

The kit deliberately does not own pointer coordinates, hitboxes, drag direction, completion distance, or gesture cancellation policy.

## Value transfer planning

`createValueTransferPlan` separates the durable semantic amount from visual and audio density. This is a deliberate improvement over Signal 2000's original one-visual-token-per-CHIPS-unit implementation.

A consumer can preserve Signal 2000 behavior by setting `maxVisualTokens` to the semantic amount, while future games can safely present very large values with a bounded number of objects.

Presentation helpers never mint or commit value. They only describe how already-owned value may be shown.
