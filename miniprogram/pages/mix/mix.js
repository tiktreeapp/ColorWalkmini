function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function rgbToHex(r, g, b) {
  const to = (n) => n.toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function rgbToHsv(r, g, b) {
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

function hsvToRgb(h, s, v) {
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

function hexToRgb(hex) {
  const sanitized = String(hex || '').replace('#', '')
  const num = Number.parseInt(sanitized, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function colorDistance(a, b) {
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
    colorTarget: 'solid',
    mainColors: [],
    commonColors: [
      '#111111', '#ffffff', '#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0',
      '#00bcd4', '#009688', '#795548', '#607d8b', '#ff5f6d', '#ffc371', '#8be28b', '#72a8ff',
    ],
    paletteVisible: false,
    eyedropper: false,
    locationText: '',
    timeText: '',
    pickerHue: 200,
    pickerS: 0.6,
    pickerV: 0.9,
    pickerHueHex: '#00bcd4',
  },

  _canvasW: 0,
  _canvasH: 0,
  _card: { x: 0, y: 0, w: 0, h: 0, solidH: 0, photoH: 0 },
  _img: { w: 0, h: 0 },
  _fitScale: 1,
  _scale: 1,
  _offset: { x: 0, y: 0 },
  _touchMode: '',
  _touchStart: { x: 0, y: 0 },
  _offsetStart: { x: 0, y: 0 },
  _pinchDistStart: 0,
  _scaleStart: 1,

  onLoad() {
    const now = new Date()
    const mm = `${now.getMonth() + 1}`.padStart(2, '0')
    const dd = `${now.getDate()}`.padStart(2, '0')
    const hh = `${now.getHours()}`.padStart(2, '0')
    const min = `${now.getMinutes()}`.padStart(2, '0')
    this.setData({
      timeText: `${now.getFullYear()}.${mm}.${dd} ${hh}:${min}`,
      locationText: wx.getStorageSync('latestLocationText') || '',
    })
    this.syncPickerHueHex()
  },

  onReady() {
    this.measureAndInit()
  },

  onShow() {
    this.draw()
  },

  noop() {},

  measureAndInit() {
    const query = wx.createSelectorQuery().in(this)
    query.select('.mix-canvas').boundingClientRect()
    query.exec((res) => {
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

      void this.loadPhoto(DEFAULT_PHOTO)
    })
  },

	  loadPhoto(path) {
	    return new Promise((resolve) => {
	      wx.getImageInfo({
	        src: path,
	        success: async (info) => {
	          this._img = { w: info.width, h: info.height }
	          // "Cover" fit: ensure the image fully covers the 4:3 photo area (36:27),
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

  extractMainColors(path) {
    return new Promise((resolve) => {
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
            const buckets = new Map()
            for (let i = 0; i < data.length; i += 4) {
              const a = data[i + 3]
              if (a < 200) continue
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]
              const { s, v } = rgbToHsv(r, g, b)
              const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
              const prev = buckets.get(key)
              const score = 1 + s * 0.35 + v * 0.1
              if (!prev) {
                buckets.set(key, { count: 1, score, r, g, b })
              } else {
                prev.count += 1
                prev.score += score
              }
            }

            const ranked = [...buckets.values()]
              .map((it) => ({
                hex: rgbToHex(it.r, it.g, it.b),
                weight: it.count * (it.score / it.count),
              }))
              .sort((a, b) => b.weight - a.weight)
            const candidates = ranked
              .map((it) => it.hex)
              .filter((v, idx, arr) => arr.indexOf(v) === idx)

            const top = []
            for (let i = 0; i < candidates.length && top.length < 3; i += 1) {
              const c = candidates[i]
              if (!top.length) {
                top.push(c)
                continue
              }
              const tooClose = top.some((picked) => colorDistance(picked, c) < 46)
              if (!tooClose) {
                top.push(c)
              }
            }
            for (let i = 0; i < candidates.length && top.length < 3; i += 1) {
              if (!top.includes(candidates[i])) {
                top.push(candidates[i])
              }
            }
            const base = top[0] || '#2f7dae'
            this.setData({
              mainColors: top,
              bgColor: base,
              solidColor: base,
            })
            this.draw()
            resolve()
          },
          fail: () => resolve(),
        }, this)
      })
    })
  },

  onTogglePalette() {
    const next = !this.data.paletteVisible
    this.setData({ paletteVisible: next })
    if (next) this.syncPickerHueHex()
  },

  onToggleEyedropper() {
    this.setData({ eyedropper: !this.data.eyedropper })
  },

  onPickTarget(e) {
    const target = e.currentTarget.dataset.target || 'solid'
    this.setData({ colorTarget: target })
  },

  onPickColor(e) {
    const color = e.currentTarget.dataset.color || ''
    if (!color) return
    if (this.data.colorTarget === 'bg') {
      this.setData({ bgColor: color })
    } else {
      this.setData({ solidColor: color })
    }
    this.draw()
  },

  onPickerTouch(e) {
    const kind = e.currentTarget.dataset.kind || ''
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
      if (kind === 'hue') {
        const hue = Math.round(lx * 360)
        this.setData({ pickerHue: hue })
        this.syncPickerHueHex()
        this.applyPickerColor()
        return
      }
      const s = lx
      const v = 1 - ly
      this.setData({ pickerS: s, pickerV: v })
      this.applyPickerColor()
    })
  },

  syncPickerHueHex() {
    const hueRgb = hsvToRgb(this.data.pickerHue, 1, 1)
    const hueHex = rgbToHex(hueRgb.r, hueRgb.g, hueRgb.b)
    this.setData({ pickerHueHex: hueHex })
  },

  applyPickerColor() {
    const rgb = hsvToRgb(this.data.pickerHue, this.data.pickerS, this.data.pickerV)
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
    if (this.data.colorTarget === 'bg') {
      this.setData({ bgColor: hex })
    } else {
      this.setData({ solidColor: hex })
    }
    this.draw()
  },

  async onCanvasTap(e) {
    if (!this.data.eyedropper) {
      const x = e.detail.x
      const y = e.detail.y
      if (!this.isPointInCard(x, y)) return
      await this.pickUserPhoto()
      return
    }

    const x = Math.floor(e.detail.x)
    const y = Math.floor(e.detail.y)
    if (!this.isPointInPhotoArea(x, y)) return
    wx.canvasGetImageData({
      canvasId: 'mixCanvas',
      x,
      y,
      width: 1,
      height: 1,
      success: (res) => {
        const d = res.data
        const hex = rgbToHex(d[0], d[1], d[2])
        if (this.data.colorTarget === 'bg') {
          this.setData({ bgColor: hex })
        } else {
          this.setData({ solidColor: hex })
        }
        this.draw()
      },
    }, this)
  },

  async pickUserPhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original'],
      })
      const file = res.tempFiles && res.tempFiles[0]
      const filePath = file ? file.tempFilePath : ''
      if (!filePath) return
      void this.tryResolveMetaFromExif(filePath)
      const cropped = await this.cropTo4x3(filePath)
      await this.loadPhoto(cropped)
    } catch (e) {
      // ignore
    }
  },

  cropTo4x3(filePath) {
    return new Promise((resolve) => {
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
            sh = imgH
            sw = Math.floor(imgH * target)
            sx = Math.floor((imgW - sw) / 2)
          } else if (srcR < target) {
            sw = imgW
            sh = Math.floor(imgW / target)
            sy = Math.floor((imgH - sh) / 2)
          }
          const outW = 1080
          const outH = 810
          const ctx = wx.createCanvasContext('cropCanvas', this)
          ctx.setFillStyle('#000000')
          ctx.fillRect(0, 0, outW, outH)
          ctx.drawImage(filePath, sx, sy, sw, sh, 0, 0, outW, outH)
          ctx.draw(false, () => {
            wx.canvasToTempFilePath({
              canvasId: 'cropCanvas',
              width: outW,
              height: outH,
              destWidth: outW,
              destHeight: outH,
              fileType: 'jpg',
              quality: 0.92,
              success: (res) => resolve(res.tempFilePath),
              fail: () => resolve(filePath),
            }, this)
          })
        },
        fail: () => resolve(filePath),
      })
    })
  },

  isPointInCard(x, y) {
    const c = this._card
    return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h
  },

  isPointInPhotoArea(x, y) {
    const c = this._card
    const px = c.x
    const py = c.y + c.solidH
    return x >= px && x <= px + c.w && y >= py && y <= py + c.photoH
  },

  onTouchStart(e) {
    const touches = e.touches || []
    if (!touches.length) return
    if (!this.isPointInPhotoArea(touches[0].x, touches[0].y)) return

    if (touches.length === 1) {
      this._touchMode = 'pan'
      this._touchStart = { x: touches[0].x, y: touches[0].y }
      this._offsetStart = { ...this._offset }
      return
    }

    if (touches.length >= 2) {
      this._touchMode = 'pinch'
      const dx = touches[0].x - touches[1].x
      const dy = touches[0].y - touches[1].y
      this._pinchDistStart = Math.sqrt(dx * dx + dy * dy)
      this._scaleStart = this._scale
    }
  },

  onTouchMove(e) {
    const touches = e.touches || []
    if (!touches.length) return
    if (this._touchMode === 'pan' && touches.length === 1) {
      const t = touches[0]
      const dx = t.x - this._touchStart.x
      const dy = t.y - this._touchStart.y
      this._offset = { x: this._offsetStart.x + dx, y: this._offsetStart.y + dy }
      this.constrainTransform()
      this.draw()
      return
    }

    if (this._touchMode === 'pinch' && touches.length >= 2) {
      const t0 = touches[0]
      const t1 = touches[1]
      const dx = t0.x - t1.x
      const dy = t0.y - t1.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const next = this._scaleStart * (dist / (this._pinchDistStart || 1))
      this._scale = clamp(next, 1, 3)
      this.constrainTransform()
      this.draw()
    }
  },

  onTouchEnd() {
    this._touchMode = ''
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

    this.drawRoundRect(ctx, c.x, c.y, c.w, c.h, 18, this.data.solidColor)

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

    const midY = c.y + c.solidH / 2
    ctx.setTextAlign('center')
    ctx.setFillStyle('rgba(0,0,0,0.78)')
    ctx.setFontSize(14)
    const line1 = this.data.locationText
    const line2 = this.data.timeText
    if (line1) {
      ctx.fillText(line1, c.x + c.w / 2, midY - 6)
      ctx.setFontSize(12)
      ctx.fillText(line2, c.x + c.w / 2, midY + 14)
    } else {
      ctx.fillText(line2, c.x + c.w / 2, midY + 6)
    }

    ctx.restore()

    ctx.setStrokeStyle('rgba(255,255,255,0.20)')
    ctx.setLineWidth(1)
    this.strokeRoundRect(ctx, c.x, c.y, c.w, c.h, 18)

    ctx.draw()
  },

  drawRoundRect(ctx, x, y, w, h, r, fill) {
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

  strokeRoundRect(ctx, x, y, w, h, r) {
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

  clipRoundRect(ctx, x, y, w, h, r) {
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
      const outW = 1920
      const outH = 2560
      await this.drawExport(outW, outH)
      wx.canvasToTempFilePath({
        canvasId: 'exportCanvas',
        width: outW,
        height: outH,
        destWidth: outW,
        destHeight: outH,
        fileType: 'jpg',
        quality: 0.95,
        success: async (res) => {
          try {
            await wx.saveImageToPhotosAlbum({ filePath: res.tempFilePath })
            wx.showToast({ title: '已保存到相册', icon: 'success' })
          } catch (e) {
            wx.showToast({ title: '保存失败', icon: 'none' })
          }
        },
        fail: () => wx.showToast({ title: '生成失败', icon: 'none' }),
      }, this)
    } finally {
      try {
        wx.hideLoading()
      } catch (e) {
        // ignore
      }
    }
  },

  drawExport(outW, outH) {
    return new Promise((resolve) => {
      const ctx = wx.createCanvasContext('exportCanvas', this)
      ctx.setFillStyle(this.data.bgColor)
      ctx.fillRect(0, 0, outW, outH)

      const cardW = Math.floor(outW * 0.78)
      const cardH = Math.floor((cardW * 4) / 3)
      const cardX = Math.floor((outW - cardW) / 2)
      const cardY = Math.floor((outH - cardH) / 2)
      const solidH = Math.floor((cardH * 21) / 48)
      const photoH = cardH - solidH

      this.drawRoundRect(ctx, cardX, cardY, cardW, cardH, 40, this.data.solidColor)
      ctx.setStrokeStyle('rgba(255,255,255,0.20)')
      ctx.setLineWidth(1)
      this.strokeRoundRect(ctx, cardX, cardY, cardW, cardH, 40)

      ctx.save()
      this.clipRoundRect(ctx, cardX, cardY, cardW, cardH, 40)
      ctx.setFillStyle(this.data.solidColor)
      ctx.fillRect(cardX, cardY, cardW, solidH)

      const photoX = cardX
      const photoY = cardY + solidH
      ctx.save()
      ctx.beginPath()
      ctx.rect(photoX, photoY, cardW, photoH)
      ctx.clip()

	      // Export also uses "cover" fit to match on-screen cropping.
	      const fitScale = Math.max(cardW / this._img.w, photoH / this._img.h)
	      const drawW = this._img.w * fitScale * this._scale
	      const drawH = this._img.h * fitScale * this._scale
	      const scaleX = outW / (this._canvasW || 1)
	      const centerX = photoX + cardW / 2 + this._offset.x * scaleX
	      const centerY = photoY + photoH / 2 + this._offset.y * scaleX
      ctx.drawImage(this.data.photoPath, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH)
      ctx.restore()

      const midY = cardY + solidH / 2
      ctx.setTextAlign('center')
      ctx.setFillStyle('rgba(0,0,0,0.78)')
      ctx.setFontSize(36)
      if (this.data.locationText) {
        ctx.fillText(this.data.locationText, cardX + cardW / 2, midY - 10)
        ctx.setFontSize(28)
        ctx.fillText(this.data.timeText, cardX + cardW / 2, midY + 34)
      } else {
        ctx.fillText(this.data.timeText, cardX + cardW / 2, midY + 12)
      }

      ctx.restore()
      ctx.draw(false, () => resolve())
    })
  },

  tryResolveMetaFromExif(filePath) {
    return void this.extractExifDateTime(filePath).then((taken) => {
      if (taken) {
        this.setData({ timeText: taken })
      }
      return this.extractGpsFromJpeg(filePath)
    }).then((gps) => {
      if (!gps) return
      if (!wx.cloud || !wx.cloud.callFunction) return
      wx.cloud.callFunction({
        name: 'ColorWalk',
        data: { action: 'reverseGeocode', lat: gps.lat, lon: gps.lon, debug: true },
      }).then((callRes) => {
        const result = callRes && callRes.result ? callRes.result : {}
        const locationText =
          result && result.ok && result.locationText ? String(result.locationText) : ''
        const city = result && result.ok && result.city ? String(result.city) : ''
        if (locationText) {
          wx.setStorageSync('latestLocationText', locationText)
          if (city) {
            wx.setStorageSync('latestCity', city)
          }
          this.setData({ locationText })
          this.draw()
        }
      }).catch(() => {})
    }).catch(() => {})
  },

  extractExifDateTime(filePath) {
    return new Promise((resolve) => {
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath,
        success: (res) => {
          const buf = res.data
          const u8 = new Uint8Array(buf)
          for (let i = 0; i + 19 <= u8.length; i += 1) {
            const c0 = u8[i]
            if (c0 < 0x30 || c0 > 0x39) continue
            const match =
              u8[i + 4] === 0x3a &&
              u8[i + 7] === 0x3a &&
              u8[i + 10] === 0x20 &&
              u8[i + 13] === 0x3a &&
              u8[i + 16] === 0x3a
            if (!match) continue
            const str = String.fromCharCode(...u8.slice(i, i + 19))
            if (!/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) continue
            const datePart = str.slice(0, 10).replace(/:/g, '.')
            const timePart = str.slice(11, 16)
            resolve(`${datePart} ${timePart}`)
            return
          }
          resolve('')
        },
        fail: () => resolve(''),
      })
    })
  },

  extractGpsFromJpeg(filePath) {
    return new Promise((resolve) => {
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath,
        success: (res) => {
          const buf = res.data
          const u8 = new Uint8Array(buf)
          const view = new DataView(buf)
          if (u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) {
            resolve(null)
            return
          }

          const readU16BE = (off) => view.getUint16(off, false)
          const readAscii = (off, len) => String.fromCharCode(...u8.slice(off, off + len))
          const readU16 = (off, le) => view.getUint16(off, le)
          const readU32 = (off, le) => view.getUint32(off, le)
          const readRational = (off, le) => {
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
})
