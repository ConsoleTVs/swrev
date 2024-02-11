import { type CacheClearOptions, CacheItem, type CacheRemoveOptions, type SWRCache, defaultCacheClearOptions, defaultCacheRemoveOptions } from './cache'
import { type SWREventManager, DefaultSWREventManager, type SWRListener } from './events'
import type { SWRKey } from './key'

/**
 * Prefix of keys of cached items in localStorage.
 */
export const localStorageKeyPrefix = "swrev__"

/**
 * LocalStorage implementation of cache.
 * 
 * It persists items in memory and localStorage.
 */
export class LocalStorageCache implements SWRCache {
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
        const valueFromElements = this.elements.get(key) as CacheItem<D>
        if (valueFromElements) return valueFromElements
        else {
            const value = localStorage.getItem(localStorageKeyPrefix + key)
            return value ? new CacheItem(JSON.parse(value)) : valueFromElements
        }
    }

    /**
     * Sets an element to the cache.
     */
    async set<D>(key: SWRKey, value: CacheItem<D>): Promise<void> {
        this.elements.set(key, value)

        this.resolve(key, value)

        let data = value.data instanceof Promise ? await value.data.catch(() => undefined) : value.data
        localStorage.setItem(localStorageKeyPrefix + key, JSON.stringify({ ...value, data }))
    }

    /**
     * Removes an key-value pair from the cache.
     */
    remove(key: SWRKey, options?: Partial<CacheRemoveOptions>): void {
        const { broadcast }: CacheRemoveOptions = { ...defaultCacheRemoveOptions, ...options }
        if (broadcast) this.broadcast(key, undefined)
        this.elements.delete(key)

        localStorage.removeItem(localStorageKeyPrefix + key)
    }

    /**
     * Removes all the key-value pairs from the cache.
     */
    clear(options?: Partial<CacheClearOptions>): void {
        const { broadcast }: CacheClearOptions = { ...defaultCacheClearOptions, ...options }
        if (broadcast) for (const key of this.elements.keys()) this.broadcast(key, undefined)

        this.elements.clear()

        for (const key of Object.keys(localStorage)) {
            if (key.includes(localStorageKeyPrefix)) localStorage.removeItem(key)
        }
    }

    /**
     * Determines if the given key exists
     * in the cache.
     */
    has(key: SWRKey): boolean {
        return this.elements.has(key) ? true : localStorage.getItem(localStorageKeyPrefix + key) ? true : false
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
