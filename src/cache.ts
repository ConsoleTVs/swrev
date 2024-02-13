import { SWREventManager, DefaultSWREventManager, SWRListener } from './events'
import { SWRKey } from './key'

/**
 * Default cache removal options.
 */
export const defaultCacheRemoveOptions: CacheRemoveOptions = {
  broadcast: false,
}

/**
 * Default cache clear options.
 */
export const defaultCacheClearOptions: CacheClearOptions = {
  broadcast: false,
}

/**
 * Determines how a cache item data looks like.
 */
export interface CacheItemData<D> {
  /**
   * Determines the data that's stored in the cache.
   */
  data: D | Promise<D>

  /**
   * Determines the expiration date for the given set of data.
   */
  expiresAt?: Date | null
}

/**
 * Determines the type of the cache items.
 */
export class CacheItem<D = unknown> {
  /**
   * Determines the data that's stored in the cache.
   */
  data: D | Promise<D>

  /**
   * Determines the expiration date for the given set of data.
   */
  expiresAt: Date | null

  /**
   * Creates the cache item given the data and expiration at.
   */
  constructor({ data, expiresAt = null }: CacheItemData<D>) {
    this.data = data
    this.expiresAt = expiresAt
  }

  /**
   * Determines if the current cache item is still being resolved.
   * This returns true if data is a promise, or false if type `D`.
   */
  isResolving(): boolean {
    return this.data instanceof Promise
  }

  /**
   * Determines if the given cache item has expired.
   */
  hasExpired(): boolean {
    return this.expiresAt === null || new Date(this.expiresAt) < new Date()
  }

  /**
   * Set the expiration time of the given cache item relative to now.
   */
  expiresIn(milliseconds: number): this {
    this.expiresAt = new Date()
    this.expiresAt.setMilliseconds(this.expiresAt.getMilliseconds() + milliseconds)
    return this
  }
}

/**
 * Determines the cache item removal options.
 */
export interface CacheRemoveOptions {
  /**
   * Determines if the cache should broadcast the cache
   * change to subscribed handlers. That means telling them
   * the value now resolves to undefined.
   */
  broadcast: boolean
}

/**
 * Determines the cache clear options.
 */
export interface CacheClearOptions extends CacheRemoveOptions { }

/**
 * Represents the methods a cache should implement
 * in order to be usable by vue-swr.
 */
export interface SWRCache {
  /**
   * Gets an item from the cache.
   */
  get<D>(key: SWRKey): CacheItem<D>

  /**
   * Sets an item to the cache.
   */
  set<D>(key: SWRKey, value: CacheItem<D>): void

  /**
   * Removes a key-value pair from the cache.
   */
  remove(key: SWRKey, options?: Partial<CacheRemoveOptions>): void

  /**
   * Removes all the key-value pairs from the cache.
   */
  clear(options?: Partial<CacheClearOptions>): void

  /**
   * Determines if the cache has a given key.
   */
  has(key: SWRKey): boolean

  /**
   * Subscribes to the given key for changes.
   */
  subscribe(key: SWRKey, listener: SWRListener): void

  /**
   * Unsubscribes to the given key events.
   */
  unsubscribe(key: SWRKey, listener: SWRListener): void

  /**
   * Broadcasts a value change to all subscribed instances.
   */
  broadcast<D>(key: SWRKey, detail: D): void
}

/**
 * Default cache implementation for vue-cache.
 */
export class DefaultCache implements SWRCache {
  /**
   * Stores the elements of the cache in a key-value pair.
   */
  private elements: Map<string, CacheItem> = new Map()

  /**
   * Stores the event target instance to dispatch and receive events.
   */
  private event: SWREventManager = new DefaultSWREventManager()

  /**
   * Resolves the promise and replaces the Promise to the resolved data.
   * It also broadcasts the value change if needed or deletes the key if
   * the value resolves to undefined or null.
   */
  private resolve<D>(key: SWRKey, value: CacheItem<D>) {
    Promise.resolve(value.data).then((detail) => {
      if (detail === undefined || detail === null) {
        // The value resolved to undefined, and we delete
        // it from the cache and don't broadcast any event.
        return this.remove(key)
      }
      // Update the value with the resolved one.
      value.data = detail
      // Broadcast the update to all other cache subscriptions.
      this.broadcast(key, detail)
    })
  }

  /**
   * Gets an element from the cache.
   *
   * It is assumed the item always exist when
   * you get it. Use the has method to check
   * for the existence of it.
   */
  get<D>(key: string): CacheItem<D> {
    return this.elements.get(key) as CacheItem<D>
  }

  /**
   * Sets an element to the cache.
   */
  set<D>(key: SWRKey, value: CacheItem<D>): void {
    this.elements.set(key, value)
    this.resolve(key, value)
  }

  /**
   * Removes an key-value pair from the cache.
   */
  remove(key: SWRKey, options?: Partial<CacheRemoveOptions>): void {
    const { broadcast }: CacheRemoveOptions = { ...defaultCacheRemoveOptions, ...options }
    if (broadcast) this.broadcast(key, undefined)
    this.elements.delete(key)
  }

  /**
   * Removes all the key-value pairs from the cache.
   */
  clear(options?: Partial<CacheClearOptions>): void {
    const { broadcast }: CacheClearOptions = { ...defaultCacheClearOptions, ...options }
    if (broadcast) for (const key of this.elements.keys()) this.broadcast(key, undefined)
    this.elements.clear()
  }

  /**
   * Determines if the given key exists
   * in the cache.
   */
  has(key: SWRKey): boolean {
    return this.elements.has(key)
  }

  /**
   * Subscribes the callback to the given key.
   */
  subscribe(key: SWRKey, listener: SWRListener): void {
    this.event.subscribe(key, listener)
  }

  /**
   * Unsubscribes to the given key events.
   */
  unsubscribe(key: SWRKey, listener: SWRListener): void {
    this.event.unsubscribe(key, listener)
  }

  /**
   * Broadcasts a value change  on all subscribed instances.
   */
  broadcast<D>(key: SWRKey, data: D) {
    this.event.emit(key, data)
  }
}
