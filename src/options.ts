import { DefaultCache, SWRCache, CacheClearOptions } from './cache'
import { EventTarget } from './eventTarget'
import { SWRKey } from './key'

/**
 * Determines the type of the fetcher.
 */
export type SWRFetcher<D = any> = (...props: any[]) => Promise<D>

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
  errors: EventTarget

  /**
   * Determines the fetcher function to use.
   */
  fetcher: SWRFetcher<D>

  /**
   * Represents the initial data to use instead of undefined.
   * Keep in mind SWR will still attempt to re-validate
   * unless `revalidateOnStart` is set false.
   */
  initialData: D

  /**
   * Determines if we should attempt to load the
   * initial data from the cache in case initialData is undefined.
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
}

/**
 * Default fetcher function. Keep in mind it requires fetch() API.
 */
const fetcher = <D>(url: SWRKey): Promise<D> => {
  return fetch(url).then((res) => {
    if (!res.ok) throw Error('Not a 2XX response.')
    return res.json()
  })
}

/**
 * Stores the default SWR options.
 */
export const defaultOptions: SWROptions = {
  cache: new DefaultCache(),
  errors: new EventTarget(),
  fetcher,
  initialData: undefined,
  loadInitialCache: true,
  revalidateOnStart: true,
  dedupingInterval: 2000,
  revalidateOnFocus: true,
  focusThrottleInterval: 5000,
  revalidateOnReconnect: true,
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
}

/**
 * Default values for the mutate options.
 */
export const defaultMutateOptions: SWRMutateOptions = {
  revalidate: true,
  revalidateOptions: { ...defaultRevalidateOptions },
}

/**
 * Default cache clear options.
 */
export const defaultClearOptions: CacheClearOptions = {
  broadcast: false,
}
