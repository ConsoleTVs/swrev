import EventTarget$1 from '@ungap/event-target';

/**
 * Determines the type of the SWR keys.
 */
declare type SWRKey = string;

/**
 * Default cache removal options.
 */
declare const defaultCacheRemoveOptions: CacheRemoveOptions;
/**
 * Default cache clear options.
 */
declare const defaultCacheClearOptions: CacheClearOptions;
/**
 * Determines how a cache item data looks like.
 */
interface CacheItemData<D> {
    /**
     * Determines the data that's stored in the cache.
     */
    data: D | Promise<D>;
    /**
     * Determines the expiration date for the given set of data.
     */
    expiresAt?: Date | null;
}
/**
 * Determines the type of the cache items.
 */
declare class CacheItem<D = unknown> {
    /**
     * Determines the data that's stored in the cache.
     */
    data: D | Promise<D>;
    /**
     * Determines the expiration date for the given set of data.
     */
    expiresAt: Date | null;
    /**
     * Creates the cache item given the data and expiration at.
     */
    constructor({ data, expiresAt }: CacheItemData<D>);
    /**
     * Determines if the current cache item is still being resolved.
     * This returns true if data is a promise, or false if type `D`.
     */
    isResolving(): boolean;
    /**
     * Determines if the given cache item has expired.
     */
    hasExpired(): boolean;
    /**
     * Set the expiration time of the given cache item relative to now.
     */
    expiresIn(milliseconds: number): this;
}
/**
 * Determines the cache item removal options.
 */
interface CacheRemoveOptions {
    /**
     * Determines if the cache should broadcast the cache
     * change to subscribed handlers. That means telling them
     * the value now resolves to undefined.
     */
    broadcast: boolean;
}
/**
 * Determines the cache clear options.
 */
interface CacheClearOptions extends CacheRemoveOptions {
}
/**
 * Represents the methods a cache should implement
 * in order to be usable by vue-swr.
 */
interface SWRCache {
    /**
     * Gets an item from the cache.
     */
    get<D>(key: SWRKey): CacheItem<D>;
    /**
     * Sets an item to the cache.
     */
    set<D>(key: SWRKey, value: CacheItem<D>): void;
    /**
     * Removes a key-value pair from the cache.
     */
    remove(key: SWRKey, options?: Partial<CacheRemoveOptions>): void;
    /**
     * Removes all the key-value pairs from the cache.
     */
    clear(options?: Partial<CacheClearOptions>): void;
    /**
     * Determines if the cache has a given key.
     */
    has(key: SWRKey): boolean;
    /**
     * Subscribes to the given key for changes.
     */
    subscribe<D>(key: SWRKey, callback: (event: CustomEvent<D>) => void): void;
    /**
     * Unsubscribes to the given key events.
     */
    unsubscribe<D>(key: SWRKey, callback: (event: CustomEvent<D>) => void): void;
    /**
     * Broadcasts a value change to all subscribed instances.
     */
    broadcast<D>(key: SWRKey, detail: D): void;
}
/**
 * Default cache implementation for vue-cache.
 */
declare class DefaultCache implements SWRCache {
    /**
     * Stores the elements of the cache in a key-value pair.
     */
    private elements;
    /**
     * Stores the event target instance to dispatch and receive events.
     */
    private event;
    /**
     * Resolves the promise and replaces the Promise to the resolved data.
     * It also broadcasts the value change if needed or deletes the key if
     * the value resolves to undefined or null.
     */
    private resolve;
    /**
     * Gets an element from the cache.
     *
     * It is assumed the item always exist when
     * you get it. Use the has method to check
     * for the existence of it.
     */
    get<D>(key: string): CacheItem<D>;
    /**
     * Sets an element to the cache.
     */
    set<D>(key: SWRKey, value: CacheItem<D>): void;
    /**
     * Removes an key-value pair from the cache.
     */
    remove(key: SWRKey, options?: Partial<CacheRemoveOptions>): void;
    /**
     * Removes all the key-value pairs from the cache.
     */
    clear(options?: Partial<CacheClearOptions>): void;
    /**
     * Determines if the given key exists
     * in the cache.
     */
    has(key: SWRKey): boolean;
    /**
     * Subscribes the callback to the given key.
     */
    subscribe<D>(key: SWRKey, callback: (event: CustomEvent<D>) => void): void;
    /**
     * Unsubscribes to the given key events.
     */
    unsubscribe<D>(key: SWRKey, callback: (event: CustomEvent<D>) => void): void;
    /**
     * Broadcasts a value change  on all subscribed instances.
     */
    broadcast<D>(key: SWRKey, detail: D): void;
}

/**
 * Determines the type of the fetcher.
 */
declare type SWRFetcher<D = any> = (...props: any[]) => Promise<D>;
/**
 * Determines the options available for the SWR configuration.
 */
interface SWROptions<D = any> {
    /**
     * Determines the cache to use for SWR.
     */
    cache: SWRCache;
    /**
     * Determines the error event target where
     * the errors will be dispatched.
     */
    errors: EventTarget$1;
    /**
     * Determines the fetcher function to use.
     */
    fetcher: SWRFetcher<D>;
    /**
     * Represents the initial data to use instead of undefined.
     * Keep in mind SWR will still attempt to re-validate
     * unless `revalidateOnStart` is set false.
     */
    initialData: D;
    /**
     * Determines if we should attempt to load the
     * initial data from the cache in case initialData is undefined.
     */
    loadInitialCache: boolean;
    /**
     * Determines if SWR should perform a revalidation when
     * it's called.
     */
    revalidateOnStart: boolean;
    /**
     * Determines the dedupling interval.
     * This interval represents the time SWR will
     * avoid to perform a request if the last one was
     * made before `dedupingInterval` ago.
     */
    dedupingInterval: number;
    /**
     * Revalidates the data when the window re-gains focus.
     */
    revalidateOnFocus: boolean;
    /**
     * Interval throttle for the focus event.
     * This will ignore focus re-validation if it
     * happened last time `focusThrottleInterval` ago.
     */
    focusThrottleInterval: number;
    /**
     * Revalidates the data when a network connect change
     * is detected (basically the browser / app comes back online).
     */
    revalidateOnReconnect: boolean;
}
/**
 * Stores the default SWR options.
 */
declare const defaultOptions: SWROptions;
/**
 * Determines how the revalidation options look like.
 */
interface SWRRevalidateOptions<D = any> extends Pick<SWROptions<D>, 'fetcher' | 'dedupingInterval'> {
    /**
     * Determines if the re-validation should be forced.
     * When a re-validation is forced, the dedupingInterval
     * will be ignored and a fetch will be performed.
     */
    force: boolean;
}
/**
 * Default values for the revalidate options.
 */
declare const defaultRevalidateOptions: SWRRevalidateOptions;
/**
 * Mutation options.
 */
interface SWRMutateOptions<D = any> {
    /**
     * Determines if the mutation should attempt to revalidate the data afterwards.
     */
    revalidate: boolean;
    /**
     * Determines the revalidation options passed to revalidate in case
     * the parameter `revalidate` is set to true.
     */
    revalidateOptions: Partial<SWRRevalidateOptions<D>>;
}
/**
 * Default values for the mutate options.
 */
declare const defaultMutateOptions: SWRMutateOptions;
/**
 * Default cache clear options.
 */
declare const defaultClearOptions: CacheClearOptions;

/**
 * Determines how a function state value looks like.
 */
declare type SWRFunctionStateValue<D> = (state: D | null) => D;
/**
 * Determines how a SWR mutate value looks like.
 */
declare type SWRMutateValue<D> = null | D | CacheItem<D | undefined> | SWRFunctionStateValue<D>;
/**
 * Stale While Revalidate
 */
declare class SWR {
    /**
     * Stores the options of the SWR.
     */
    options: SWROptions;
    /**
     * Creates a new instance of SWR.
     */
    constructor(options?: Partial<SWROptions>);
    /**
     * Gets the cache of the SWR.
     */
    protected get cache(): SWRCache;
    /**
     * Gets the cache of the SWR.
     */
    protected get errors(): EventTarget;
    /**
     * Requests the data using the provided fetcher.
     */
    protected requestData<D>(key: SWRKey, fetcher: SWRFetcher<D>): Promise<D | undefined>;
    /**
     * Resolves the given to a SWRKey or undefined.
     */
    protected resolveKey(key: SWRKey | undefined | (() => SWRKey | undefined)): SWRKey | undefined;
    /**
     * Clear the specified keys from the cache. If no keys
     * are specified, it clears all the cache keys.
     */
    clear(keys?: SWRKey | SWRKey[] | null, options?: Partial<CacheClearOptions>): void;
    /**
     * Revalidates the key and mutates the cache if needed.
     */
    revalidate<D>(key?: SWRKey, options?: Partial<SWRRevalidateOptions<D>>): void;
    /**
     * Mutates the data of a given key with a new value.
     * This is used to replace the cache contents of the
     * given key manually.
     */
    mutate<D>(key?: SWRKey, value?: SWRMutateValue<D>, options?: Partial<SWRMutateOptions>): void;
    /**
     * Gets the data of the given key. Keep in mind
     * this data will be stale and revalidate in the background
     * unless specified otherwise.
     */
    subscribe<D>(key: SWRKey | undefined, onData: (value: D) => any): () => void;
    /**
     * Subscribes to errors on the given key.
     */
    subscribeErrors<E>(key: SWRKey | undefined, onError: (error: E) => any): () => void;
    /**
     * Helper to subscribe to visibility changes.
     */
    subscribeVisibility(handler: () => any, { throttleInterval, enabled }?: {
        throttleInterval?: number | undefined;
        enabled?: boolean | undefined;
    }): () => void;
    /**
     * Helper to subscribe to network changes.
     */
    subscribeNetwork(handler: () => any, { enabled }?: {
        enabled?: boolean | undefined;
    }): () => void;
    /**
     * Gets the current cached data of the given key.
     * This does not trigger any revalidation nor mutation
     * of the data.
     * - If the data has never been validated
     * (there is no cache) it will return undefined.
     * - If the item is pending to resolve (there is a request
     * pending to resolve) it will return undefined.
     */
    get<D = any>(key?: SWRKey): D | undefined;
    /**
     * Use a SWR value given the key and
     * subscribe to future changes.
     */
    use<D = any, E = Error>(key: SWRKey | undefined | (() => SWRKey | undefined), onData: (value: D) => void, onError: (error: E) => void, options?: Partial<SWROptions<D>>): {
        unsubscribe: () => void;
    };
}

export { CacheClearOptions, CacheItem, CacheItemData, CacheRemoveOptions, DefaultCache, SWR, SWRCache, SWRFetcher, SWRFunctionStateValue, SWRKey, SWRMutateOptions, SWRMutateValue, SWROptions, SWRRevalidateOptions, defaultCacheClearOptions, defaultCacheRemoveOptions, defaultClearOptions, defaultMutateOptions, defaultOptions, defaultRevalidateOptions };
