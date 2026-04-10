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

interface ImageSlot {
  index: number
  path: string
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

const TEMPLATES: GridTemplate[] = [
  { id: 9, label: '9宫格', rows: 3, cols: 3 },
  { id: 6, label: '6宫格', rows: 2, cols: 3 },
  { id: 4, label: '4宫格', rows: 2, cols: 2 },
]

Page({
  data: {
    palette: PALETTE,
    templates: TEMPLATES,
    selectedColorIndex: 0,
    selectedTemplateId: 9 as 4 | 6 | 9,
    moodText: '发现七彩生活的美好',
    uploadedImages: [] as string[],
    slots: [] as ImageSlot[],
    composedImagePath: '',
    nowLabel: '',
    privacyPopupVisible: false,
    pendingPrivacyAction: '' as '' | 'choose' | 'pick' | 'save',
    pendingSlotIndex: -1,
    swapSourceIndex: -1,
  },

  onLoad() {
    this.refreshNowLabel()
    this.syncColorFromSpinResult()
    this.setData({ slots: this.buildSlots([], this.data.selectedTemplateId) })
    this.maybeShowPrivacyPopup()
  },

  onShow() {
    this.syncColorFromSpinResult()
    this.maybeShowPrivacyPopup()
  },

  maybeShowPrivacyPopup() {
    const accepted = wx.getStorageSync('privacyConsentAccepted')
    if (accepted || this.data.privacyPopupVisible) {
      return
    }
    this.setData({
      privacyPopupVisible: true,
      pendingPrivacyAction: '',
      pendingSlotIndex: -1,
    })
  },

  syncColorFromSpinResult() {
    const value = wx.getStorageSync('lastSpinColorIndex')
    if (typeof value === 'number' && value >= 0 && value < PALETTE.length) {
      this.setData({ selectedColorIndex: value })
    }
  },

  refreshNowLabel() {
    const now = new Date()
    const mm = `${now.getMonth() + 1}`.padStart(2, '0')
    const dd = `${now.getDate()}`.padStart(2, '0')
    const hh = `${now.getHours()}`.padStart(2, '0')
    const min = `${now.getMinutes()}`.padStart(2, '0')
    this.setData({ nowLabel: `${now.getFullYear()}.${mm}.${dd} ${hh}:${min}` })
  },

  buildSlots(images: string[], templateId: 4 | 6 | 9): ImageSlot[] {
    return Array.from({ length: templateId }, (_, index) => ({
      index,
      path: images[index] || '',
    }))
  },

  onPickColor(e: WechatMiniprogram.CustomEvent) {
    const index = Number(e.detail.value)
    this.setData({ selectedColorIndex: index })
  },

  onMoodInput(e: WechatMiniprogram.CustomEvent) {
    this.setData({ moodText: e.detail.value || '发现七彩生活的美好' })
  },

  onTemplateSelect(e: WechatMiniprogram.CustomEvent) {
    const templateId = Number(e.currentTarget.dataset.id) as 4 | 6 | 9
    const nextImages = this.data.uploadedImages.slice(0, templateId)
    this.setData({
      selectedTemplateId: templateId,
      uploadedImages: nextImages,
      slots: this.buildSlots(nextImages, templateId),
      composedImagePath: '',
      swapSourceIndex: -1,
    })
  },

  ensurePrivacyConsent(action: '' | 'choose' | 'pick' | 'save', slotIndex = -1): boolean {
    const accepted = wx.getStorageSync('privacyConsentAccepted')
    if (accepted) {
      return true
    }
    this.setData({
      privacyPopupVisible: true,
      pendingPrivacyAction: action,
      pendingSlotIndex: slotIndex,
    })
    return false
  },

  onOpenPrivacyContract() {
    const wxAny = wx as WechatMiniprogram.Wx & {
      openPrivacyContract?: (options?: {
        success?: () => void
        fail?: () => void
      }) => void
    }
    if (wxAny.openPrivacyContract) {
      wxAny.openPrivacyContract({
        fail: () => {
          wx.showToast({ title: '请在后台完善隐私指引', icon: 'none' })
        },
      })
      return
    }
    wx.showToast({ title: '当前基础库不支持打开隐私指引', icon: 'none' })
  },

  onAgreePrivacy() {
    const action = this.data.pendingPrivacyAction
    const slotIndex = this.data.pendingSlotIndex
    wx.setStorageSync('privacyConsentAccepted', true)
    this.setData({
      privacyPopupVisible: false,
      pendingPrivacyAction: '',
      pendingSlotIndex: -1,
    })
    if (action === 'choose') {
      void this.doChooseImages()
      return
    }
    if (action === 'pick') {
      void this.doPickSlotImage(slotIndex)
      return
    }
    if (action === 'save') {
      void this.doSaveImage()
    }
  },

  onDeclinePrivacy() {
    this.setData({
      privacyPopupVisible: false,
      pendingPrivacyAction: '',
      pendingSlotIndex: -1,
    })
    wx.showToast({ title: '需要同意隐私指引后才能继续', icon: 'none' })
  },

  async onChooseImages() {
    if (!this.ensurePrivacyConsent('choose')) {
      return
    }
    await this.doChooseImages()
  },

  async doChooseImages() {
    const template = TEMPLATES.find((item) => item.id === this.data.selectedTemplateId)!
    const current = [...this.data.uploadedImages]
    const emptyIndexes: number[] = []
    for (let i = 0; i < template.id; i += 1) {
      if (!current[i]) {
        emptyIndexes.push(i)
      }
    }

    const chooseCount = emptyIndexes.length > 0 ? emptyIndexes.length : template.id

    try {
      const res = await wx.chooseMedia({
        count: chooseCount,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
      })

      const pickedPaths = res.tempFiles.map((file) => file.tempFilePath)
      const compressedPaths = await this.compressPaths(pickedPaths)

      if (emptyIndexes.length > 0) {
        compressedPaths.forEach((path, idx) => {
          if (idx < emptyIndexes.length) {
            current[emptyIndexes[idx]] = path
          }
        })
      } else {
        for (let i = 0; i < template.id; i += 1) {
          current[i] = compressedPaths[i] || current[i] || ''
        }
      }

      const nextImages = current.slice(0, template.id)
      this.setData({
        uploadedImages: nextImages,
        slots: this.buildSlots(nextImages, template.id),
        composedImagePath: '',
      })
    } catch (error) {
      const err = error as { errMsg?: string }
      if (err.errMsg && err.errMsg.includes('cancel')) {
        return
      }
      wx.showToast({ title: '选择图片失败', icon: 'none' })
    }
  },

  async onPickSlotImage(e: WechatMiniprogram.CustomEvent) {
    const slotIndex = Number(e.currentTarget.dataset.index)
    const currentPath = this.data.uploadedImages[slotIndex] || ''
    const swapSourceIndex = this.data.swapSourceIndex

    if (swapSourceIndex >= 0) {
      if (!currentPath) {
        wx.showToast({ title: '请选择另一张已有照片交换', icon: 'none' })
        return
      }
      if (swapSourceIndex === slotIndex) {
        this.setData({ swapSourceIndex: -1 })
        return
      }
      this.swapSlots(swapSourceIndex, slotIndex)
      return
    }

    if (!this.ensurePrivacyConsent('pick', slotIndex)) {
      return
    }
    await this.doPickSlotImage(slotIndex)
  },

  onSlotLongPress(e: WechatMiniprogram.CustomEvent) {
    const slotIndex = Number(e.currentTarget.dataset.index)
    const currentPath = this.data.uploadedImages[slotIndex] || ''
    if (!currentPath) {
      return
    }
    this.setData({ swapSourceIndex: slotIndex })
    wx.showToast({ title: '已选中照片，请点另一张交换位置', icon: 'none' })
  },

  swapSlots(fromIndex: number, toIndex: number) {
    const nextImages = [...this.data.uploadedImages]
    const temp = nextImages[fromIndex]
    nextImages[fromIndex] = nextImages[toIndex]
    nextImages[toIndex] = temp
    this.setData({
      uploadedImages: nextImages,
      slots: this.buildSlots(nextImages, this.data.selectedTemplateId),
      composedImagePath: '',
      swapSourceIndex: -1,
    })
  },

  async doPickSlotImage(slotIndex: number) {
    const template = TEMPLATES.find((item) => item.id === this.data.selectedTemplateId)!
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
      })
      const firstFile = res.tempFiles[0]
      const picked = firstFile ? firstFile.tempFilePath : ''
      if (!picked) {
        return
      }
      const compressed = await this.compressImageHalf(picked)
      const nextImages = [...this.data.uploadedImages]
      nextImages[slotIndex] = compressed
      this.setData({
        uploadedImages: nextImages.slice(0, template.id),
        slots: this.buildSlots(nextImages, template.id),
        composedImagePath: '',
      })
    } catch (error) {
      const err = error as { errMsg?: string }
      if (err.errMsg && err.errMsg.includes('cancel')) {
        return
      }
      wx.showToast({ title: '选择图片失败', icon: 'none' })
    }
  },

  async compressPaths(paths: string[]): Promise<string[]> {
    const result: string[] = []
    for (let i = 0; i < paths.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const compressed = await this.compressImageHalf(paths[i])
      result.push(compressed)
    }
    return result
  },

  compressImageHalf(src: string): Promise<string> {
    return new Promise((resolve) => {
      wx.compressImage({
        src,
        quality: 50,
        success: (res) => resolve(res.tempFilePath),
        fail: () => resolve(src),
      })
    })
  },

  getSquareCrop(width: number, height: number) {
    if (height > width) {
      return {
        side: width,
        sx: 0,
        sy: (height - width) / 2,
      }
    }
    return {
      side: height,
      sx: (width - height) / 2,
      sy: 0,
    }
  },

  async onComposeImage() {
    const template = TEMPLATES.find((item) => item.id === this.data.selectedTemplateId)!
    const list = this.data.uploadedImages.slice(0, template.id)
    if (list.length < template.id || list.some((path) => !path)) {
      wx.showToast({ title: `请先补齐${template.id}张图片`, icon: 'none' })
      return
    }

    this.refreshNowLabel()

    const ctx = wx.createCanvasContext('composeCanvas', this)
    const canvasWidth = 1080
    const canvasHeight = 1440
    const padding = Math.floor(52 * 0.8)
    const selected = PALETTE[this.data.selectedColorIndex]

    ctx.setFillStyle(selected.hex)
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    const titleY = Math.floor(120 * 0.8)
    ctx.setFillStyle('#111111')
    ctx.setFontSize(60)
    ctx.setTextAlign('left')
    ctx.fillText('COLOR WALK', padding, titleY)

    ctx.setFillStyle('#222222')
    ctx.setFontSize(26)
    ctx.fillText(`当下心情：${this.data.moodText}`, padding, titleY + 42)

    const cardW = 170
    const cardH = Math.floor(60 * 0.8)
    const cardY = titleY + 66
    ctx.setFillStyle('rgba(255, 255, 255, 0.84)')
    ctx.fillRect(padding, cardY, cardW, cardH)
    ctx.setFillStyle(selected.hex)
    ctx.fillRect(padding + 10, cardY + 9, 30, 30)
    ctx.setFillStyle('#111')
    ctx.setFontSize(22)
    ctx.fillText(selected.name, padding + 50, cardY + 34)

    ctx.setFillStyle('rgba(0, 0, 0, 0.5)')
    ctx.setFontSize(28)
    ctx.fillText(this.data.nowLabel, padding + cardW + 24, cardY + 32)

    const gridTop = cardY + cardH + 38
    const gridAreaHeight = canvasHeight - gridTop - padding
    const templateWidth = canvasWidth - padding * 2
    const cols = template.cols
    const rows = template.rows
    const fourGapReduce = template.id === 4 ? templateWidth * (10 / 1000) : 0
    const blockGapX = template.id === 4 ? Math.max(0, 45 - fourGapReduce) : 20
    const blockGapY = template.id === 4 ? Math.max(0, 38 - fourGapReduce) : 20
    const ratio = template.id === 4 ? 230 / 1000 : (template.id === 9 ? 150 / 1000 : (template.id === 6 ? 150 / 1000 : 280 / 1000))
    const cellSize = Math.floor(templateWidth * ratio)
    const blockWidth = cols * cellSize + (cols - 1) * blockGapX
    const blockHeight = rows * cellSize + (rows - 1) * blockGapY
    const nineGridShiftLeft = template.id === 9 ? templateWidth * (260 / 1000) : 0
    const sixGridShiftLeft = template.id === 6 ? templateWidth * (260 / 1000) : 0
    const nineGridShiftUp = template.id === 9 ? templateWidth * (355 / 1000) : 0
    const sixGridShiftUp = template.id === 6 ? templateWidth * (300 / 1000) : 0
    const fourGridShiftLeft = template.id === 4 ? templateWidth * (260 / 1000) : 0
    const fourGridShiftUp = template.id === 4 ? templateWidth * (10 / 1000) : 0
    const startX = padding + (templateWidth - blockWidth) / 2 - nineGridShiftLeft - sixGridShiftLeft - fourGridShiftLeft
    const startYBase = template.id === 9 || template.id === 6 ? gridTop + (gridAreaHeight - blockHeight) / 2 : gridTop
    const startY = template.id === 9 ? startYBase - nineGridShiftUp : (template.id === 6 ? startYBase - sixGridShiftUp : startYBase - fourGridShiftUp)

    for (let i = 0; i < list.length; i += 1) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = startX + col * (cellSize + blockGapX)
      const y = startY + row * (cellSize + blockGapY)

      try {
        // eslint-disable-next-line no-await-in-loop
        const info = await wx.getImageInfo({ src: list[i] })
        const crop = this.getSquareCrop(info.width, info.height)
        ctx.drawImage(list[i], crop.sx, crop.sy, crop.side, crop.side, x, y, cellSize, cellSize)
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
            wx.setStorageSync('latestComposedImagePath', res.tempFilePath)
            wx.setStorageSync('latestTemplateId', template.id)
            this.setData({ composedImagePath: res.tempFilePath })
            wx.showToast({ title: '拼图生成成功', icon: 'success' })
            wx.navigateTo({ url: '/pages/collage-result/collage-result' })
          },
          fail: () => {
            wx.showToast({ title: '生成失败', icon: 'none' })
          },
        },
        this,
      )
    })
  },

  async requestAlbumPermission(): Promise<boolean> {
    try {
      const setting = await wx.getSetting()
      const authSetting = setting.authSetting || {}
      if (authSetting['scope.writePhotosAlbum']) {
        return true
      }
      if (authSetting['scope.writePhotosAlbum'] === false) {
        const openRes = await wx.openSetting()
        return !!openRes.authSetting['scope.writePhotosAlbum']
      }
      await wx.authorize({ scope: 'scope.writePhotosAlbum' })
      return true
    } catch (error) {
      try {
        const openRes = await wx.openSetting()
        return !!openRes.authSetting['scope.writePhotosAlbum']
      } catch (openError) {
        return false
      }
    }
  },

  async onSaveImage() {
    if (!this.ensurePrivacyConsent('save')) {
      return
    }
    await this.doSaveImage()
  },

  async doSaveImage() {
    if (!this.data.composedImagePath) {
      wx.showToast({ title: '请先生成拼图', icon: 'none' })
      return
    }

    const granted = await this.requestAlbumPermission()
    if (!granted) {
      wx.showModal({
        title: '需要相册权限',
        content: '请先允许保存到相册，才能保存拼图图片。',
        showCancel: false,
      })
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
})
