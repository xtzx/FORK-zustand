import { create } from 'zustand'
import CodePreview from './components/CodePreview'
import Details from './components/Details'
import Scene from './components/Scene'



// 创建 Proxy 中间件
const proxy = (config) => (set, get, api) => {
  // 创建原始状态
  const initialState = config(
    (partial, replace) => {
      // 拦截 set 操作
      // 确保 $state 属性不会被修改掉
      const newState = typeof partial === 'function'
        ? partial(get())
        : partial

      // 如果是替换整个状态，需要保留 $state 引用
      if (replace) {
        set(
          { ...newState, $state: get().$state },
          true
        )
      } else {
        set(newState, false)
      }
    },
    get,
    api
  )

  // 初始状态
  const state = { ...initialState }

  // 创建代理处理器
  const handler = {
    get(target, prop) {
      return target[prop]
      // return get()[prop]
    },
    set(target, prop, value) {
      // 如果是特殊属性 $state，不允许修改
      if (prop === '$state') {
        console.warn('Cannot modify $state property directly')
        // return true
      }

      // 使用原始 set 方法更新状态
      set({ [prop]: value }, false)
      target[prop] = value
      return true
    },

  }

  // 创建状态的代理对象
  const stateProxy = new Proxy(state, handler)

  // 返回增强后的状态，包含 $state 引用
  return {
    ...initialState,
    $state: stateProxy
  }
}


const useStore = create(proxy((set) => {
  return {
    count: 1,
    // inc: () => set((state) => ({ count: state.count + 1 })),
  }
}))

function Counter() {
  const {count, $state} = useStore()

  return (
    <div className="counter">
      <span>{count}</span>
      <button onClick={() => {
        console.log(`before set,count 是${count}`)
        $state.count = count + 1;
        console.log(`after set,count 是${$state.count}`)
        console.log(`getState 函数中是${useStore.getState().count}`)
      }}>one up</button>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Scene />
      <div className="main">
        <div className="code">
          <div className="code-container">
            <CodePreview />
            <Counter />
          </div>
        </div>
        <Details />
      </div>
    </>
  )
}
