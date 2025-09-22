import injectMyWallet from "./injected-helper"

const inject = async (tabId: number) => {
  try {
    await chrome.scripting.executeScript(
      {
        target: {
          tabId
        },
        world: "MAIN", // MAIN in order to access the window object
        func: injectMyWallet
      }
    )
    console.log("✅ Background script: myWallet 注入完成")
  } catch (error) {
    console.error("❌ Background script: 注入失败", error)
  }
}

// 监听来自 content script 的消息
const handleContentScriptMessage = async (tabId: number, message: any, sender: any) => {
  if (message.type === 'WALLET_CONNECT_REQUEST' && message.source === 'contentScript') {
    console.log("📨 Background script 收到来自 content script 的连接请求")
    
    try {
      // 获取发送方的信息
      const origin = message.origin || 'unknown'
      
      // 保存待处理的连接请求
      await chrome.storage.local.set({
        pendingConnectRequest: {
          tabId: tabId,
          origin: origin,
          timestamp: Date.now()
        }
      })
      
      console.log("💾 已保存连接请求到存储")
      
      // 尝试打开扩展弹窗
      try {
        await chrome.action.openPopup()
        console.log("🔔 已打开扩展弹窗")
      } catch (popupError) {
        console.warn("⚠️ 无法自动打开弹窗，用户需要手动点击扩展图标")
        
        // 设置扩展图标徽章提醒用户
        await chrome.action.setBadgeText({
          text: "1",
          tabId: tabId
        })
        await chrome.action.setBadgeBackgroundColor({
          color: "#FF0000"
        })
      }
      
    } catch (error) {
      console.error("❌ 处理连接请求失败:", error)
      
      // 向 content script 发送失败响应
      chrome.tabs.sendMessage(tabId, {
        type: 'WALLET_CONNECT_RESPONSE',
        success: false,
        error: "扩展内部错误"
      })
    }
  }
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab && sender.tab.id) {
    handleContentScriptMessage(sender.tab.id, message, sender)
  }
})

// 在页面更新时注入
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只在页面完成加载时注入
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    console.log("🔄 页面加载完成，开始注入 myWallet:", tab.url)
    inject(tabId)
  }
})

// 在标签页激活时也注入（备用机制）
chrome.tabs.onActivated.addListener((e) => {
  chrome.tabs.get(e.tabId, (tab) => {
    if (tab.url && !tab.url.startsWith('chrome://')) {
      console.log("🔄 标签页激活，注入 myWallet:", tab.url)
      inject(e.tabId)
    }
  })
})