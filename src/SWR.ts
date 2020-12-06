import { SWRCache, CacheItem, CacheClearOptions } from './cache'
import { SWRKey } from './key'
import {
  SWROptions,
  defaultOptions,
  SWRRevalidateOptions,
  defaultRevalidateOptions,
  SWRFetcher,
  SWRMutateOptions,
  defaultMutateOptions,
  defaultClearOptions,
} from './options'

/**
 * Determines how a function state value looks like.
 */
export type SWRFunctionStateValue<D> = (state: D | null) => D

/**
 * Determines how a SWR mutate value looks like.
 */
export type SWRMutateValue<D> = null | D | CacheItem<D | undefined> | SWRFunctionStateValue<D>

/**
 * Stale While Revalidate
 */
export class SWR {
  /**
   * Stores the options of the SWR.
   */
  options: SWROptions

  /**
   * Creates a new instance of SWR.
   */
  constructor(options?: Partial<SWROptions>) {
    this.options = { ...defaultOptions, ...options }
  }

  /**
   * Gets the cache of the SWR.
   */
  protected get cache(): SWRCache {
    return this.options.cache
  }

  /**
   * Gets the cache of the SWR.
   */
  protected get errors(): EventTarget {
    return this.options.errors
  }

  /**
   * Requests the data using the provided fetcher.
   */
  protected requestData<D>(key: SWRKey, fetcher: SWRFetcher<D>): Promise<D | undefined> {
    return fetcher(key).catch((detail) => {
      this.errors.dispatchEvent(new CustomEvent(key, { detail }))
      return undefined
    })
  }

  /**
   * Resolves the given to a SWRKey or undefined.
   */
  protected resolveKey(key: SWRKey | undefined | (() => SWRKey | undefined)): SWRKey | undefined {
    if (typeof key === 'function') {
      try {
        return key()
      } catch {
        return undefined
      }
    }
    return key
  }

  /**
   * Clear the specified keys from the cache. If no keys
   * are specified, it clears all the cache keys.
   */
  clear(keys?: SWRKey | SWRKey[] | null, options?: Partial<CacheClearOptions>) {
    const ops: CacheClearOptions = { ...defaultClearOptions, ...options }
    if (keys === undefined || keys === null) return this.cache.clear(ops)
    if (!Array.isArray(keys)) return this.cache.remove(keys, ops)
    for (const key of keys) this.cache.remove(key, ops)
  }

  /**
   * Revalidates the key and mutates the cache if needed.
   */
  revalidate<D>(key?: SWRKey, options?: Partial<SWRRevalidateOptions<D>>): void {
    // Avoid doing anything if the key resolved to undefined.
    if (!key) return

    // Resolves the options given the defaults.
    const { fetcher: defaultFetcher, dedupingInterval: defaultDedupingInterval } = this.options
    const { force, fetcher, dedupingInterval }: SWRRevalidateOptions<D> = {
      ...defaultRevalidateOptions,
      ...{ fetcher: defaultFetcher, dedupingInterval: defaultDedupingInterval },
      ...options,
    }

    // Stores the data to mutate (if any).
    let data: undefined | Promise<D | undefined> = undefined

    // Check the cache for the expiration.
    if (force || !this.cache.has(key) || (this.cache.has(key) && this.cache.get(key).hasExpired())) {
      // We have a forced fetch or there's an item in the
      // cache and it has expired, thus we need to refetch the data.
      data = this.requestData(key, fetcher)
    }

    // Don't mutate if the data is undefined. Keep in mind
    // this would still mutate values when Promise<undefined>
    // meaning the request has failed and the cache takes care of it.
    if (data !== undefined) {
      // CIRCULAR DEPENDENCY; PLEASE TAKE CARE IF YOU ARE WILLING TO MODIFY
      // THE FOLLOWING LINE. THE MUTATE METHOD MUST NEVER BE CALLED WITH
      // THE REVALIDATE = TRUE PARAMETER.
      this.mutate(key, new CacheItem({ data }).expiresIn(dedupingInterval), {
        revalidate: false,
      })
    }
  }

  /**
   * Mutates the data of a given key with a new value.
   * This is used to replace the cache contents of the
   * given key manually.
   */
  mutate<D>(key?: SWRKey, value?: SWRMutateValue<D>, options?: Partial<SWRMutateOptions>): void {
    // Avoid doing anything if the key resolved to undefined.
    if (!key) return

    // Get the configuration option of the mutate.
    const { revalidate: revalidateAfterMutation, revalidateOptions }: SWRMutateOptions = {
      ...defaultMutateOptions,
      ...options,
    }

    // Define the mutation data, this also resolves the previous
    // state if needed by the value (in case it's a function).
    let data: D | CacheItem<D | undefined> | null | undefined
    if (typeof value === 'function') {
      let state: D | null = null
      if (this.cache.has(key)) {
        const item = this.cache.get<D>(key)
        if (!item.isResolving()) state = item.data as D
      }
      data = (value as SWRFunctionStateValue<D>)(state)
    } else {
      data = value
    }

    // To mutate, we only need to change the value
    // of the cache, since all hooks are already subscribed
    // to cache changes on the respective key. Please note the
    // expiration time of this cache item is set to null, meaning
    // it will be expired by default and replaced by fresh data when possible.
    this.cache.set(key, data instanceof CacheItem ? data : new CacheItem({ data }))

    // Check if there's the need to re-validate the data.
    // CIRCULAR DEPENDENCY; PLEASE TAKE CARE IF YOU ARE WILLING TO MODIFY
    // THE FOLLOWING LINE. THE REVALIDATE METHOD MUST NEVER CALL MUTATE AGAIN
    // WITH THE REVALIDATE = TRUE PARAMETER.
    if (revalidateAfterMutation) this.revalidate(key, revalidateOptions)
  }

  /**
   * Gets the data of the given key. Keep in mind
   * this data will be stale and revalidate in the background
   * unless specified otherwise.
   */
  subscribe<D>(key: SWRKey | undefined, onData: (value: D) => any) {
    if (key) {
      const handler = ({ detail }: CustomEvent<D>) => onData(detail)
      this.cache.subscribe(key, handler)
      return () => this.cache.unsubscribe(key, handler)
    }
    return () => undefined
  }

  /**
   * Subscribes to errors on the given key.
   */
  subscribeErrors<E>(key: SWRKey | undefined, onError: (error: E) => any) {
    if (key) {
      const handler = ({ detail }: CustomEvent<E>) => onError(detail)
      this.errors.addEventListener(key, handler as EventListener)
      return () => this.errors.removeEventListener(key, handler as EventListener)
    }
    return () => undefined
  }

  /**
   * Helper to subscribe to visibility changes.
   */
  protected subscribeVisibility(handler: () => any, { throttleInterval = 5000, enabled = true } = {}) {
    if (enabled && typeof window !== 'undefined') {
      let lastFocus: number | null = null
      const rawHandler = () => {
        const now = Date.now()
        if (lastFocus === null || now - lastFocus > throttleInterval) {
          lastFocus = now
          handler()
        }
      }
      window.addEventListener('focus', rawHandler)
      return () => window.removeEventListener('focus', rawHandler)
    }
    return () => undefined
  }

  /**
   * Helper to subscribe to network changes.
   */
  protected subscribeNetwork(handler: () => any, { enabled = true } = {}) {
    if (enabled && typeof window !== 'undefined') {
      window.addEventListener('online', handler)
      return () => window.removeEventListener('online', handler)
    }
    return () => undefined
  }

  /**
   * Gets the current cached data of the given key.
   * This does not trigger any revalidation nor mutation
   * of the data.
   * - If the data has never been validated
   * (there is no cache) it will return undefined.
   * - If the item is pending to resolve (there is a request
   * pending to resolve) it will return undefined.
   */
  get<D = any>(key?: SWRKey): D | undefined {
    if (key && this.cache.has(key)) {
      const item = this.cache.get<D>(key)
      if (!item.isResolving()) return item.data as D
    }
    return undefined
  }

  /**
   * Gets an element from the cache. The difference
   * with the get is that this method returns a promise
   * that will resolve the the value. If there's no item
   * in the cache, it will wait for it before resolving.
   */
  getOrWait<D = any>(key: SWRKey): Promise<D> {
    return new Promise((resolve) => {
      // Resolve if we already got the data.
      const current = this.get(key)
      if (current) return resolve(current)
      // Subscribe to the cache and wait.
      const unsubcsribe = this.subscribe(key, (data: D) => {
        unsubcsribe()
        return resolve(data)
      })
    })
  }

  /**
   * Use a SWR value given the key and
   * subscribe to future changes.
   */
  use<D = any, E = Error>(
    key: SWRKey | undefined | (() => SWRKey | undefined),
    onData: (value: D) => void,
    onError: (error: E) => void,
    options?: Partial<SWROptions<D>>
  ) {
    // Configuration variables merged with the defaults.
    const {
      fetcher,
      initialData,
      loadInitialCache,
      revalidateOnStart,
      dedupingInterval,
      revalidateOnFocus,
      focusThrottleInterval,
      revalidateOnReconnect,
    }: SWROptions<D> = {
      // Current instance options
      // (includes default options)
      ...this.options,
      // Current call options.
      ...options,
    }

    // Mutates the current SWR key.
    const mutateCurrent = <D>(value?: SWRMutateValue<D>, options?: Partial<SWRMutateOptions>) => {
      return this.mutate(this.resolveKey(key), value, options)
    }

    // Revalidates the current SWR key.
    const revalidateCurrent = <D>(options?: Partial<SWRRevalidateOptions<D>>) => {
      return this.revalidate(this.resolveKey(key), options)
    }

    // Triggers a revalidation with the options of the hook call.
    const revalidateCurrentWithOptions = () => {
      return revalidateCurrent({ fetcher, dedupingInterval })
    }

    // Revalidate the component to fetch new data if needed.
    if (revalidateOnStart) revalidateCurrentWithOptions()

    // Subscribe for changes in data
    const unsubscribeData = this.subscribe<D>(this.resolveKey(key), onData)

    // Subscribe for changes in errors.
    const unsubscribeErrors = this.subscribeErrors<E>(this.resolveKey(key), onError)

    // Subscribe for visibility changes.
    const unsubscribeVisibility = this.subscribeVisibility(revalidateCurrentWithOptions, {
      throttleInterval: focusThrottleInterval,
      enabled: revalidateOnFocus,
    })

    // Subscribe for network changes.
    const unsubscribeNetwork = this.subscribeNetwork(revalidateCurrentWithOptions, {
      enabled: revalidateOnReconnect,
    })

    // Unsubscribe handler.
    const unsubscribe = () => {
      unsubscribeData()
      unsubscribeErrors()
      unsubscribeVisibility()
      unsubscribeNetwork()
    }

    // Populate the initial data from the cache.
    if (initialData) {
      mutateCurrent(initialData, { revalidate: false })
    }

    // Determine if there's some cache data we can work with meanwhile.
    if (loadInitialCache) {
      const cachedData = this.get<D>(this.resolveKey(key))
      if (cachedData) onData(cachedData)
    }

    return { unsubscribe }
  }
}
