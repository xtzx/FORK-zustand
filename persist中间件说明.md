# Zustand Persist 中间件详解

## 简介

Zustand 的 `persist` 中间件提供了状态持久化功能，允许将状态保存到各种存储中（如 `localStorage`、`sessionStorage`、`AsyncStorage` 等），并在应用重新加载时恢复这些状态。这个中间件在以下场景特别有用：

- 保存用户偏好设置
- 实现离线功能
- 提高用户体验，避免用户在刷新页面后重新输入数据
- 减少对服务器的请求次数

## 核心概念

### 1. 存储接口

persist.ts 定义了几个关键接口：

```typescript
// 通用存储接口，适用于各种存储引擎
interface StateStorage {
  getItem: (name: string) => string | null | Promise<string | null>
  setItem: (name: string, value: string) => unknown | Promise<unknown>
  removeItem: (name: string) => unknown | Promise<unknown>
}

// 持久化存储的值结构
type StorageValue<S> = {
  state: S        // 存储的状态对象
  version?: number  // 状态的版本号，用于迁移
}

// 类型安全的持久化存储接口
interface PersistStorage<S> {
  getItem: (name: string) => StorageValue<S> | null | Promise<StorageValue<S> | null>
  setItem: (name: string, value: StorageValue<S>) => unknown | Promise<unknown>
  removeItem: (name: string) => unknown | Promise<unknown>
}
```

### 2. 辅助函数：createJSONStorage

这个函数将普通存储转换为支持 JSON 序列化的持久化存储：

```typescript
function createJSONStorage<S>(
  getStorage: () => StateStorage,
  options?: JsonStorageOptions,
): PersistStorage<S> | undefined {
  // ...实现细节
}
```

这使得我们可以轻松地将 `localStorage` 或 `sessionStorage` 转换为可用于持久化的存储。

### 3. 配置选项

中间件支持多种配置选项，可以自定义持久化行为：

```typescript
interface PersistOptions<S, PersistedState = S> {
  name: string                    // 存储项的名称，必须唯一
  storage?: PersistStorage<PersistedState> | undefined  // 自定义存储
  partialize?: (state: S) => PersistedState  // 筛选要持久化的状态
  onRehydrateStorage?: (state: S) => ((state?: S, error?: unknown) => void) | void  // 水合回调
  version?: number                // 状态版本号
  migrate?: (persistedState: unknown, version: number) => PersistedState | Promise<PersistedState>  // 状态迁移函数
  merge?: (persistedState: unknown, currentState: S) => S  // 自定义合并函数
  skipHydration?: boolean         // 是否跳过初始化时的水合
}
```

### 4. 状态水合（Hydration）

水合是指从存储中恢复状态并与当前状态合并的过程。中间件提供了以下水合相关功能：

- 自动水合：在初始化时自动从存储恢复状态
- 手动水合：通过 `rehydrate()` 方法手动触发水合
- 水合监听：通过 `onHydrate` 和 `onFinishHydration` 添加水合前后的监听器

## 实现原理

### 1. 中间件初始化

persist 中间件对 store 做了以下修改：

1. **重写 setState 方法**：每次状态更新后自动保存到存储
2. **扩展 store API**：添加 `persist` 对象，提供持久化相关方法
3. **初始水合**：从存储加载状态并与初始状态合并

### 2. 数据存储结构

持久化的数据结构如下：

```json
{
  "state": { /* 应用状态 */ },
  "version": 1  // 可选的版本号
}
```

### 3. 版本控制和迁移

当应用结构发生变化时，中间件提供了版本控制和迁移机制：

1. 设置 `version` 属性指定当前版本
2. 提供 `migrate` 函数处理版本不匹配的情况
3. 迁移后自动更新存储中的状态和版本号

### 4. 处理同步/异步存储

中间件使用 `toThenable` 函数统一处理同步和异步存储操作，确保在各种环境中都能正常工作。

## 使用示例

### 基本用法

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 创建持久化的 store
const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }),
    { name: 'counter-storage' }  // 存储名称
  )
)
```

### 高级配置

```typescript
const useStore = create(
  persist(
    (set) => ({
      profile: { name: '', email: '' },
      settings: { theme: 'light', notifications: true },
      updateProfile: (data) => set({ profile: data }),
      updateSettings: (data) => set({ settings: data }),
    }),
    {
      name: 'user-preferences',
      storage: createJSONStorage(() => sessionStorage),  // 使用 sessionStorage
      partialize: (state) => ({ settings: state.settings }),  // 只持久化设置
      version: 1,  // 版本号
      migrate: (persistedState, version) => {
        // 处理版本迁移
        if (version === 0) {
          return {
            settings: {
              ...(persistedState as any).settings,
              newSetting: true,
            }
          }
        }
        return persistedState as any
      },
    }
  )
)
```

### 与其他中间件组合

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

const useStore = create(
  devtools(
    persist(
      (set) => ({
        // store state and actions
      }),
      { name: 'store-storage' }
    )
  )
)
```

## 特色功能

1. **类型安全**：完全支持 TypeScript，提供类型检查和自动补全
2. **灵活的存储选择**：支持任何符合接口的存储引擎
3. **部分持久化**：通过 `partialize` 选项可以只持久化部分状态
4. **版本控制**：支持状态版本控制和迁移
5. **自定义合并策略**：通过 `merge` 选项可以自定义合并逻辑
6. **SSR支持**：通过 `skipHydration` 选项可以在服务器端渲染中使用

## 内部API扩展

persist 中间件向 store 添加了以下方法：

```typescript
store.persist.setOptions(options)  // 更新持久化选项
store.persist.clearStorage()       // 清除存储
store.persist.rehydrate()          // 手动触发重新水合
store.persist.hasHydrated()        // 检查是否已完成水合
store.persist.onHydrate(callback)  // 添加水合开始监听器
store.persist.onFinishHydration(callback)  // 添加水合结束监听器
store.persist.getOptions()         // 获取当前选项
```

## 性能考虑

- 使用 `partialize` 只持久化必要的状态，可以提高性能
- 对于大型状态，考虑使用防抖技术，不要在每次状态更改时都保存
- 考虑数据量和用户隐私，避免存储敏感信息或过大的数据量