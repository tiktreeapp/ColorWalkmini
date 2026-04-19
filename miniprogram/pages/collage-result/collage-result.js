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
      this.setData({ templateId: templateId })
    }
    if (typeof path === 'string' && path) {
      this.setData({ imagePath: path })
    }
  },

  onOpenPrivacyContract() {
    const wxAny = wx
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
    this.doSaveImage()
  },

  onDeclinePrivacy() {
    this.setData({ privacyPopupVisible: false })
    wx.showToast({ title: '需要同意隐私指引后才能继续', icon: 'none' })
  },

  requestAlbumPermission() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (setting) => {
          const authSetting = setting.authSetting || {}
          if (authSetting['scope.writePhotosAlbum']) {
            resolve(true)
            return
          }
          if (authSetting['scope.writePhotosAlbum'] === false) {
            wx.openSetting({
              success: (openRes) => {
                resolve(!!openRes.authSetting['scope.writePhotosAlbum'])
              },
              fail: () => resolve(false),
            })
            return
          }
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => resolve(true),
            fail: () => {
              wx.openSetting({
                success: (openRes) => {
                  resolve(!!openRes.authSetting['scope.writePhotosAlbum'])
                },
                fail: () => resolve(false),
              })
            },
          })
        },
        fail: () => resolve(false),
      })
    })
  },

  onSaveImage() {
    const accepted = wx.getStorageSync('privacyConsentAccepted')
    if (!accepted) {
      this.setData({ privacyPopupVisible: true })
      return
    }
    this.doSaveImage()
  },

  doSaveImage() {
    if (!this.data.imagePath) {
      wx.showToast({ title: '暂无可保存图片', icon: 'none' })
      return
    }
    this.requestAlbumPermission().then((granted) => {
      if (!granted) {
        wx.showModal({
          title: '需要相册权限',
          content: '请先允许保存到相册，才能保存拼图图片。',
          showCancel: false,
        })
        return
      }
      wx.saveImageToPhotosAlbum({
        filePath: this.data.imagePath,
        success: () => {
          wx.showToast({ title: '已保存到相册', icon: 'success' })
        },
        fail: () => {
          wx.showModal({
            title: '保存失败',
            content: '请在设置中开启相册权限后再试',
            showCancel: false,
          })
        },
      })
    })
  },

})
