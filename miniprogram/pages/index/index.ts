const SPIN_SOUND_URL = 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_2ecf4e7f3b.mp3?filename=wooden-click-110249.mp3'

interface PaletteColor {
  hex: string
  name: string
}

interface GridTemplate {
  id: 4 | 6 | 9
  label: string
  rows: number
  cols: number
}

const PALETTE: PaletteColor[] = [
  { hex: '#F35C4A', name: '绯霞' },
  { hex: '#F6924A', name: '琥珀诗' },
  { hex: '#F4C84A', name: '鎏金晨' },
  { hex: '#86C96A', name: '苔绿梦' },
  { hex: '#55C5C1', name: '澄湖' },
  { hex: '#5A89E6', name: '蓝汐' },
  { hex: '#8E6CD1', name: '暮紫' },
]

const TEMPLATES: GridTemplate[] = [
  { id: 9, label: '9宫格', rows: 3, cols: 3 },
  { id: 6, label: '6宫格', rows: 2, cols: 3 },
  { id: 4, label: '4宫格', rows: 2, cols: 2 },
]

const WHEEL_CANVAS_SIZE = 300

let spinAudio: WechatMiniprogram.InnerAudioContext | null = null
let spinTimer: ReturnType<typeof setTimeout> | 0 = 0

Component({
  data: {
    palette: PALETTE,
    templates: TEMPLATES,
    selectedColorIndex: 0,
    selectedTemplateId: 9 as 4 | 6 | 9,
    moodText: '发现七彩生活的美好',
    wheelResult: '点击开始，等待今日色彩降临',
    spinning: false,
    uploadedImages: [] as string[],
    composedImagePath: '',
    nowLabel: '',
  },

  lifetimes: {
    attached() {
      spinAudio = wx.createInnerAudioContext()
      spinAudio.src = SPIN_SOUND_URL
      spinAudio.loop = true
      spinAudio.obeyMuteSwitch = false
      this.refreshNowLabel()
      this.drawWheel(0)
    },
    detached() {
      if (spinTimer) {
        clearTimeout(spinTimer)
      }
      if (spinAudio) {
        spinAudio.stop()
        spinAudio.destroy()
        spinAudio = null
      }
    },
  },

  methods: {
    refreshNowLabel() {
      const now = new Date()
      const mm = `${now.getMonth() + 1}`.padStart(2, '0')
      const dd = `${now.getDate()}`.padStart(2, '0')
      const hh = `${now.getHours()}`.padStart(2, '0')
      const min = `${now.getMinutes()}`.padStart(2, '0')
      this.setData({ nowLabel: `${now.getFullYear()}.${mm}.${dd} ${hh}:${min}` })
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

        const middle = start + step / 2
        const textRadius = radius * 0.7
        ctx.save()
        ctx.translate(Math.cos(middle) * textRadius, Math.sin(middle) * textRadius)
        ctx.rotate(middle + Math.PI / 2)
        ctx.setFillStyle('#1a1a1a')
        ctx.setFontSize(24)
        ctx.setTextAlign('center')
        ctx.fillText(color.name, 0, 0)
        ctx.restore()
      })

      ctx.restore()

      ctx.beginPath()
      ctx.arc(center, center, 42, 0, Math.PI * 2)
      ctx.setFillStyle('#111')
      ctx.fill()

      ctx.setFillStyle('#fff')
      ctx.setFontSize(16)
      ctx.setTextAlign('center')
      ctx.setTextBaseline('middle')
      ctx.fillText('开始', center, center)

      ctx.beginPath()
      ctx.moveTo(center, 6)
      ctx.lineTo(center - 11, 28)
      ctx.lineTo(center + 11, 28)
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

      this.setData({ spinning: true })
      if (spinAudio) {
        spinAudio.play()
      }

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
        this.drawWheel(deg)

        if (p < 1) {
          spinTimer = setTimeout(tick, 16)
          return
        }

        if (spinAudio) {
          spinAudio.stop()
        }
        this.setData({
          spinning: false,
          wheelResult: `今日色彩：${PALETTE[targetIndex].name}`,
          selectedColorIndex: targetIndex,
        })
      }

      tick()
    },

    onPickColor(e: WechatMiniprogram.CustomEvent) {
      const index = Number(e.detail.value)
      this.setData({ selectedColorIndex: index })
    },

    onMoodInput(e: WechatMiniprogram.CustomEvent) {
      this.setData({ moodText: e.detail.value || '发现七彩生活的美好' })
    },

    onTemplateSelect(e: WechatMiniprogram.CustomEvent) {
      this.setData({ selectedTemplateId: Number(e.currentTarget.dataset.id) as 4 | 6 | 9, composedImagePath: '' })
    },

    async onChooseImages() {
      const template = TEMPLATES.find((item) => item.id === this.data.selectedTemplateId)!
      try {
        const res = await wx.chooseMedia({
          count: template.id,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
        })
        const paths = res.tempFiles.map((file) => file.tempFilePath).slice(0, template.id)
        this.setData({ uploadedImages: paths, composedImagePath: '' })
      } catch (error) {
        const err = error as { errMsg?: string }
        if (err.errMsg && err.errMsg.includes('cancel')) {
          return
        }
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    },

    async onComposeImage() {
      const template = TEMPLATES.find((item) => item.id === this.data.selectedTemplateId)!
      if (this.data.uploadedImages.length < template.id) {
        wx.showToast({ title: `请上传${template.id}张图片`, icon: 'none' })
        return
      }

      this.refreshNowLabel()

      const ctx = wx.createCanvasContext('composeCanvas', this)
      const canvasWidth = 1080
      const canvasHeight = 1440
      const padding = 52
      const blockGap = 20
      const selected = PALETTE[this.data.selectedColorIndex]
      const [r, g, b] = this.hexToRgb(selected.hex)
      const bgColor = `rgba(${r}, ${g}, ${b}, 0.5)`

      ctx.setFillStyle(bgColor)
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      ctx.setFillStyle('#111111')
      ctx.setFontSize(72)
      ctx.setTextAlign('left')
      ctx.fillText('COLOR WALK', padding, 120)

      ctx.setFontSize(30)
      ctx.fillText(this.data.nowLabel, padding, 176)

      ctx.setFillStyle('#222222')
      ctx.setFontSize(34)
      ctx.fillText('当下心情', padding, 242)

      ctx.setFontSize(38)
      ctx.fillText(this.data.moodText, padding, 294)

      ctx.setFillStyle('rgba(255, 255, 255, 0.84)')
      ctx.fillRect(padding, 334, 340, 90)
      ctx.setFillStyle(selected.hex)
      ctx.fillRect(padding + 18, 354, 52, 52)
      ctx.setFillStyle('#111')
      ctx.setFontSize(30)
      ctx.fillText(`七彩色卡 · ${selected.name}`, padding + 88, 390)

      const gridTop = 460
      const gridHeight = canvasHeight - gridTop - padding
      const cellW = (canvasWidth - padding * 2 - blockGap * (template.cols - 1)) / template.cols
      const cellH = (gridHeight - blockGap * (template.rows - 1)) / template.rows
      const cellSize = Math.min(cellW, cellH)

      const list = this.data.uploadedImages.slice(0, template.id)

      for (let i = 0; i < list.length; i += 1) {
        const row = Math.floor(i / template.cols)
        const col = i % template.cols
        const x = padding + col * (cellSize + blockGap)
        const y = gridTop + row * (cellSize + blockGap)

        try {
          // eslint-disable-next-line no-await-in-loop
          const info = await wx.getImageInfo({ src: list[i] })
          const side = Math.min(info.width, info.height)
          const sx = Math.max(0, (info.width - side) / 2)
          const sy = Math.max(0, (info.height - side) / 2)

          ctx.drawImage(list[i], sx, sy, side, side, x, y, cellSize, cellSize)
        } catch (error) {
          ctx.setFillStyle('rgba(255,255,255,0.75)')
          ctx.fillRect(x, y, cellSize, cellSize)
        }
      }

      ctx.draw(false, () => {
        wx.canvasToTempFilePath(
          {
            canvasId: 'composeCanvas',
            width: canvasWidth,
            height: canvasHeight,
            destWidth: canvasWidth,
            destHeight: canvasHeight,
            success: (res) => {
              this.setData({ composedImagePath: res.tempFilePath })
              wx.showToast({ title: '拼图生成成功', icon: 'success' })
            },
            fail: () => {
              wx.showToast({ title: '生成失败', icon: 'none' })
            },
          },
          this,
        )
      })
    },

    async onSaveImage() {
      if (!this.data.composedImagePath) {
        wx.showToast({ title: '请先生成拼图', icon: 'none' })
        return
      }

      try {
        await wx.saveImageToPhotosAlbum({ filePath: this.data.composedImagePath })
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      } catch (error) {
        wx.showModal({
          title: '保存失败',
          content: '请在设置中开启相册权限后再试',
          showCancel: false,
        })
      }
    },

    hexToRgb(hex: string): [number, number, number] {
      const sanitized = hex.replace('#', '')
      const num = Number.parseInt(sanitized, 16)
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
    },
  },
})
