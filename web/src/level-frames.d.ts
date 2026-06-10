declare module '@/pages/LevelFramesPage' {
  import { ComponentType } from 'react'

  const LevelFramesPage: ComponentType
  export default LevelFramesPage
}

declare module '@/components/rewards/LevelFrame' {
  import { ComponentType } from 'react'

  export interface LevelFrameProps {
    level?: number
    avatarUrl?: string
    playerName?: string
    size?: number
    showLabel?: boolean
    className?: string
  }

  const LevelFrame: ComponentType<LevelFrameProps>
  export default LevelFrame
}

declare module '@/components/rewards/LevelFrameDemo' {
  import { ComponentType } from 'react'

  export interface LevelFrameDemoProps {
    avatarUrl?: string
    playerName?: string
  }

  const LevelFrameDemo: ComponentType<LevelFrameDemoProps>
  export default LevelFrameDemo
}

declare module '@/components/rewards/levelFramePresets' {
  export interface LevelFramePreset {
    level: number
    name: string
    rarity: string
    tone: string
    glow: string
    accent: string
    animation: string
    icon: string
    description: string
  }

  export const LEVEL_FRAME_PRESETS: LevelFramePreset[]
  export function getLevelFramePreset(level?: number): LevelFramePreset
}
