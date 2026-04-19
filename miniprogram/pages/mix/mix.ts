interface Point {
  x: number
  y: number
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function hexToRgb(hex: string): [number, number, number] {
  const sanitized = hex.replace('#', '')
  const num = Number.parseInt(sanitized, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHsv(r: number, g: number, b: number) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  return { s, v }
}

function hsvToRgb(h: number, s: number, v: number) {
  const hh = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (hh < 60) [r, g, b] = [c, x, 0]
  else if (hh < 120) [r, g, b] = [x, c, 0]
  else if (hh < 180) [r, g, b] = [0, c, x]
  else if (hh < 240) [r, g, b] = [0, x, c]
  else if (hh < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

function colorDistance(a: string, b: string) {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const dr = ar - br
  const dg = ag - bg
  const db = ab - bb
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

const DEFAULT_PHOTO = '/assets/photos/sample.jpg'

Page({
  data: {
    photoPath: DEFAULT_PHOTO,
    bgColor: '#2f7dae',
    solidColor: '#2f7dae',
    mainColors: [] as string[],
    spectrumHues: [
      '#FF0000', '#FF4000', '#FF8000', '#FFC000', '#FFFF00', '#C0FF00', 
      '#80FF00', '#40FF00', '#00FF00', '#00FF80', '#00FFFF', '#0080FF', 
      '#0000FF', '#4000FF', '#8000FF', '#C000FF', '#FF00FF', '#FF0080'
    ],
    commonColors: [
      '#111111', '#ffffff', '#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0',
      '#FF6B6B', '#4ECDC4', '#45B3D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#82E0AA',
      '#EB9486', '#7E7F9A', '#F3DE8A', '#CAE9FF', '#1B4965', '#62B6CB', '#BEE9E8', '#5FA8D3',
    ],
    paletteVisible: false,
    eyedropper: false,
    eyedropperPos: { x: 0, y: 0 }, // 悬浮吸管位置
    locationText: '',
    timeText: '',
    pickerHue: 200,
    pickerS: 0.6,
    pickerV: 0.9,
    pickerHueHex: '#00bcd4',
    historyColors: [] as string[], // 记录最近拾取的颜色
  },

  // geometry in canvas px (not rpx)
  _canvasW: 0,
  _canvasH: 0,
  _card: { x: 0, y: 0, w: 0, h: 0, solidH: 0, photoH: 0 },
  _img: { w: 0, h: 0 },
  _fitScale: 1,
  _scale: 1,
  _offset: { x: 0, y: 0 },
  _touchMode: '' as '' | 'pan' | 'pinch',
  _touchStart: { x: 0, y: 0 } as Point,
  _offsetStart: { x: 0, y: 0 },
  _pinchDistStart: 0,
  _scaleStart: 1,
  _hasMoved: false, // 记录当前触摸周期是否发生了位移
  _touchId0: 0,
  _touchId1: 0,
  _confirmTimer: null as any,

	  onLoad() {
	    const now = new Date()
    const mm = `${now.getMonth() + 1}`.padStart(2, '0')
    const dd = `${now.getDate()}`.padStart(2, '0')
    const hh = `${now.getHours()}`.padStart(2, '0')
    const min = `${now.getMinutes()}`.padStart(2, '0')
	    this.setData({
	      timeText: '', // 初始为空，由照片提取
	      locationText: (wx.getStorageSync('latestLocationText') as string) || '',
        historyColors: (wx.getStorageSync('historyColors') as string[]) || [], // 加载本地缓存
	    })
	    this.syncPickerHueHex()
	  },

  onReady() {
    this.measureAndInit()
  },

  onTouchStart(e: WechatMiniprogram.TouchEvent) {
    const touches = e.touches || []
    if (!touches.length) return
    
    this._hasMoved = false
    
    // 如果吸管处于激活状态，优先处理吸管
    if (this.data.eyedropper) {
      const x = touches[0].x
      const y = touches[0].y
      if (this.isPointInCard(x, y)) {
        this.setData({ eyedropperPos: { x, y } })
        this.pickColorAt(x, y)
        this.resetConfirmTimer()
        this._touchMode = 'eyedropper'
      }
      return
    }

    if (touches.length === 1) {
      this._touchMode = 'pan'
      this._touchStart = { x: touches[0].clientX, y: touches[0].clientY }
      this._offsetStart = { ...this._offset }
    } else if (touches.length >= 2) {
      this._touchMode = 'pinch'
      const dx = touches[1].clientX - touches[0].clientX
      const dy = touches[1].clientY - touches[0].clientY
      this._pinchDistStart = Math.sqrt(dx * dx + dy * dy)
      this._scaleStart = this._scale
    }
  },

  onTouchMove(e: WechatMiniprogram.TouchEvent) {
    const touches = e.touches || []
    if (!touches.length) return
    
    if (this._touchMode === 'eyedropper') {
      const x = touches[0].x
      const y = touches[0].y
      this.setData({ eyedropperPos: { x, y } })
      this.pickColorAt(x, y)
      return
    }

    if (this._touchMode === 'pan' && touches.length === 1) {
      const dx = touches[0].clientX - this._touchStart.x
      const dy = touches[0].clientY - this._touchStart.y
      
      // 位移判定：超过 5px 视为拖拽，禁掉点击换图
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this._hasMoved = true
      }

      this._offset = {
        x: this._offsetStart.x + dx,
        y: this._offsetStart.y + dy
      }
      this.draw()
    } else if (this._touchMode === 'pinch' && touches.length >= 2) {
      this._hasMoved = true
      const dx = touches[1].clientX - touches[0].clientX
      const dy = touches[1].clientY - touches[0].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const ratio = dist / (this._pinchDistStart || 1)
      this._scale = Math.max(0.3, Math.min(5, this._scaleStart * ratio))
      this.draw()
    }
  },

  onTouchEnd() {
    this._touchMode = ''
  },

  onShow() {
    // Tab switching can clear the canvas on some devices.
    this.draw()
  },

  noop() {},

  async measureAndInit() {
    const query = wx.createSelectorQuery().in(this)
    query.select('.mix-canvas').boundingClientRect()
    query.exec(async (res) => {
      const rect = res && res[0]
      if (!rect) return
      this._canvasW = Math.floor(rect.width)
      this._canvasH = Math.floor(rect.height)

      const cardW = Math.floor(this._canvasW * 0.78)
      const cardH = Math.floor((cardW * 4) / 3)
      const cardX = Math.floor((this._canvasW - cardW) / 2)
      const cardY = Math.floor((this._canvasH - cardH) / 2)
      const solidH = Math.floor((cardH * 21) / 48)
      const photoH = cardH - solidH
      this._card = { x: cardX, y: cardY, w: cardW, h: cardH, solidH, photoH }

      await this.loadPhoto(DEFAULT_PHOTO)
    })
  },

	  async loadPhoto(path: string) {
	    return new Promise<void>((resolve) => {
	      wx.getImageInfo({
	        src: path,
	        success: async (info) => {
	          this._img = { w: info.width, h: info.height }
	          // "Cover" fit: make sure the image fully covers the 4:3 photo area (36:27),
	          // so portrait/landscape photos are cropped instead of leaving blank space.
	          const areaW = this._card.w
	          const areaH = this._card.photoH
	          this._fitScale = Math.max(areaW / this._img.w, areaH / this._img.h)
	          this._scale = 1
	          this._offset = { x: 0, y: 0 }
	          this.setData({ photoPath: path })
	          await this.extractMainColors(path)
	          this.draw()
          resolve()
        },
        fail: () => {
          this.draw()
          resolve()
        },
      })
    })
  },

  async extractMainColors(path: string) {
    const ctx = wx.createCanvasContext('analyzeCanvas', this)
    const w = 96
    const h = 72
    ctx.drawImage(path, 0, 0, w, h)
    ctx.draw(false, () => {
      wx.canvasGetImageData({
        canvasId: 'analyzeCanvas',
        x: 0,
        y: 0,
        width: w,
        height: h,
        success: (res) => {
          const data = res.data
          const buckets = new Map<number, { count: number; score: number; r: number; g: number; b: number }>()
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3]
            if (a < 200) continue
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const { s, v } = rgbToHsv(r, g, b)
            const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
            const prev = buckets.get(key)
            if (!prev) {
              buckets.set(key, { count: 1, score: 0, r, g, b })
            } else {
              prev.count += 1
            }
          }

          const candidates = [...buckets.values()]
            .map((it) => {
              const { r, g, b } = it
              // 计算更精确的 HSV
              const max = Math.max(r, g, b)
              const min = Math.min(r, g, b)
              const d = max - min
              const v = max / 255
              const s = max === 0 ? 0 : d / max
              let h = 0
              if (d !== 0) {
                if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
                else if (max === g) h = (b - r) / d + 2
                else h = (r - g) / d + 4
                h *= 60
              }

              // 1. 基础权重：面积（count）
              let weight = it.count

              // 2. 鲜艳度加成：饱和度越高，在这个基础上加分
              weight *= (1 + s * 4.0)

              // 3. 用户指定的色相加成（红、绿、黄、蓝色系）
              let bias = 1.0
              if (s > 0.15 && v > 0.1) { // 只有非黑白灰色才加成
                if (h < 20 || h > 340) bias = 3.0 // 红色
                else if (h > 40 && h < 80) bias = 2.5 // 黄色
                else if (h > 80 && h < 165) bias = 2.0 // 绿色
                else if (h > 185 && h < 265) bias = 2.0 // 蓝色
              }
              weight *= bias

              // 4. 极端亮度惩罚
              if (v < 0.15 || v > 0.95) weight *= 0.2

              return {
                hex: rgbToHex(r, g, b),
                r, g, b, h, s, v,
                weight
              }
            })
            .sort((a, b) => b.weight - a.weight)

          const top: string[] = []
          
          // 采用“阶梯式筛选”，优先保证巨大的视觉差异
          const steps = [110, 80, 50] // 三档距离阈值
          
          for (const threshold of steps) {
            for (let i = 0; i < candidates.length && top.length < 3; i += 1) {
              const c = candidates[i]
              const alreadyIn = top.includes(c.hex)
              if (alreadyIn) continue

              const tooClose = top.some((picked) => {
                const [pr, pg, pb] = hexToRgb(picked)
                const dr = pr - c.r
                const dg = pg - c.g
                const db = pb - c.b
                const dist = Math.sqrt(dr * dr + dg * dg + db * db)
                return dist < threshold
              })

              if (!tooClose) {
                top.push(c.hex)
              }
            }
          }

          // 如果还是不够，按权重硬补（保底逻辑，通常不会走到这）
          if (top.length < 3) {
            for (let i = 0; i < candidates.length && top.length < 3; i += 1) {
              if (!top.includes(candidates[i].hex)) top.push(candidates[i].hex)
            }
          }

          const base = top[0] || '#2f7dae'
          this.setData({
            mainColors: top,
            bgColor: base,
            solidColor: base,
          })
          this.draw()
        },
        fail: () => {},
      }, this)
    })
  },

	  onTogglePalette() {
	    const next = !this.data.paletteVisible
	    this.setData({ paletteVisible: next })
	    if (next) this.syncPickerHueHex()
	  },

  onToggleEyedropper() {
    const newValue = !this.data.eyedropper
    const c = this._card
    
    let pos = { x: this._canvasW / 2, y: this._canvasH / 2 }
    if (newValue) {
      // 初始位置设定在图片区域的靠上 1/3 处，避开纯色区文字
      pos = {
        x: c.x + c.w / 2,
        y: (c.y + c.solidH) + (c.photoH / 3)
      }
      
      this.setData({
        eyedropper: newValue,
        eyedropperPos: pos,
        paletteVisible: false // 开启吸管时关闭调色盘面板
      })
      
      this.pickColorAt(pos.x, pos.y)
      this.resetConfirmTimer()
      
      wx.showToast({
        title: '点击取新颜色，非拖动',
        icon: 'none',
        duration: 3000
      })
    } else {
      this.setData({ eyedropper: false })
      this.clearConfirmTimer()
    }
  },

  resetConfirmTimer() {
    this.clearConfirmTimer()
    this._confirmTimer = setTimeout(() => {
      this.setData({ eyedropper: false })
    }, 10000)
  },

  clearConfirmTimer() {
    if (this._confirmTimer) {
      clearTimeout(this._confirmTimer)
      this._confirmTimer = null
    }
  },

  onPickColor(e: WechatMiniprogram.CustomEvent) {
    const color = (e.currentTarget.dataset.color || '') as string
    if (!color) return
    this.setData({ eyedropper: false }) // 选色时关闭吸管防止冲突
    this.clearConfirmTimer()
    this.updateGlobalColor(color)
  },

  updateGlobalColor(color: string) {
    this.setData({ 
      solidColor: color,
      bgColor: color
    })
    this.draw()
  },

  // 将颜色加入最近历史
  saveToHistory(color: string) {
    let history = this.data.historyColors || []
    if (!color) return
    // 限制最近 12 个颜色
    history = [color, ...history.filter(c => c !== color)].slice(0, 12)
    this.setData({ historyColors: history })
    // 同步到本地缓存
    wx.setStorageSync('historyColors', history)
  },

	  onPickerTouch(e: WechatMiniprogram.TouchEvent) {
	    const kind = (e.currentTarget.dataset.kind || '') as 'sv' | 'hue'
	    const t = (e.touches && e.touches[0]) || null
	    if (!t) return
	    const x = t.x
	    const y = t.y

    const query = wx.createSelectorQuery().in(this)
    const selector = kind === 'hue' ? '.picker-hue' : '.picker-sv'
    query.select(selector).boundingClientRect()
    query.exec((res) => {
      const rect = res && res[0]
      if (!rect) return
      const lx = clamp((x - rect.left) / rect.width, 0, 1)
      const ly = clamp((y - rect.top) / rect.height, 0, 1)

      if (kind === 's') {
        this.setData({ pickerS: lx })
        this.applyPickerColor()
        return
      }

      this.setData({ pickerHue: Math.round(lx * 360) })
      this.syncPickerHueHex()
      this.applyPickerColor()
    })
  },

  onSpectrumTouch(e: WechatMiniprogram.TouchEvent) {
    const t = (e.touches && e.touches[0]) || null
    if (!t) return
    const x = t.x
    const y = t.y

    const query = wx.createSelectorQuery().in(this)
    query.select('.picker-spectrum').boundingClientRect()
    query.exec((res) => {
      const rect = res && res[0]
      if (!rect) return
      const lx = clamp((x - rect.left) / rect.width, 0, 1)
      const ly = clamp((y - rect.top) / rect.height, 0, 1)

      this.setData({
        pickerHue: Math.floor(lx * 359),
        pickerV: Math.max(0.01, 1 - ly)
      })
      this.syncPickerHueHex()
      this.applyPickerColor()
    })
  },

	  syncPickerHueHex() {
	    const hueRgb = hsvToRgb(this.data.pickerHue, 1, 1)
	    const hueHex = rgbToHex(hueRgb.r, hueRgb.g, hueRgb.b)
	    this.setData({ pickerHueHex: hueHex })
	  },

	  applyPickerColor() {
    const { r, g, b } = hsvToRgb(this.data.pickerHue, this.data.pickerS, this.data.pickerV)
    const hex = rgbToHex(r, g, b)
    this.setData({ eyedropper: false }) // 滑动色盘时关闭吸管
    this.clearConfirmTimer()
    this.updateGlobalColor(hex)
  },



  pickColorAt(x: number, y: number) {
    wx.canvasGetImageData({
      canvasId: 'mixCanvas',
      x: Math.floor(x),
      y: Math.floor(y),
      width: 1,
      height: 1,
      success: (res) => {
        const d = res.data
        const hex = rgbToHex(d[0], d[1], d[2])
        this.updateGlobalColor(hex)
      },
    }, this)
  },

  async pickUserPhoto() {
    try {
      // 显式触发隐私授权检查，符合微信合规要求
      if (wx.requirePrivacyAuthorize) {
        await new Promise((resolve, reject) => {
          wx.requirePrivacyAuthorize({
            success: resolve,
            fail: reject
          })
        })
      }

      const res = await new Promise<any>((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['original', 'compressed'], // 允许用户自行选择是否使用原图
          sourceType: ['album'], // 直接调起相册，不再弹出拍照选项
          success: resolve,
          fail: reject
        })
      })
      const filePath = res.tempFilePaths[0]
      if (!filePath) return
        
        // 选择新图时，重置图片状态但不提示定位
        this._scale = 1
        this._offset = { x: 0, y: 0 }
        this.setData({
          timeText: '正在读取拍摄时间...', 
        })
        this.draw()

	      void this.tryResolveMetaFromExif(filePath)
	      const cropped = await this.cropTo4x3(filePath)
	      await this.loadPhoto(cropped)
	    } catch (e) {
	      // ignore cancel
	    }
	  },

	  // Center-crop the chosen image to 4:3 (36:27) so portrait photos won't break the layout.
	  cropTo4x3(filePath: string) {
	    return new Promise<string>((resolve) => {
	      wx.getImageInfo({
	        src: filePath,
	        success: (info) => {
	          const imgW = info.width || 1
	          const imgH = info.height || 1
	          const target = 4 / 3
	          const srcR = imgW / imgH
	          let sx = 0
	          let sy = 0
	          let sw = imgW
	          let sh = imgH
	          if (srcR > target) {
	            // too wide, crop left/right
	            sh = imgH
	            sw = Math.floor(imgH * target)
	            sx = Math.floor((imgW - sw) / 2)
	          } else if (srcR < target) {
	            // too tall, crop top/bottom (vertical center)
	            sw = imgW
	            sh = Math.floor(imgW / target)
	            sy = Math.floor((imgH - sh) / 2)
	          }

	          const outW = 1080
	          const outH = 810
	          const ctx = wx.createCanvasContext('cropCanvas', this)
	          ctx.setFillStyle('#000000')
	          ctx.fillRect(0, 0, outW, outH)
	          // 9-arg drawImage: (src, sx, sy, sw, sh, dx, dy, dw, dh)
	          // @ts-expect-error WeChat runtime supports the 9-arg signature.
	          ctx.drawImage(filePath, sx, sy, sw, sh, 0, 0, outW, outH)
	          ctx.draw(false, () => {
	            wx.canvasToTempFilePath(
	              {
	                canvasId: 'cropCanvas',
	                width: outW,
	                height: outH,
	                destWidth: outW,
	                destHeight: outH,
	                fileType: 'jpg',
	                quality: 0.92,
	                success: (res) => resolve(res.tempFilePath),
	                fail: () => resolve(filePath),
	              },
	              this,
	            )
	          })
	        },
	        fail: () => resolve(filePath),
	      })
	    })
	  },

  // 仅保留时间提取，彻底去掉定位逻辑
  async tryResolveMetaFromExif(filePath: string) {
    const taken = await this.extractExifDateTime(filePath);
    if (taken) {
      this.setData({ timeText: taken });
      this.draw();
    }
  },

  extractExifDateTime(filePath: string): Promise<string> {
    return new Promise((resolve) => {
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath,
        success: (res) => {
          const buf = res.data as ArrayBuffer
          const u8 = new Uint8Array(buf)
          const view = new DataView(buf)
          
          const findInIfd = (tiffOffset: number, ifdOffset: number, le: boolean, depth: number): string | null => {
            if (depth > 5 || ifdOffset + tiffOffset + 2 > u8.length) return null
            const entries = view.getUint16(tiffOffset + ifdOffset, le)
            for (let i = 0; i < entries; i++) {
              const entryOff = tiffOffset + ifdOffset + 2 + i * 12
              if (entryOff + 12 > u8.length) break
              const tag = view.getUint16(entryOff, le)
              if (tag === 0x9003 || tag === 0x0132) {
                const valOff = view.getUint32(entryOff + 8, le)
                if (tiffOffset + valOff + 19 <= u8.length) {
                  return String.fromCharCode(...u8.slice(tiffOffset + valOff, tiffOffset + valOff + 19))
                }
              }
              if (tag === 0x8769) {
                const subRes = findInIfd(tiffOffset, view.getUint32(entryOff + 8, le), le, depth + 1)
                if (subRes) return subRes
              }
            }
            return null
          }

          let offset = 2
          while (offset + 10 < u8.length) {
            const marker = u8[offset + 1]
            const size = view.getUint16(offset + 2, false)
            if (u8[offset] !== 0xff || marker === 0xda || marker === 0xd9) break

            if (marker === 0xe1) {
              const isExif = String.fromCharCode(...u8.slice(offset + 4, offset + 8)) === 'Exif'
              if (isExif) {
                const tiffOffset = offset + 10
                const le = String.fromCharCode(u8[tiffOffset], u8[tiffOffset+1]) === 'II'
                const firstIfd = view.getUint32(tiffOffset + 4, le)
                const res = findInIfd(tiffOffset, firstIfd, le, 0)
                if (res && res.length >= 10) {
                  const datePart = res.slice(0, 10).replace(/:/g, '.')
                  const timePart = res.slice(11, 16)
                  resolve(`${datePart} ${timePart}`)
                  return
                }
              }
            }
            offset += 2 + size
          }
          // 彻底兜底：暴力全文件扫描日期格式字符串
          for (let i = 0; i + 19 <= Math.min(u8.length, 100000); i++) {
            if (u8[i+4] === 0x3a && u8[i+7] === 0x3a && u8[i+10] === 0x20) {
              const str = String.fromCharCode(...u8.slice(i, i + 19))
              if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
                resolve(str.slice(0,10).replace(/:/g, '.') + ' ' + str.slice(11, 16))
                return
              }
            }
          }
          resolve('')
        },
        fail: () => resolve('')
      })
    })
  },

  extractGpsFromJpeg(filePath: string): Promise<{ lat: number; lon: number } | null> {
    return new Promise((resolve) => {
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath,
        success: (res) => {
          const buf = res.data as ArrayBuffer
          const u8 = new Uint8Array(buf)
          const view = new DataView(buf)
          if (u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) {
            resolve(null)
            return
          }

          const readU16BE = (off: number) => view.getUint16(off, false)
          const readAscii = (off: number, len: number) =>
            String.fromCharCode(...u8.slice(off, off + len))

          const readU16 = (off: number, le: boolean) => view.getUint16(off, le)
          const readU32 = (off: number, le: boolean) => view.getUint32(off, le)
          const readRational = (off: number, le: boolean) => {
            const num = readU32(off, le)
            const den = readU32(off + 4, le)
            if (!den) return 0
            return num / den
          }

          let offset = 2
          while (offset + 4 < u8.length) {
            if (u8[offset] !== 0xff) break
            const marker = u8[offset + 1]
            if (marker === 0xda || marker === 0xd9) break
            const size = readU16BE(offset + 2)
            if (size < 2) break

            if (marker === 0xe1 && size >= 10) {
              const exifOffset = offset + 4
              if (readAscii(exifOffset, 6) !== 'Exif\u0000\u0000') {
                offset += 2 + size
                continue
              }

              const tiffOffset = exifOffset + 6
              const endian = readAscii(tiffOffset, 2)
              const le = endian === 'II'
              if (!(le || endian === 'MM')) {
                resolve(null)
                return
              }
              const magic = readU16(tiffOffset + 2, le)
              if (magic !== 0x002a) {
                resolve(null)
                return
              }
              const ifd0 = readU32(tiffOffset + 4, le)
              let dirOff = tiffOffset + ifd0
              if (dirOff + 2 > u8.length) {
                resolve(null)
                return
              }
              const entries = readU16(dirOff, le)
              dirOff += 2

              let gpsPtr = 0
              for (let i = 0; i < entries; i += 1) {
                const entryOff = dirOff + i * 12
                if (entryOff + 12 > u8.length) break
                const tag = readU16(entryOff, le)
                if (tag === 0x8825) {
                  gpsPtr = readU32(entryOff + 8, le)
                  break
                }
              }
              if (!gpsPtr) {
                resolve(null)
                return
              }

              let gpsOff = tiffOffset + gpsPtr
              if (gpsOff + 2 > u8.length) {
                resolve(null)
                return
              }
              const gpsEntries = readU16(gpsOff, le)
              gpsOff += 2

              let latRef = 'N'
              let lonRef = 'E'
              let latValOff = 0
              let lonValOff = 0
              for (let i = 0; i < gpsEntries; i += 1) {
                const entryOff = gpsOff + i * 12
                if (entryOff + 12 > u8.length) break
                const tag = readU16(entryOff, le)
                const type = readU16(entryOff + 2, le)
                const count = readU32(entryOff + 4, le)
                const valOff = entryOff + 8

                if (tag === 0x0001 && type === 2 && count >= 1) {
                  latRef = String.fromCharCode(u8[valOff])
                } else if (tag === 0x0003 && type === 2 && count >= 1) {
                  lonRef = String.fromCharCode(u8[valOff])
                } else if (tag === 0x0002 && type === 5 && count === 3) {
                  latValOff = readU32(valOff, le)
                } else if (tag === 0x0004 && type === 5 && count === 3) {
                  lonValOff = readU32(valOff, le)
                }
              }
              if (!latValOff || !lonValOff) {
                resolve(null)
                return
              }

              const latBase = tiffOffset + latValOff
              const lonBase = tiffOffset + lonValOff
              if (latBase + 24 > u8.length || lonBase + 24 > u8.length) {
                resolve(null)
                return
              }

              const latDeg = readRational(latBase, le)
              const latMin = readRational(latBase + 8, le)
              const latSec = readRational(latBase + 16, le)
              const lonDeg = readRational(lonBase, le)
              const lonMin = readRational(lonBase + 8, le)
              const lonSec = readRational(lonBase + 16, le)

              let lat = latDeg + latMin / 60 + latSec / 3600
              let lon = lonDeg + lonMin / 60 + lonSec / 3600
              if (latRef === 'S') lat = -lat
              if (lonRef === 'W') lon = -lon

              if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                resolve(null)
                return
              }
              resolve({ lat, lon })
              return
            }

            offset += 2 + size
          }

          resolve(null)
        },
        fail: () => resolve(null),
      })
    })
  },

  isPointInCard(x: number, y: number) {
    const c = this._card
    return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h
  },

  isPointInPhotoArea(x: number, y: number) {
    const c = this._card
    const px = c.x
    const py = c.y + c.solidH
    return x >= px && x <= px + c.w && y >= py && y <= py + c.photoH
  },

  onCanvasTap(e: WechatMiniprogram.TouchEvent) {
    // 如果吸管处于激活状态，禁掉所有其他直接点击逻辑，确保取色优先
    if (this.data.eyedropper) {
      const { x, y } = e.detail
      this.setData({ eyedropperPos: { x, y } })
      this.pickColorAt(x, y)
      this.resetConfirmTimer()
      return
    }

    // 如果当前手指移动过，不视为点击更换照片
    if (this._hasMoved) {
      this._hasMoved = false
      return
    }

    const { x, y } = e.detail
    // 1. 如果点击的是图片区域，触发换图逻辑
    if (this.isPointInPhotoArea(x, y)) {
      this.pickUserPhoto()
      return
    }
    
    // 2. 如果点击的是纯色区域（顶部卡片部分），唤起编辑逻辑
    const c = this._card
    const isSolidArea = x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.solidH
    
    if (isSolidArea) {
      wx.showModal({
        title: '编辑文本',
        editable: true,
        placeholderText: '请输入地点或日期',
        content: this.data.locationText,
        success: async (res) => {
          if (res.confirm) {
            const newText = res.content || ''
            if (!newText) {
              this.setData({ locationText: '' })
              this.draw()
              return
            }

            wx.showLoading({ title: '安全审核中...', mask: true })
            try {
              const checkRes = await (wx as any).cloud.callFunction({
                name: 'ColorWalk',
                data: { action: 'msgSecCheck', content: newText }
              })
              
              if (checkRes.result && !checkRes.result.ok) {
                wx.showToast({ title: '内容不合规，请重新输入', icon: 'none' })
                return
              }
              
              this.setData({ locationText: newText })
              this.draw()
            } catch (e) {
              // 网络异常等情况，为不影响用户体验，可根据策略放行或阻断
              this.setData({ locationText: newText })
              this.draw()
            } finally {
              wx.hideLoading()
            }
          }
        }
      })
      return
    }
  },



	  constrainTransform() {
	    const c = this._card
	    const drawW = this._img.w * this._fitScale * this._scale
	    const drawH = this._img.h * this._fitScale * this._scale
	    const areaW = c.w
	    const areaH = c.photoH

	    // Keep image covering the photo area; handle edge cases when draw size is <= area size.
	    if (drawW <= areaW) {
	      this._offset.x = 0
	    } else {
	      const minX = (areaW - drawW) / 2
	      const maxX = (drawW - areaW) / 2
	      this._offset.x = clamp(this._offset.x, minX, maxX)
	    }

	    if (drawH <= areaH) {
	      this._offset.y = 0
	    } else {
	      const minY = (areaH - drawH) / 2
	      const maxY = (drawH - areaH) / 2
	      this._offset.y = clamp(this._offset.y, minY, maxY)
	    }
	  },

  draw() {
    const ctx = wx.createCanvasContext('mixCanvas', this)
    const w = this._canvasW || 1
    const h = this._canvasH || 1
    const c = this._card

    ctx.setFillStyle(this.data.bgColor)
    ctx.fillRect(0, 0, w, h)

    // card fill (no shadow)
    this.drawRoundRect(ctx, c.x, c.y, c.w, c.h, 18, this.data.solidColor)

    // photo area clip
    ctx.save()
    this.clipRoundRect(ctx, c.x, c.y, c.w, c.h, 18)
    ctx.setFillStyle(this.data.solidColor)
    ctx.fillRect(c.x, c.y, c.w, c.solidH)

    const photoX = c.x
    const photoY = c.y + c.solidH
    ctx.save()
    ctx.beginPath()
    ctx.rect(photoX, photoY, c.w, c.photoH)
    ctx.clip()

    const drawW = this._img.w * this._fitScale * this._scale
    const drawH = this._img.h * this._fitScale * this._scale
    const centerX = photoX + c.w / 2 + this._offset.x
    const centerY = photoY + c.photoH / 2 + this._offset.y
    ctx.drawImage(this.data.photoPath, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH)
    ctx.restore()

    // text in solid area (支持多行换行)
    const midY = c.y + c.solidH / 2
    ctx.setTextAlign('center')
    
    const mainText = this.data.locationText
    
    if (!mainText) {
      // 仅预览可见的引导
      ctx.setFontSize(14)
      ctx.setFillStyle('rgba(0,0,0,0.3)')
      ctx.fillText('点击编辑文本', c.x + c.w / 2, midY + 6)
    } else {
      ctx.setFillStyle('rgba(0,0,0,0.78)')
      const lines = mainText.split('\n')
      const fontSize = 14
      const lineHeight = fontSize * 1.5
      
      // 计算起始 Y 轴偏移，确保整体居中
      const totalH = lines.length * lineHeight
      let startY = midY - (totalH / 2) + (fontSize / 2) + 2
      
      ctx.setFontSize(fontSize)
      lines.forEach((line, index) => {
        ctx.fillText(line.trim(), c.x + c.w / 2, startY + index * lineHeight)
      })
    }

    ctx.restore()

    // outline
    ctx.setStrokeStyle('rgba(255,255,255,0.20)')
    ctx.setLineWidth(1)
    this.strokeRoundRect(ctx, c.x, c.y, c.w, c.h, 18)

    ctx.draw()
  },

  drawRoundRect(ctx: WechatMiniprogram.CanvasContext, x: number, y: number, w: number, h: number, r: number, fill: string) {
    const radius = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + w, y, x + w, y + h, radius)
    ctx.arcTo(x + w, y + h, x, y + h, radius)
    ctx.arcTo(x, y + h, x, y, radius)
    ctx.arcTo(x, y, x + w, y, radius)
    ctx.closePath()
    ctx.setFillStyle(fill)
    ctx.fill()
  },

  strokeRoundRect(ctx: WechatMiniprogram.CanvasContext, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + w, y, x + w, y + h, radius)
    ctx.arcTo(x + w, y + h, x, y + h, radius)
    ctx.arcTo(x, y + h, x, y, radius)
    ctx.arcTo(x, y, x + w, y, radius)
    ctx.closePath()
    ctx.stroke()
  },

  clipRoundRect(ctx: WechatMiniprogram.CanvasContext, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + w, y, x + w, y + h, radius)
    ctx.arcTo(x + w, y + h, x, y + h, radius)
    ctx.arcTo(x, y + h, x, y, radius)
    ctx.arcTo(x, y, x + w, y, radius)
    ctx.closePath()
    ctx.clip()
  },

  async onDownload() {
    try {
      wx.showLoading({ title: '生成中...', mask: true })
      const outW = 1080
      const outH = 1440
      await this.drawExport(outW, outH)
      wx.canvasToTempFilePath(
        {
          canvasId: 'exportCanvas',
          width: outW,
          height: outH,
          destWidth: outW,
          destHeight: outH,
          fileType: 'jpg',
          quality: 0.95,
          success: async (res) => {
            // 生成图片成功立即保存颜色，不再等待相册写入回调，确保保存成功率
            this.saveToHistory(this.data.solidColor)
            
            try {
              await wx.saveImageToPhotosAlbum({ filePath: res.tempFilePath })
              wx.showToast({ title: '已保存到相册', icon: 'success' })
            } catch (e) {
              wx.showToast({ title: '保存失败', icon: 'none' })
            }
          },
          fail: () => wx.showToast({ title: '生成失败', icon: 'none' }),
        },
        this,
      )
    } finally {
      try {
        wx.hideLoading()
      } catch (e) {
        // ignore
      }
    }
  },

  drawExport(outW: number, outH: number) {
    return new Promise<void>((resolve) => {
      const ctx = wx.createCanvasContext('exportCanvas', this)
      
      // 直接绘制卡片内容，铺满整个 exportCanvas (3:4)
      const cardW = outW
      const cardH = outH
      const cardX = 0
      const cardY = 0
      const solidH = Math.floor((cardH * 21) / 48)
      const photoH = cardH - solidH

      // 背景（卡片主色）
      this.drawRoundRect(ctx, cardX, cardY, cardW, cardH, 0, this.data.solidColor)

      // 顶部拼色区域
      ctx.save()
      ctx.setFillStyle(this.data.solidColor)
      ctx.fillRect(cardX, cardY, cardW, solidH)

      // 照片区域裁剪并绘制
      const photoX = cardX
      const photoY = cardY + solidH
      ctx.save()
      ctx.beginPath()
      ctx.rect(photoX, photoY, cardW, photoH)
      ctx.clip()

      // 按照当前手动缩放后的比例计算绘制宽高
      const baseFitScale = Math.max(cardW / this._img.w, photoH / this._img.h)
      const currentScale = baseFitScale * this._scale
      const drawW = this._img.w * currentScale
      const drawH = this._img.h * currentScale
      
      // 这里的偏移量需要根据导出画布比例进行真实缩放
      const exportCoordScale = outW / (this._card.w || 1)
      const centerX = photoX + cardW / 2 + this._offset.x * exportCoordScale
      const centerY = photoY + photoH / 2 + this._offset.y * exportCoordScale
      
      ctx.drawImage(this.data.photoPath, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH)
      ctx.restore()

      // 绘制文字 (支持多行导出)
      const midY = cardY + solidH / 2
      ctx.setTextAlign('center')
      ctx.setFillStyle('rgba(0,0,0,0.78)')
      
      const mainText = this.data.locationText
      if (mainText) {
        const lines = mainText.split('\n')
        const fontSize = 40
        const lineHeight = fontSize * 1.5
        const totalH = lines.length * lineHeight
        let startY = midY - (totalH / 2) + (fontSize / 2) + 4
        
        ctx.setFontSize(fontSize)
        lines.forEach((line, index) => {
          ctx.fillText(line.trim(), cardX + cardW / 2, startY + index * lineHeight)
        })
      }

      ctx.restore()
      ctx.draw(false, () => resolve())
    })
  },
})
