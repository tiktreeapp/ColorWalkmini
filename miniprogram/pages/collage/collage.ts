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

interface MoodGroup {
  display: string
}

interface SecurityCheckResult {
  ok: boolean
  kind?: 'risk' | 'error'
  code?: string | number
  message?: string
  city?: string
}

interface ReverseGeocodeResult {
  ok: boolean
  city?: string
  kind?: 'error'
  code?: string | number
  message?: string
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

const MOOD_GROUPS: MoodGroup[] = [
  { display: '😄 🌄 🏃 🐶 🍜' },
  { display: '🥰 🌸 🚴 🦋 🍵' },
  { display: '😌 🌊 🏊 🐬 🥗' },
  { display: '😎 ⛰️ 🧗 🐼 🍹' },
  { display: '🤩 🏙️ 🏀 🏟️ 🍔' },
  { display: '🤣 🌈 ⚽️ 🦊 🍺' },
  { display: '😊 🍁 🏸 🐱 🥛' },
  { display: '😍 🌅 🎾 🏛️ ☕️' },
  { display: '🥳 🏕️ ⛳️ 🪁 🥤' },
  { display: '😇 🌳 🚶 🦄 🍓' },
  { display: '🤗 🌃 🕺 🎸 🍰' },
  { display: '😴 🌧️ 🧘 ☂️ 🫖' },
  { display: '😤 🏜️ 🏃‍♂️ 🐎 🍗' },
  { display: '😢 ❄️ ⛷️ ☃️ 🍲' },
  { display: '✨ 🗻 🚴‍♀️ 📷 🍉' },
  { display: '🤩 🏛️ 🏓 🖼️ 🥟' },
  { display: '😌 🌿 🚴 🐢 🍇' },
  { display: '😊 🏞️ 🧗‍♂️ 🌻 🍦' },
  { display: '😎 🌊 🏄 🦈 🧃' },
  { display: '🥰 🌅 🧘‍♀️ 💐 🍣' },
  { display: '🤣 🏙️ 🏀 🚗 🥂' },
  { display: '😍 ⛰️ 🚶‍♀️ 🏯 🍧' },
  { display: '🥳 🌈 ⚽️ ✈️ 🍊' },
  { display: '😄 🌸 🏸 🦚 🍒' },
]

Page({
  data: {
    palette: PALETTE,
    templates: TEMPLATES,
    selectedColorIndex: 0,
    selectedTemplateId: 9 as 4 | 6 | 9,
    moodGroups: MOOD_GROUPS,
    selectedMoodGroupIndex: 0,
    uploadedImages: [] as string[],
    slots: [] as ImageSlot[],
    composedImagePath: '',
    nowLabel: '',
    privacyPopupVisible: false,
    pendingPrivacyAction: '' as '' | 'choose' | 'pick' | 'save',
    pendingSlotIndex: -1,
    swapSourceIndex: -1,
    cloudUnavailableWarned: false,
    uploading: false,
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

  onPickMoodGroup(e: WechatMiniprogram.CustomEvent) {
    const index = Number(e.detail.value)
    this.setData({ selectedMoodGroupIndex: index })
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
    if (this.data.uploading) {
      return
    }
    if (!this.ensurePrivacyConsent('choose')) {
      return
    }
    wx.setStorageSync('latestCity', '')
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
      this.setData({ uploading: true })
      const res = await wx.chooseMedia({
        count: chooseCount,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original'],
      })

      const pickedPaths = res.tempFiles.map((file) => file.tempFilePath)
      const safePaths: string[] = []
      let riskCount = 0
      let errorCount = 0

      for (let i = 0; i < pickedPaths.length; i += 1) {
        wx.showLoading({
          title: `图片正在上传中 ${i + 1}/${pickedPaths.length}`,
          mask: true,
        })
        // eslint-disable-next-line no-await-in-loop
        void this.tryResolveCityFromExif(pickedPaths[i])
        // eslint-disable-next-line no-await-in-loop
        const compressed = await this.compressImageHalf(pickedPaths[i])
        // eslint-disable-next-line no-await-in-loop
        const check = await this.checkImageSafe(compressed)
        if (check === true) {
          safePaths.push(compressed)
        } else if (check === false) {
          riskCount += 1
        } else {
          errorCount += 1
        }

        // Progressive UI update to feel responsive.
        const nextCurrent = [...current]
        if (emptyIndexes.length > 0) {
          safePaths.forEach((path, idx) => {
            if (idx < emptyIndexes.length) {
              nextCurrent[emptyIndexes[idx]] = path
            }
          })
        } else {
          for (let k = 0; k < template.id; k += 1) {
            nextCurrent[k] = safePaths[k] || nextCurrent[k] || ''
          }
        }
        const nextImages = nextCurrent.slice(0, template.id)
        this.setData({
          uploadedImages: nextImages,
          slots: this.buildSlots(nextImages, template.id),
          composedImagePath: '',
        })
      }

      if (!safePaths.length) {
        wx.showToast({ title: '未检测到可用图片', icon: 'none' })
        return
      }

      if (emptyIndexes.length > 0) {
        safePaths.forEach((path, idx) => {
          if (idx < emptyIndexes.length) {
            current[emptyIndexes[idx]] = path
          }
        })
      } else {
        for (let i = 0; i < template.id; i += 1) {
          current[i] = safePaths[i] || current[i] || ''
        }
      }

      const nextImages = current.slice(0, template.id)
      this.setData({
        uploadedImages: nextImages,
        slots: this.buildSlots(nextImages, template.id),
        composedImagePath: '',
      })

      if (riskCount > 0 || errorCount > 0) {
        const parts: string[] = []
        if (riskCount > 0) parts.push(`${riskCount}张风险`)
        if (errorCount > 0) parts.push(`${errorCount}张失败`)
        wx.showToast({ title: `已跳过${parts.join('、')}`, icon: 'none' })
      }
    } catch (error) {
      const err = error as { errMsg?: string }
      if (err.errMsg && err.errMsg.includes('cancel')) {
        return
      }
      wx.showToast({ title: '选择图片失败', icon: 'none' })
    } finally {
      try {
        wx.hideLoading()
      } catch (e) {
        // ignore
      }
      this.setData({ uploading: false })
    }
  },

  async onPickSlotImage(e: WechatMiniprogram.CustomEvent) {
    if (this.data.uploading) {
      return
    }
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
      wx.setStorageSync('latestCity', '')
      this.setData({ uploading: true })
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original'],
      })
      const firstFile = res.tempFiles[0]
      const picked = firstFile ? firstFile.tempFilePath : ''
      if (!picked) {
        return
      }
      wx.showLoading({ title: '图片正在上传中', mask: true })
      const compressed = await this.compressImageHalf(picked)
      void this.tryResolveCityFromExif(picked)
      const check = await this.checkImageSafe(compressed)
      if (check === false) {
        wx.showToast({ title: '图片包含风险内容，无法使用', icon: 'none' })
        return
      }
      if (check === null) {
        wx.showToast({ title: '图片安全校验失败，请稍后重试', icon: 'none' })
        return
      }
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
    } finally {
      try {
        wx.hideLoading()
      } catch (e) {
        // ignore
      }
      this.setData({ uploading: false })
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

  async ensureCloudAvailable(): Promise<boolean> {
    const wxAny = wx as WechatMiniprogram.Wx & {
      cloud?: {
        uploadFile?: (options: {
          cloudPath: string
          filePath: string
        }) => Promise<{ fileID: string }>
        callFunction?: (options: {
          name: string
          data?: unknown
        }) => Promise<{ result?: unknown }>
        deleteFile?: (options: { fileList: string[] }) => Promise<unknown>
      }
    }
    if (wxAny.cloud && wxAny.cloud.uploadFile && wxAny.cloud.callFunction) {
      return true
    }
    if (!this.data.cloudUnavailableWarned) {
      this.setData({ cloudUnavailableWarned: true })
      wx.showModal({
        title: '功能暂不可用',
        content: '图片安全校验服务未启用，请在开发者工具配置云开发后重试。',
        showCancel: false,
      })
    }
    return false
  },

  async filterSafeImagePaths(paths: string[]): Promise<string[]> {
    const safePaths: string[] = []
    let hadError = false
    for (let i = 0; i < paths.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await this.checkImageSafe(paths[i])
      if (ok === true) {
        safePaths.push(paths[i])
      } else if (ok === null) {
        hadError = true
      }
    }
    if (hadError) {
      wx.showToast({ title: '部分图片校验失败，已跳过', icon: 'none' })
    }
    return safePaths
  },

  async checkImageSafe(filePath: string): Promise<true | false | null> {
    const available = await this.ensureCloudAvailable()
    if (!available) {
      return null
    }

    const wxAny = wx as WechatMiniprogram.Wx & {
      cloud?: {
        uploadFile: (options: {
          cloudPath: string
          filePath: string
        }) => Promise<{ fileID: string }>
        callFunction: (options: {
          name: string
          data?: unknown
        }) => Promise<{ result?: unknown }>
        deleteFile?: (options: { fileList: string[] }) => Promise<unknown>
      }
    }

    if (!wxAny.cloud) {
      return null
    }

    const cloudPath = `content-security/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    let fileID = ''
    try {
      const compressed = await this.compressImageToLimit(filePath, 900 * 1024)
      if (!compressed) {
        wx.showToast({ title: '图片过大，无法校验', icon: 'none' })
        return null
      }
      const uploadRes = await wxAny.cloud.uploadFile({
        cloudPath,
        filePath: compressed,
      })
      fileID = uploadRes.fileID

      const envVersion =
        wx.getAccountInfoSync &&
        wx.getAccountInfoSync().miniProgram &&
        wx.getAccountInfoSync().miniProgram.envVersion
      const debug = envVersion !== 'release'
      const existingCity = wx.getStorageSync('latestCity')
      const needCity = !existingCity

      const callRes = await wxAny.cloud.callFunction({
        name: 'ColorWalk',
        data: { fileID, debug, needCity },
      })
      const result = (callRes.result || {}) as SecurityCheckResult
      if (result.ok && result.city && needCity) {
        wx.setStorageSync('latestCity', result.city)
      }
      if (!result.ok) {
        if (debug) {
          console.warn('[ColorWalk] security check failed', result)
        }
        if (result.kind === 'risk') {
          return false
        }
        return null
      }
      return true
    } catch (error) {
      if (debug) {
        console.warn('[ColorWalk] security check call error', error)
      }
      return null
    } finally {
      if (fileID && wxAny.cloud.deleteFile) {
        try {
          await wxAny.cloud.deleteFile({ fileList: [fileID] })
        } catch (e) {
          // ignore cleanup failures
        }
      }
    }
  },

  async tryResolveCityFromExif(originalFilePath: string): Promise<void> {
    const existingCity = wx.getStorageSync('latestCity')
    if (existingCity) {
      return
    }

    const gps = await this.extractGpsFromJpeg(originalFilePath)
    if (!gps) {
      return
    }

    const wxAny = wx as WechatMiniprogram.Wx & {
      cloud?: {
        callFunction?: (options: {
          name: string
          data?: unknown
        }) => Promise<{ result?: unknown }>
      }
    }
    if (!wxAny.cloud || !wxAny.cloud.callFunction) {
      return
    }

    const envVersion =
      wx.getAccountInfoSync &&
      wx.getAccountInfoSync().miniProgram &&
      wx.getAccountInfoSync().miniProgram.envVersion
    const debug = envVersion !== 'release'

    try {
      const callRes = await wxAny.cloud.callFunction({
        name: 'ColorWalk',
        data: { action: 'reverseGeocode', lat: gps.lat, lon: gps.lon, debug },
      })
      const result = (callRes.result || {}) as ReverseGeocodeResult
      if (result.ok && result.city) {
        wx.setStorageSync('latestCity', result.city)
      }
    } catch (e) {
      // ignore
    }
  },

  extractGpsFromJpeg(filePath: string): Promise<{ lat: number; lon: number } | null> {
    return new Promise((resolve) => {
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath,
        success: (res) => {
          const buf = res.data as ArrayBuffer
          const view = new DataView(buf)
          const u8 = new Uint8Array(buf)

          if (u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) {
            resolve(null)
            return
          }

          let offset = 2
          const len = u8.length
          const readU16BE = (off: number) => view.getUint16(off, false)
          const readU32 = (off: number, le: boolean) => view.getUint32(off, le)
          const readU16 = (off: number, le: boolean) => view.getUint16(off, le)
          const readAscii = (off: number, l: number) =>
            String.fromCharCode(...u8.slice(off, off + l))
          const readRational = (off: number, le: boolean) => {
            const num = readU32(off, le)
            const den = readU32(off + 4, le)
            if (!den) return 0
            return num / den
          }

          while (offset + 4 < len) {
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
              if (dirOff + 2 > len) {
                resolve(null)
                return
              }
              const entries = readU16(dirOff, le)
              dirOff += 2

              let gpsPtr = 0
              for (let i = 0; i < entries; i += 1) {
                const entryOff = dirOff + i * 12
                if (entryOff + 12 > len) break
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
              if (gpsOff + 2 > len) {
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
                if (entryOff + 12 > len) break
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
              if (latBase + 24 > len || lonBase + 24 > len) {
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

  getFileSize(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      wx.getFileInfo({
        filePath,
        success: (res) => resolve(res.size),
        fail: () => resolve(Number.MAX_SAFE_INTEGER),
      })
    })
  },

  compressWithQuality(src: string, quality: number): Promise<string> {
    return new Promise((resolve) => {
      wx.compressImage({
        src,
        quality,
        success: (res) => resolve(res.tempFilePath),
        fail: () => resolve(''),
      })
    })
  },

  resizeImageToMaxSide(src: string, maxSide: number): Promise<string> {
    return new Promise((resolve) => {
      wx.getImageInfo({
        src,
        success: (info) => {
          const width = info.width || 0
          const height = info.height || 0
          if (!width || !height) {
            resolve(src)
            return
          }

          const maxDim = Math.max(width, height)
          if (maxDim <= maxSide) {
            resolve(src)
            return
          }

          const ratio = maxSide / maxDim
          const targetW = Math.max(1, Math.round(width * ratio))
          const targetH = Math.max(1, Math.round(height * ratio))

          const ctx = wx.createCanvasContext('resizeCanvas', this)
          ctx.clearRect(0, 0, maxSide, maxSide)
          ctx.drawImage(src, 0, 0, targetW, targetH)
          ctx.draw(false, () => {
            wx.canvasToTempFilePath(
              {
                canvasId: 'resizeCanvas',
                width: targetW,
                height: targetH,
                destWidth: targetW,
                destHeight: targetH,
                fileType: 'jpg',
                quality: 0.9,
                success: (res) => resolve(res.tempFilePath || src),
                fail: () => resolve(src),
              },
              this,
            )
          })
        },
        fail: () => resolve(src),
      })
    })
  },

  async compressImageToLimit(src: string, maxBytes: number): Promise<string> {
    const originalSize = await this.getFileSize(src)
    if (originalSize <= maxBytes) {
      return src
    }

    // Downscale large photos first to speed up upload and reduce OpenAPI payload.
    // wx.compressImage only adjusts quality and may keep dimensions.
    const resized = await this.resizeImageToMaxSide(src, 1080)
    const resizedSize = await this.getFileSize(resized)
    if (resized && resizedSize <= maxBytes) {
      return resized
    }

    const qualities = [60, 45, 30, 20]
    let current = resized || src
    for (let i = 0; i < qualities.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const next = await this.compressWithQuality(current, qualities[i])
      if (!next) {
        break
      }
      current = next
      // eslint-disable-next-line no-await-in-loop
      const size = await this.getFileSize(current)
      if (size <= maxBytes) {
        return current
      }
    }

    return ''
  },

  async compressImageHalf(src: string): Promise<string> {
    const compressed = await this.compressImageToLimit(src, 900 * 1024)
    return compressed || src
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
    const moodDisplay = (this.data.moodGroups[this.data.selectedMoodGroupIndex] || MOOD_GROUPS[0]).display
    wx.setStorageSync('latestMoodDisplay', moodDisplay)

    const ctx = wx.createCanvasContext('composeCanvas', this)
    const canvasWidth = 1080
    const canvasHeight = 1440
    const padding = Math.floor(52 * 0.8)
    const selected = PALETTE[this.data.selectedColorIndex]

    ctx.setFillStyle(selected.hex)
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    const titleY = Math.floor(120 * 0.8) - 8
    ctx.setFillStyle('#111111')
    ctx.setFontSize(54)
    ctx.setTextAlign('left')
    ctx.fillText('COLOR WALK', padding, titleY)

    const moodY = titleY + 40
    ctx.setFillStyle('#666666')
    ctx.setFontSize(24)
    ctx.fillText(this.data.nowLabel, padding, moodY)
    const city = wx.getStorageSync('latestCity')
    if (typeof city === 'string' && city) {
      ctx.setTextAlign('right')
      ctx.fillText(`📍 ${city}`, canvasWidth - padding, moodY)
      ctx.setTextAlign('left')
    }

    const cardW = 170
    const cardH = Math.floor(60 * 0.8)
    const cardY = titleY + 67
    ctx.setFillStyle('rgba(255, 255, 255, 0.84)')
    ctx.fillRect(padding, cardY, cardW, cardH)
    ctx.setFillStyle(selected.hex)
    ctx.fillRect(padding + 10, cardY + 9, 30, 30)
    ctx.setFillStyle('#111')
    ctx.setFontSize(22)
    ctx.fillText(selected.name, padding + 50, cardY + 34)

    ctx.setFillStyle('rgba(0, 0, 0, 0.55)')
    ctx.setFontSize(24)
    ctx.fillText('心情', padding + cardW + 88, cardY + 32)
    ctx.setFillStyle('#111111')
    ctx.setFontSize(24)
    ctx.fillText(moodDisplay, padding + cardW + 148, cardY + 32)

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
