import { DefaultCache, SWRCache, CacheClearOptions } from './cache'
import { SWREventManager, DefaultSWREventManager } from './events'
import { SWRKey } from './key'

/**
 * Determines the network options.
 */
export interface NetworkOptions {
  enabled: boolean
}

/**
 * Determines the network options.
 */
export interface VisibilityOptions {
  enabled: boolean
  throttleInterval: number
}

/**
 * Determines the type of the fetcher.
 */
export type SWRFetcher<D = any> = (...props: any[]) => Promise<D> | D

/**
 * Determines the revalidation function to use.
 */
export type SWRRevalidateFunction<D = any> = (
  key?: string | undefined,
  options?: Partial<SWRRevalidateOptions<D>> | undefined
) => Promise<D | undefined>

/**
 * Determines the options available for the SWR configuration.
 */
export interface SWROptions<D = any> {
  /**
   * Determines the cache to use for SWR.
   */
  cache: SWRCache

  /**
   * Determines the error event target where
   * the errors will be dispatched.
   */
  errors: SWREventManager

  /**
   * Determines the fetcher function to use.
   */
  fetcher: SWRFetcher<D>

  /**
   * Represents the fallback data to use instead of undefined.
   * Keep in mind SWR will still attempt to re-validate
   * unless `revalidateOnStart` is set false.
   */
  fallbackData: D | undefined

  /**
   * Determines if we should attempt to load the
   * initial data from the cache. If this fails, we'll show
   * the `fallbackData`.
   */
  loadInitialCache: boolean

  /**
   * Determines if SWR should perform a revalidation when
   * it's called.
   */
  revalidateOnStart: boolean

  /**
   * Determines the dedupling interval.
   * This interval represents the time SWR will
   * avoid to perform a request if the last one was
   * made before `dedupingInterval` ago.
   */
  dedupingInterval: number

  /**
   * Revalidates the data when the window re-gains focus.
   */
  revalidateOnFocus: boolean

  /**
   * Interval throttle for the focus event.
   * This will ignore focus re-validation if it
   * happened last time `focusThrottleInterval` ago.
   */
  focusThrottleInterval: number

  /**
   * Revalidates the data when a network connect change
   * is detected (basically the browser / app comes back online).
   */
  revalidateOnReconnect: boolean

  /**
   * You can use this function to manually call
   * the notify callback when the application has
   * reconnected. You can also return a function
   * that will be called as a cleanup.
   */
  reconnectWhen: (notify: () => void, options: NetworkOptions) => void | (() => void)

  /**
   * You can use this function to manually call
   * the notify callback when the application has
   * gained focus. You can also return a function
   * that will be called as a cleanup.
   */
  focusWhen: (notify: () => void, options: VisibilityOptions) => void | (() => void)

  /**
   * The revalidation function to use. If not specified,
   * it will use the default revalidation with the `revalidateOptions`.
   */
  revalidateFunction: SWRRevalidateFunction<D> | undefined
}

/**
 * Stores the default SWR options.
 */
export const defaultOptions: SWROptions = {
  cache: new DefaultCache(),
  errors: new DefaultSWREventManager(),
  fetcher: async <D>(url: SWRKey): Promise<D> => {
    const response = await fetch(url)
    if (!response.ok) throw Error('Not a 2XX response.')
    return response.json()
  },
  fallbackData: undefined,
  loadInitialCache: true,
  revalidateOnStart: true,
  dedupingInterval: 2000,
  revalidateOnFocus: true,
  focusThrottleInterval: 5000,
  revalidateOnReconnect: true,
  reconnectWhen: (notify: () => void, { enabled }) => {
    if (enabled && typeof window !== 'undefined') {
      window.addEventListener('online', notify)
      return () => window.removeEventListener('online', notify)
    }
    return () => {}
  },
  focusWhen: (notify: () => void, { enabled, throttleInterval }) => {
    if (enabled && typeof window !== 'undefined') {
      let lastFocus: number | null = null
      const rawHandler = () => {
        const now = Date.now()
        if (lastFocus === null || now - lastFocus > throttleInterval) {
          lastFocus = now
          notify()
        }
      }
      window.addEventListener('focus', rawHandler)
      return () => window.removeEventListener('focus', rawHandler)
    }
    return () => {}
  },
  revalidateFunction: undefined,
}

/**
 * Determines how the revalidation options look like.
 */
export interface SWRRevalidateOptions<D = any> extends Pick<SWROptions<D>, 'fetcher' | 'dedupingInterval'> {
  /**
   * Determines if the re-validation should be forced.
   * When a re-validation is forced, the dedupingInterval
   * will be ignored and a fetch will be performed.
   */
  force: boolean
}

/**
 * Default values for the revalidate options.
 */
export const defaultRevalidateOptions: SWRRevalidateOptions = {
  ...defaultOptions,
  force: false,
}

/**
 * Mutation options.
 */
export interface SWRMutateOptions<D = any> {
  /**
   * Determines if the mutation should attempt to revalidate the data afterwards.
   */
  revalidate: boolean

  /**
   * Determines the revalidation options passed to revalidate in case
   * the parameter `revalidate` is set to true.
   */
  revalidateOptions: Partial<SWRRevalidateOptions<D>>

  /**
   * The revalidation function to use. If not specified,
   * it will use the default revalidation with the `revalidateOptions`.
   */
  revalidateFunction: SWRRevalidateFunction<D> | undefined
}

/**
 * Default values for the mutate options.
 */
export const defaultMutateOptions: SWRMutateOptions = {
  revalidate: true,
  revalidateOptions: { ...defaultRevalidateOptions },
  revalidateFunction: undefined,
}

/**
 * Default cache clear options.
 */
export const defaultClearOptions: CacheClearOptions = {
  broadcast: false,
}
