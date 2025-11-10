import React from 'react'
import { createStore } from './vanilla.ts'
import type {
  ExtractState,
  Mutate,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
} from './vanilla.ts'

// 定义只读的 Store API 类型
// 只包含 getState、getInitialState 和 subscribe 方法
// 不包含 setState 方法，因为 React 组件不应该直接修改状态
type ReadonlyStoreApi<T> = Pick<
  StoreApi<T>,
  'getState' | 'getInitialState' | 'subscribe'
>

// 恒等函数，用于默认的选择器
const identity = <T>(arg: T): T => arg

// useStore Hook 的类型重载
// 第一个重载：不传入选择器，直接返回完整状态
export function useStore<S extends ReadonlyStoreApi<unknown>>(
  api: S,
): ExtractState<S>

// 第二个重载：传入选择器，返回选择后的状态片段
export function useStore<S extends ReadonlyStoreApi<unknown>, U>(
  api: S,
  selector: (state: ExtractState<S>) => U,
): U

export function useStore<TState, StateSlice>(
  api: ReadonlyStoreApi<TState>,
  selector: (state: TState) => StateSlice = identity as any,
) {
  const slice = React.useSyncExternalStore(
    api.subscribe,
    React.useCallback(() => selector(api.getState()), [api, selector]),
    React.useCallback(() => selector(api.getInitialState()), [api, selector]),
  )
  React.useDebugValue(slice)
  return slice
}

// UseBoundStore 类型定义了绑定到 store 的 Hook 类型
// 包含两个重载：
// 1. 不带选择器：返回完整状态
// 2. 带选择器：返回选择后的状态片段
// 同时继承原始 store 的所有方法
export type UseBoundStore<S extends ReadonlyStoreApi<unknown>> = {
  (): ExtractState<S>
  <U>(selector: (state: ExtractState<S>) => U): U
} & S

// Create 类型定义了创建 store 的函数类型
// 支持两种调用方式：
// 1. 直接传入初始化函数
// 2. 不带参数调用，返回一个接受初始化函数的函数
type Create = {
  <T, Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>,
  ): UseBoundStore<Mutate<StoreApi<T>, Mos>>
  <T>(): <Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>,
  ) => UseBoundStore<Mutate<StoreApi<T>, Mos>>
}


// useStore Hook 的实现
// 使用 React.useSyncExternalStore 实现外部状态订阅
export function useStore<TState, StateSlice>(
  api: ReadonlyStoreApi<TState>,
  selector: (state: TState) => StateSlice = identity as any,
) {
  // 使用 useSyncExternalStore 订阅外部状态
  // 第一个参数：订阅函数
  // 第二个参数：获取当前状态的函数
  // 第三个参数：获取初始状态的函数（用于服务端渲染）
  const slice = React.useSyncExternalStore(
    api.subscribe,
    () => selector(api.getState()),
    () => selector(api.getInitialState()),
  )
  // 使用 useDebugValue 在 React DevTools 中显示当前状态
  React.useDebugValue(slice)
  return slice
}

// createImpl 是实际的创建函数实现
const createImpl = <T>(createState: StateCreator<T, [], []>) => {
  // 使用 vanilla 的 createStore 创建基础 store
  const api = createStore(createState)

  // 创建绑定到 store 的 Hook
  // 支持可选的 selector 参数
  const useBoundStore: any = (selector?: any) => useStore(api, selector)

  // 将 store 的所有方法复制到 Hook 上
  // 这样可以直接通过 Hook 访问 store 的方法
  Object.assign(useBoundStore, api)

  return useBoundStore
}

// 导出 create 函数
// 支持两种调用方式：
// 1. 直接传入 createState：create(createState)
// 2. 不带参数：create()(createState)
export const create = (<T>(createState: StateCreator<T, [], []> | undefined) =>
  createState ? createImpl(createState) : createImpl) as Create
