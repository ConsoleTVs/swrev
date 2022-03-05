import { SWRKey } from './key'

export type SWRListener = (payload: any) => void

export interface SWREventManager {
  subscribe(key: SWRKey, listener: SWRListener): void
  unsubscribe(key: SWRKey, listener: SWRListener): void
  emit<D = any>(key: SWRKey, payload: D): void
}

/**
 * Default event manager class.
 */
export class DefaultSWREventManager implements SWREventManager {
  /**
   * Stores the list of active listener.s
   */
  protected readonly listeners: Map<SWRKey, SWRListener[]> = new Map()

  /**
   * Subscribes a given listener.
   */
  public subscribe(key: SWRKey, listener: SWRListener) {
    // Add the list if it didn't exist before.
    if (!this.listeners.has(key)) this.listeners.set(key, [])

    // Check if the listener has already been added.
    if (this.listeners.get(key)!.includes(listener)) return

    // Add the listener to the active list.
    this.listeners.get(key)!.push(listener)
  }

  /**
   * Unsubscribes the given listener.
   */
  public unsubscribe(key: SWRKey, listener: SWRListener) {
    // Check if the key exists.
    if (!this.listeners.has(key)) return

    // Check if the listener is active.
    if (!this.listeners.get(key)!.includes(listener)) return

    // Remove the event listener.
    this.listeners.get(key)!.splice(this.listeners.get(key)!.indexOf(listener), 1)

    // Remove the key if there are no more listeners active.
    if (this.listeners.get(key)!.length === 0) this.listeners.delete(key)
  }

  /**
   * Emits an event to all active listeners.
   */
  public emit<D = any>(key: SWRKey, payload: D) {
    // Check if the key exists
    if (!this.listeners.has(key)) return

    // Call all the active listeners with the given payload.
    this.listeners.get(key)!.forEach((listener) => listener(payload))
  }
}
