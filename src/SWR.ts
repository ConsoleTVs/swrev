import { SWRCache, CacheItem, CacheClearOptions } from './cache'
import { SWREventManager } from './events'
import { SWRKey } from './key'
import {
  SWROptions,
  defaultOptions,
  SWRRevalidateOptions,
  SWRFetcher,
  SWRMutateOptions,
  defaultRevalidateOptions,
  defaultMutateOptions,
  defaultClearOptions,
} from './options'

/**
 * Determines how a function state value looks like.
 */
export type SWRFunctionStateValue<D> = (state: D | undefined) => D

/**
 * Determines how a SWR mutate value looks like.
 */
export type SWRMutateValue<D> = D | SWRFunctionStateValue<D>

/**
 * Stale While Revalidate
 */
export class SWR {
  /**
   * Stores the options of the SWR.
   */
  public options: SWROptions

  /**
   * Creates a new instance of SWR.
   */
  public constructor(options?: Partial<SWROptions>) {
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
  protected get errors(): SWREventManager {
    return this.options.errors
  }

  /**
   * Requests the data using the provided fetcher.
   */
  protected async requestData<D, E extends Error = Error>(key: SWRKey, fetcher: SWRFetcher<D>): Promise<D> {
    return await Promise.resolve(fetcher(key)).catch((reason: E) => {
      this.errors.emit(key, reason)
      throw reason
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
  public clear(keys?: SWRKey | SWRKey[] | null, options?: Partial<CacheClearOptions>) {
    const ops: CacheClearOptions = { ...defaultClearOptions, ...options }
    if (keys === undefined || keys === null) return this.cache.clear(ops)
    if (!Array.isArray(keys)) return this.cache.remove(keys, ops)
    for (const key of keys) this.cache.remove(key, ops)
  }

  /**
   * Revalidates the key and mutates the cache if needed.
   */
  public async revalidate<D = any>(key: SWRKey | undefined, options?: Partial<SWRRevalidateOptions<D>>): Promise<D> {
    // Avoid doing anything if the key resolved to undefined.
    if (!key) {
      throw new Error('[Revalidate] Key issue: ${key}')
    }

    // Resolves the options given the defaults.
    const { fetcher: defaultFetcher, dedupingInterval: defaultDedupingInterval } = this.options
    const { force, fetcher, dedupingInterval }: SWRRevalidateOptions<D> = {
      ...defaultRevalidateOptions,
      ...{ fetcher: defaultFetcher, dedupingInterval: defaultDedupingInterval },
      ...options,
    }

    // Check the cache for the expiration.
    if (force || !this.cache.has(key) || (this.cache.has(key) && this.cache.get(key).hasExpired())) {
      // We have a forced fetch or there's an item in the
      // cache and it has expired, thus we need to refetch the data.
      const data = this.requestData(key, fetcher)
      const safeData = data.catch(() => undefined)
      this.cache.set(key, new CacheItem({ data: safeData }).expiresIn(dedupingInterval))
      return await data
    }

    return this.getWait<D>(key)
  }

  /**
   * Mutates the data of a given key with a new value.
   * This is used to replace the cache contents of the
   * given key manually.
   */
  public async mutate<D = any>(
    key: SWRKey | undefined,
    value: SWRMutateValue<D>,
    options?: Partial<SWRMutateOptions<D>>
  ): Promise<D> {
    // Avoid doing anything if the key resolved to undefined.
    if (!key) {
      throw new Error('[Mutate] Key issue: ${key}')
    }

    // Get the configuration option of the mutate.
    const {
      revalidate: revalidateAfterMutation,
      revalidateOptions,
      revalidateFunction,
    }: SWRMutateOptions<D> = {
      ...defaultMutateOptions,
      ...options,
    }

    // Define the mutation data, this also resolves the previous
    // state if needed by the value (in case it's a function).
    let data: D
    if (typeof value === 'function') {
      let state: D | undefined = undefined
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
    this.cache.set(key, new CacheItem({ data }))

    // Check if there's the need to re-validate the data.
    return revalidateAfterMutation
      ? await (revalidateFunction?.(key, revalidateOptions) ?? this.revalidate(key, revalidateOptions))
      : data
  }

  /**
   * Gets the data of the given key. Keep in mind
   * this data will be stale and revalidate in the background
   * unless specified otherwise.
   */
  public subscribeData<D = any>(key: SWRKey | undefined, onData: (value: D) => any) {
    if (key) {
      const handler = (payload: D) => onData(payload)
      this.cache.subscribe(key, handler)
      return () => this.cache.unsubscribe(key, handler)
    }
    return () => {}
  }

  /**
   * Subscribes to errors on the given key.
   */
  public subscribeErrors<E = Error>(key: SWRKey | undefined, onError: (error: E) => any) {
    if (key) {
      const handler = (payload: E) => onError(payload)
      this.errors.subscribe(key, handler)
      return () => this.errors.unsubscribe(key, handler)
    }
    return () => {}
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
  public get<D = any>(key: SWRKey | undefined): D | undefined {
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
  public getWait<D = any, E = Error>(key: SWRKey | undefined): Promise<D> {
    return new Promise((resolve, reject) => {
      // Subscribe to the cache and wait.
      const unsubscribe = this.subscribeData(key, (data: D) => {
        unsubscribe()
        if (data !== undefined) return resolve(data)
      })
      // Subscribe to errors.
      const unsubscribeErrors = this.subscribeErrors(key, (error: E) => {
        unsubscribeErrors()
        if (error !== undefined) return reject(error)
      })
      // Resolve if we already got the data.
      const current = this.get<D>(key)
      if (current !== undefined) return resolve(current)
    })
  }

  /**
   * Use a SWR value given the key and
   * subscribe to future changes.
   */
  public subscribe<D = any, E = Error>(
    key: SWRKey | undefined | (() => SWRKey | undefined),
    onData?: (value: D) => void,
    onError?: (error: E) => void,
    options?: Partial<SWROptions<D>>
  ) {
    // Configuration variables merged with the defaults.
    const {
      fetcher,
      fallbackData,
      loadInitialCache,
      revalidateOnStart,
      dedupingInterval,
      revalidateOnFocus,
      focusThrottleInterval,
      revalidateOnReconnect,
      reconnectWhen,
      focusWhen,
      revalidateFunction,
    }: SWROptions<D> = {
      // Current instance options
      // (includes default options)
      ...this.options,
      // Current call options.
      ...options,
    }

    // Revalidates the current SWR key.
    const revalidateCurrent = (options?: Partial<SWRRevalidateOptions<D>>) => {
      return revalidateFunction?.(this.resolveKey(key), options) ?? this.revalidate(this.resolveKey(key), options)
    }

    // Triggers a revalidation with the options of the hook call.
    const revalidateCurrentWithOptions = () => {
      return revalidateCurrent({ fetcher, dedupingInterval })
    }

    const cachedData = loadInitialCache ? this.get<D>(this.resolveKey(key)) : fallbackData ?? undefined
    const revalidatePromise = revalidateOnStart ? revalidateCurrentWithOptions() : Promise.resolve(undefined)
    const dataPromise = cachedData ? Promise.resolve(cachedData) : revalidatePromise

    // Broadcast the data in case it isn't undefined.
    // It will be undefined if:
    // 1. Data not yet on cache
    // 2. loadInitialCache = false
    if (cachedData) onData?.(cachedData)

    // Subscribe for changes in data
    const unsubscribeData = onData ? this.subscribeData<D>(this.resolveKey(key), onData) : undefined

    // Subscribe for changes in errors.
    const unsubscribeErrors = onError ? this.subscribeErrors<E>(this.resolveKey(key), onError) : undefined

    // Subscribe for visibility changes.
    const unsubscribeVisibility = focusWhen(revalidateCurrentWithOptions, {
      throttleInterval: focusThrottleInterval,
      enabled: revalidateOnFocus,
    })

    // Subscribe for network changes.
    const unsubscribeNetwork = reconnectWhen(revalidateCurrentWithOptions, {
      enabled: revalidateOnReconnect,
    })

    // Unsubscribe handler.
    const unsubscribe = () => {
      unsubscribeData?.()
      unsubscribeErrors?.()
      unsubscribeVisibility?.()
      unsubscribeNetwork?.()
    }

    return { unsubscribe, dataPromise, revalidatePromise }
  }
}
