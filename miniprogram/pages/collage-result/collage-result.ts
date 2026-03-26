Page({
  data: {
    imagePath: '',
    templateId: 9,
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

  async onSaveImage() {
    if (!this.data.imagePath) {
      wx.showToast({ title: '暂无可保存图片', icon: 'none' })
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
})
