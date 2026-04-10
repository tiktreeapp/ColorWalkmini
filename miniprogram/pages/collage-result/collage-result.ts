Page({
  data: {
    imagePath: '',
    templateId: 9,
    privacyPopupVisible: false,
  },

  onLoad() {
    const path = wx.getStorageSync('latestComposedImagePath')
    const templateId = wx.getStorageSync('latestTemplateId')
    if (typeof templateId === 'number') {
      this.setData({ templateId })
    }
    if (typeof path === 'string' && path) {
      this.setData({ imagePath: path })
    }
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
    wx.setStorageSync('privacyConsentAccepted', true)
    this.setData({ privacyPopupVisible: false })
    void this.doSaveImage()
  },

  onDeclinePrivacy() {
    this.setData({ privacyPopupVisible: false })
    wx.showToast({ title: '需要同意隐私指引后才能继续', icon: 'none' })
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
    const accepted = wx.getStorageSync('privacyConsentAccepted')
    if (!accepted) {
      this.setData({ privacyPopupVisible: true })
      return
    }
    await this.doSaveImage()
  },

  async doSaveImage() {
    if (!this.data.imagePath) {
      wx.showToast({ title: '暂无可保存图片', icon: 'none' })
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
      await wx.saveImageToPhotosAlbum({ filePath: this.data.imagePath })
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error) {
      wx.showModal({
        title: '保存失败',
        content: '请在设置中开启相册权限后再试',
        showCancel: false,
      })
    }
  },

  onShareAppMessage() {
    const imagePath = this.data.imagePath
    return {
      title: '分享我的 ColorWalk 拼图',
      path: '/pages/collage/collage',
      imageUrl: imagePath,
    }
  },
})
