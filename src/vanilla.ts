// SetStateInternal 定义了内部的 setState 函数类型，通过复杂的交叉类型支持多种调用方式
// 使用 { _ }['_'] 语法技巧来合并不同的函数签名
type SetStateInternal<T> = {
  // 第一种调用方式：接受部分状态对象或更新函数，并可选是否完全替换（默认否）
  _(
    partial: T | Partial<T> | { _(state: T): T | Partial<T> }['_'],
    replace?: false,
  ): void
  // 第二种调用方式：完全替换状态
  _(state: T | { _(state: T): T }['_'], replace: true): void
}['_']

// StoreApi 是 store 的核心接口，定义了四个基本操作方法
export interface StoreApi<T> {
  setState: SetStateInternal<T>       // 更新状态
  getState: () => T                   // 获取当前状态
  getInitialState: () => T            // 获取初始状态
  subscribe: (listener: (state: T, prevState: T) => void) => () => void  // 订阅状态变化
}

// 工具类型：从 store 类型中提取出状态类型
// 例如：如果 S 是 StoreApi<User>，则 ExtractState<S> 是 User
export type ExtractState<S> = S extends { getState: () => infer T } ? T : never

// 工具类型：从对象 T 中获取键 K 的值类型，如果不存在则返回 F
type Get<T, K, F> = K extends keyof T ? T[K] : F

// Mutate 是一个递归类型，用于处理中间件链
// 它会按顺序应用所有中间件对 store 的修改
export type Mutate<S, Ms> = number extends Ms['length' & keyof Ms]
  ? S  // 如果 Ms 长度不确定，返回原始 S
  : Ms extends []
    ? S  // 如果 Ms 为空数组，返回原始 S
    : Ms extends [[infer Mi, infer Ma], ...infer Mrs]  // 解构第一个中间件及剩余中间件
      ? Mutate<StoreMutators<S, Ma>[Mi & StoreMutatorIdentifier], Mrs>  // 递归应用中间件
      : never

// StateCreator 是创建 store 状态的函数类型
// T: 状态类型
// Mis: 输入中间件列表
// Mos: 输出中间件列表
// U: 返回类型
export type StateCreator<
  T,
  Mis extends [StoreMutatorIdentifier, unknown][] = [],
  Mos extends [StoreMutatorIdentifier, unknown][] = [],
  U = T,
> = ((
  // 这些参数已经被输入中间件修改过
  setState: Get<Mutate<StoreApi<T>, Mis>, 'setState', never>,
  getState: Get<Mutate<StoreApi<T>, Mis>, 'getState', never>,
  store: Mutate<StoreApi<T>, Mis>,
) => U) & { $$storeMutators?: Mos }  // 元数据：标记输出中间件

// StoreMutators 是中间件扩展点，是一个空接口
// 每个中间件通过模块声明合并扩展这个接口
export interface StoreMutators<S, A> {}

// 中间件标识符类型
export type StoreMutatorIdentifier = keyof StoreMutators<unknown, unknown>

// CreateStore 定义了两种调用方式：
// 1. 直接传入初始化函数，返回 store
// 2. 不传参数，返回一个接受初始化函数的函数
type CreateStore = {
  <T, Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>,
  ): Mutate<StoreApi<T>, Mos>

  <T>(): <Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>,
  ) => Mutate<StoreApi<T>, Mos>
}

// CreateStoreImpl 是实际实现的类型
type CreateStoreImpl = <
  T,
  Mos extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, [], Mos>,
) => Mutate<StoreApi<T>, Mos>

// createStoreImpl 是核心实现函数
// 它接收一个状态创建函数，返回 store API
const createStoreImpl: CreateStoreImpl = (createState) => {
  // 通过 createState 函数的返回类型推断状态类型
  type TState = ReturnType<typeof createState>
  // 定义监听器函数类型
  type Listener = (state: TState, prevState: TState) => void
  // 内部状态变量
  let state: TState
  // 使用 Set 存储所有监听器，确保唯一性
  const listeners: Set<Listener> = new Set()

  /**
   * setState 方法的底层实现
   * @param {*} partial 用户传入的更新函数或者值,如果是函数就是 partial(state) 获得新的 state
   * @param {*} replace 是否完全替换状态,默认是 false,即合并状态,来自用户传入的参数
   */
  const setState: StoreApi<TState>['setState'] = (partial, replace) => {
    // 根据 partial 类型计算下一个状态
    // 如果是函数，则调用它并传入当前状态
    // 否则直接使用对象值
    const nextState =
      typeof partial === 'function'
        ? (partial as (state: TState) => TState)(state)
        : partial

    // TODO:可以加一层浅比较
    if (!Object.is(nextState, state)) {
      // 保存当前状态用于通知监听器
      const previousState = state

      // 更新状态：
      // - 如果 replace 为 true，或 nextState 不是对象，或 nextState 为 null，则直接替换
      // - 否则，使用 Object.assign 合并新旧状态
      // 使用 Object.assign 可以避免原有的 state对象被修改,保证 getInitialState 返回的初始状态不变
      state =
        (replace ?? (typeof nextState !== 'object' || nextState === null))
          ? (nextState as TState)
          : Object.assign({}, state, nextState)

      // 通知所有监听器状态已更新 参数是当前状态和上一次状态
      // 此处是所有 state 变动都会通知更新,利用 useSyncExternalStore 自带的优化 TODO:可以修改一下 useStore 做更好
      listeners.forEach((listener) => listener(state, previousState))
    }
  }

  // 实现 getState 方法：返回当前状态
  const getState: StoreApi<TState>['getState'] = () => state

  // 实现 getInitialState 方法：返回初始状态
  const getInitialState: StoreApi<TState>['getInitialState'] = () =>
    initialState

  // 实现 subscribe 方法：添加监听器并返回取消订阅函数
  const subscribe: StoreApi<TState>['subscribe'] = (listener) => {
    // 将监听器添加到集合
    listeners.add(listener)
    // 返回取消订阅函数
    return () => listeners.delete(listener)
  }

  // 创建 API 对象，包含所有方法
  const api = { setState, getState, getInitialState, subscribe }

  // 调用创建状态函数，初始化状态
  // 注意这里的循环引用：api 传给 createState，createState 返回初始状态
  const initialState = (state = createState(setState, getState, api))

  // 返回 API 对象
  // 使用 as any 是因为中间件可能扩展了 API 类型
  return api as any
}

// 导出 createStore 函数
// 支持两种调用方式：带参数和不带参数
export const createStore = ((createState) =>
  createState ? createStoreImpl(createState) : createStoreImpl) as CreateStore
