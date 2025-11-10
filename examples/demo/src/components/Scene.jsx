// 导入 Three.js 核心组件
import { Mesh, PlaneGeometry, Group, Vector3, MathUtils } from 'three'
import { useRef, useState, useLayoutEffect } from 'react'
import { createRoot, events, extend, useFrame } from '@react-three/fiber'
// 导入 React Three Fiber 的辅助组件
import { Plane, useAspect, useTexture } from '@react-three/drei'
// 导入后期处理效果组件
import {
  EffectComposer,
  DepthOfField,
  Vignette,
} from '@react-three/postprocessing'
import { MaskFunction } from 'postprocessing'
// 导入自定义组件和资源
import Fireflies from './Fireflies'
import bgUrl from '../resources/bg.jpg'
import starsUrl from '../resources/stars.png'
import groundUrl from '../resources/ground.png'
import bearUrl from '../resources/bear.png'
import leaves1Url from '../resources/leaves1.png'
import leaves2Url from '../resources/leaves2.png'
import '../materials/layerMaterial'

// 主要场景组件，负责渲染 3D 场景
function Experience() {
  // 计算不同层的宽高比，用于适配不同屏幕尺寸
  const scaleN = useAspect(1600, 1000, 1.05)  // 用于熊层
  const scaleW = useAspect(2200, 1000, 1.05)  // 用于其他层

  // 加载所有纹理图片
  const textures = useTexture([
    bgUrl,      // 背景
    starsUrl,   // 星星
    groundUrl,  // 地面
    bearUrl,    // 熊
    leaves1Url, // 树叶1
    leaves2Url, // 树叶2
  ])

  // 创建引用，用于访问和操作 3D 对象
  const group = useRef()        // 整个场景组的引用
  const layersRef = useRef([])  // 所有层的引用数组

  // 创建向量状态，用于处理动画和移动
  const [movement] = useState(() => new Vector3())  // 当前移动向量
  const [temp] = useState(() => new Vector3())      // 临时向量，用于计算

  // 定义场景中各层的配置
  const layers = [
    // 背景层：最底层，z=0
    { texture: textures[0], x: 0, y: 0, z: 0, factor: 0.005, scale: scaleW },
    // 星星层：z=10，有视差效果
    { texture: textures[1], x: 0, y: 0, z: 10, factor: 0.005, scale: scaleW },
    // 地面层：z=20
    { texture: textures[2], x: 0, y: 0, z: 20, scale: scaleW },
    // 熊层：z=30，使用不同的缩放比例
    {
      texture: textures[3],
      x: 0,
      y: 0,
      z: 30,
      scaleFactor: 0.83,
      scale: scaleN,
    },
    // 树叶层1：z=40，有摆动效果
    {
      texture: textures[4],
      x: 0,
      y: 0,
      z: 40,
      factor: 0.03,
      scaleFactor: 1,
      wiggle: 0.6,
      scale: scaleW,
    },
    // 树叶层2：z=49，有更强的摆动效果
    {
      texture: textures[5],
      x: -20,
      y: -20,
      z: 49,
      factor: 0.04,
      scaleFactor: 1.3,
      wiggle: 1,
      scale: scaleW,
    },
  ]

  // 动画帧更新函数
  useFrame((state, delta) => {
    // 平滑插值移动向量
    movement.lerp(temp.set(state.pointer.x, state.pointer.y * 0.2, 0), 0.2)

    // 更新场景组的位置和旋转，实现视差效果
    group.current.position.x = MathUtils.lerp(
      group.current.position.x,
      state.pointer.x * 20,
      0.05,
    )
    group.current.rotation.x = MathUtils.lerp(
      group.current.rotation.x,
      state.pointer.y / 20,
      0.05,
    )
    group.current.rotation.y = MathUtils.lerp(
      group.current.rotation.y,
      -state.pointer.x / 2,
      0.05,
    )

    // 更新树叶层的动画时间
    layersRef.current[4].uniforms.time.value =
      layersRef.current[5].uniforms.time.value += delta
  }, 1)

  return (
    <group ref={group}>
      {/* 添加萤火虫粒子效果 */}
      <Fireflies count={20} radius={80} colors={['orange']} />
      {/* 渲染所有层 */}
      {layers.map(
        (
          {
            scale,
            texture,
            ref,
            factor = 0,
            scaleFactor = 1,
            wiggle = 0,
            x,
            y,
            z,
          },
          i,
        ) => (
          <Plane
            scale={scale}
            args={[1, 1, wiggle ? 10 : 1, wiggle ? 10 : 1]}  // 如果层有摆动效果，增加细分
            position={[x, y, z]}
            key={i}
            ref={ref}
          >
            <layerMaterial
              movement={movement}
              textr={texture}
              factor={factor}
              ref={(el) => (layersRef.current[i] = el)}
              wiggle={wiggle}
              scale={scaleFactor}
            />
          </Plane>
        ),
      )}
    </group>
  )
}

// 后期处理效果组件
function Effects() {
  const ref = useRef()
  useLayoutEffect(() => {
    // 配置遮罩材质
    const maskMaterial = ref.current.maskPass.getFullscreenMaterial()
    maskMaterial.maskFunction = MaskFunction.MULTIPLY_RGB_SET_ALPHA
  })
  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {/* 添加景深效果 */}
      <DepthOfField
        ref={ref}
        target={[0, 0, 30]}  // 焦点位置
        bokehScale={8}       // 散景缩放
        focalLength={0.1}    // 焦距
        width={1024}         // 宽度
      />
      {/* 添加晕影效果 */}
      <Vignette />
    </EffectComposer>
  )
}

function FallbackScene() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#010101',
      }}
    >
      <img
        src="/ogimage.jpg"
        alt="Zustand Bear"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
  )
}

export default function Scene() {
  const [error, setError] = useState(null)

  if (error) {
    return <FallbackScene />
  }

  return (
    <Canvas onError={setError}>
      <Experience />
      <Effects />
    </Canvas>
  )
}

function Canvas({ children, onError }) {
  extend({ Mesh, PlaneGeometry, Group })
  const canvas = useRef(null)
  const root = useRef(null)

  useLayoutEffect(() => {
    try {
      if (!root.current) {
        root.current = createRoot(canvas.current).configure({
          events,
          orthographic: true,
          gl: { antialias: false },
          camera: { zoom: 5, position: [0, 0, 200], far: 300, near: 50 },
          onCreated: (state) => {
            state.events.connect(document.getElementById('root'))
            state.setEvents({
              compute: (event, state) => {
                state.pointer.set(
                  (event.clientX / state.size.width) * 2 - 1,
                  -(event.clientY / state.size.height) * 2 + 1,
                )
                state.raycaster.setFromCamera(state.pointer, state.camera)
              },
            })
          },
        })
      }
      const resize = () =>
        root.current.configure({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      window.addEventListener('resize', resize)
      root.current.render(children)
      return () => window.removeEventListener('resize', resize)
    } catch (e) {
      onError?.(e)
    }
  }, [children, onError])

  return (
    <canvas
      ref={canvas}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'block',
      }}
    />
  )
}