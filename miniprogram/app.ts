// app.ts
App<IAppOption>({
  globalData: {
    cloudAvailable: false,
  },
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        console.log(res.code)
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      },
    })

    const wxAny = wx as WechatMiniprogram.Wx & {
      cloud?: {
        DYNAMIC_CURRENT_ENV?: string
        init?: (options?: { env?: string; traceUser?: boolean }) => void
      }
    }
    if (wxAny.cloud && wxAny.cloud.init) {
      wxAny.cloud.init({
        env: wxAny.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true,
      })
      this.globalData.cloudAvailable = true
    }
  },
})
