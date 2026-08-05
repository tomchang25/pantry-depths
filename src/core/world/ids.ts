/**
 * The run's identity allocator.
 *
 * Its own module rather than a function on the state record, because both the state module and the
 * feedback owner below it hand out identities. With the allocator living in either one, the other has
 * to import it and the two become a runtime cycle; here, both import downward and neither imports the
 * other.
 */

/** The counter's home. Narrower than the whole run state, so an allocator cannot reach anything else. */
export type IdCounter = { nextId: number };

/** One identity, prefixed by what asked for it. The counter advances before the number is read. */
export function nextId(counter: IdCounter, prefix: string): string {
  counter.nextId += 1;
  return `${prefix}-${counter.nextId}`;
}
