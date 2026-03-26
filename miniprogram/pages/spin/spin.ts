const SPIN_SOUND_SRC = '/assets/audio/Spin.mp3'
const SPIN_SOUND_FALLBACK_SRC = '/assets/audio/spin.mp3'

interface PaletteColor {
  hex: string
  name: string
}

const PALETTE: PaletteColor[] = [
  { hex: '#F35C4A', name: '绯霞赤' },
  { hex: '#F6924A', name: '琥珀诗' },
  { hex: '#F4C84A', name: '鎏金晨' },
  { hex: '#86C96A', name: '苔绿梦' },
  { hex: '#55C5C1', name: '九寨青' },
  { hex: '#5A89E6', name: '潮汐蓝' },
  { hex: '#8E6CD1', name: '朝暮紫' },
]

const WHEEL_CANVAS_SIZE = 300
const EMOJIS = [
  '🐶','🐱','🐼','🦆','🐝','🦋','🐢','🐬','🐎','🌿','🍁','🌹','💐','🌻','☀️','🌈','🌎','❄️','☃️','🌧️','☂️',
  '🍏','🍊','🍇','🍒','🍓','🫐','🥝','🌽','🥕','🍔','🍗','🥗','🍲','🍧','🎂','🍺','🍹','⚽️','🏀','🎾','🏈',
  '🏓','🏸','⛳️','🪁','⛷️','🚴🏻‍♂️','🚴🏻‍♀️','🥁','🎸','🚗','🛵','✈️','🚅','🏕️','❤️','🩵','💚','🖼️','📷',
]

let spinAudio: WechatMiniprogram.InnerAudioContext | null = null
let spinTimer: ReturnType<typeof setTimeout> | 0 = 0
let hapticTimer: ReturnType<typeof setInterval> | 0 = 0
let emojiTimer: ReturnType<typeof setInterval> | 0 = 0
let audioFallbackTried = false
let currentRotationDeg = 0

Page({
  data: {
    spinning: false,
    resultPrefix: '今日色彩：',
    wheelResult: '等待转盘为你挑选',
    resultColor: '#111111',
    shareButtonColor: '#111111',
    centerText: '开始',
    centerIsEmoji: false,
    shareGuideVisible: false,
  },

  onLoad() {
    spinAudio = wx.createInnerAudioContext()
    spinAudio.src = SPIN_SOUND_SRC
    spinAudio.loop = true
    spinAudio.obeyMuteSwitch = false
    spinAudio.onError(() => {
      if (spinAudio && !audioFallbackTried) {
        audioFallbackTried = true
        spinAudio.src = SPIN_SOUND_FALLBACK_SRC
        return
      }
      wx.showToast({ title: '音效文件缺失，请检查 assets/audio', icon: 'none' })
    })
    currentRotationDeg = 0
    this.drawWheel(currentRotationDeg)
  },

  onUnload() {
    if (spinTimer) {
      clearTimeout(spinTimer)
      spinTimer = 0
    }
    if (spinAudio) {
      spinAudio.stop()
      spinAudio.destroy()
      spinAudio = null
    }
    this.stopHapticFeedback()
    this.stopEmojiCarousel()
  },

  drawWheel(rotationDeg: number) {
    const ctx = wx.createCanvasContext('wheelCanvas', this)
    const size = WHEEL_CANVAS_SIZE
    const center = size / 2
    const radius = size * 0.44
    const step = (Math.PI * 2) / PALETTE.length

    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.translate(center, center)
    ctx.rotate((rotationDeg * Math.PI) / 180)

    PALETTE.forEach((color, index) => {
      const start = -Math.PI / 2 + index * step
      const end = start + step

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, radius, start, end)
      ctx.closePath()
      ctx.setFillStyle(color.hex)
      ctx.fill()
    })

    ctx.restore()

    const centerGradient = ctx.createLinearGradient(center - 42, center - 42, center + 42, center + 42)
    centerGradient.addColorStop(0, '#FF5F6D')
    centerGradient.addColorStop(0.14, '#FFC371')
    centerGradient.addColorStop(0.28, '#F9F871')
    centerGradient.addColorStop(0.42, '#8BE28B')
    centerGradient.addColorStop(0.56, '#66E5E2')
    centerGradient.addColorStop(0.7, '#72A8FF')
    centerGradient.addColorStop(0.84, '#A98BFF')
    centerGradient.addColorStop(1, '#FF8BCB')

    ctx.beginPath()
    ctx.arc(center, center, 42, 0, Math.PI * 2)
    ctx.setFillStyle(centerGradient)
    ctx.fill()

    ctx.setFillStyle('#111')
    ctx.setFontSize(this.data.centerIsEmoji ? 32 : 16)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    if (this.data.centerText) {
      ctx.fillText(this.data.centerText, center, center)
    }

    ctx.beginPath()
    ctx.moveTo(center, 30)
    ctx.lineTo(center - 11, 8)
    ctx.lineTo(center + 11, 8)
    ctx.closePath()
    ctx.setFillStyle('#111')
    ctx.fill()

    ctx.draw()
  },

  onSpinStart() {
    if (this.data.spinning) {
      return
    }

    const targetIndex = Math.floor(Math.random() * PALETTE.length)
    const totalTurns = 6 + Math.floor(Math.random() * 4)
    const sector = 360 / PALETTE.length
    const targetCenter = targetIndex * sector + sector / 2
    const destination = totalTurns * 360 + (360 - targetCenter)
    const duration = 5200
    const startAt = Date.now()

    this.setData({ spinning: true, centerText: '', centerIsEmoji: true })
    if (spinAudio) {
      spinAudio.play()
    }
    this.startHapticFeedback()
    this.startEmojiCarousel()

    const easeInOut = (t: number) => {
      if (t < 0.5) {
        return 4 * t * t * t
      }
      return 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    const tick = () => {
      const elapsed = Date.now() - startAt
      const p = Math.min(elapsed / duration, 1)
      const deg = destination * easeInOut(p)
      currentRotationDeg = deg
      this.drawWheel(deg)

      if (p < 1) {
        spinTimer = setTimeout(tick, 16)
        return
      }

      if (spinAudio) {
        spinAudio.stop()
      }
      this.stopHapticFeedback()
      this.stopEmojiCarousel()
      wx.setStorageSync('lastSpinColorIndex', targetIndex)
      this.setData({
        spinning: false,
        wheelResult: PALETTE[targetIndex].name,
        resultColor: PALETTE[targetIndex].hex,
        shareButtonColor: PALETTE[targetIndex].hex,
        centerText: '开始',
        centerIsEmoji: false,
      })
      currentRotationDeg = deg
      this.drawWheel(deg)
    }

    tick()
  },

  startHapticFeedback() {
    this.stopHapticFeedback()
    wx.vibrateShort({})
    hapticTimer = setInterval(() => {
      wx.vibrateShort({})
    }, 180)
  },

  stopHapticFeedback() {
    if (hapticTimer) {
      clearInterval(hapticTimer)
      hapticTimer = 0
    }
  },

  startEmojiCarousel() {
    this.stopEmojiCarousel()
    const randomSet = this.pickRandomEmojis(10)
    let index = 0
    this.setData({ centerText: randomSet[index], centerIsEmoji: true })
    this.drawWheel(currentRotationDeg)
    emojiTimer = setInterval(() => {
      index = (index + 1) % randomSet.length
      this.setData({ centerText: randomSet[index], centerIsEmoji: true })
      this.drawWheel(currentRotationDeg)
    }, 400)
  },

  stopEmojiCarousel() {
    if (emojiTimer) {
      clearInterval(emojiTimer)
      emojiTimer = 0
    }
  },

  pickRandomEmojis(count: number): string[] {
    const pool = [...EMOJIS]
    const result: string[] = []
    for (let i = 0; i < count; i += 1) {
      const idx = Math.floor(Math.random() * pool.length)
      result.push(pool[idx])
      pool.splice(idx, 1)
    }
    return result
  },

  onWheelTap(e: WechatMiniprogram.TouchEvent) {
    void e
    if (this.data.spinning) {
      return
    }
    this.onSpinStart()
  },

  onShowShareGuide() {
    this.setData({ shareGuideVisible: true })
  },

  onHideShareGuide() {
    this.setData({ shareGuideVisible: false })
  },

  onShareAppMessage() {
    return {
      title: `ColorWalk 今日色彩：${this.data.wheelResult}`,
      path: '/pages/spin/spin',
    }
  },
})
