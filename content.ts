// 注入钱包提供者到页面
const injectProvider = () => {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('inject.js')
  script.onload = function() {
    script.remove()
  }
  ;(document.head || document.documentElement).appendChild(script)
}

// 监听来自页面的消息
window.addEventListener('message', async (event) => {
  if (event.source !== window || !event.data.type || event.data.type !== 'WALLET_REQUEST') {
    return
  }

  const { method, params, id } = event.data

  try {
    // 发送请求到后台脚本
    const response = await chrome.runtime.sendMessage({
      type: 'WALLET_REQUEST',
      method,
      params,
      id
    })

    // 将响应发送回页面
    window.postMessage({
      type: 'WALLET_RESPONSE',
      id,
      result: response.result,
      error: response.error
    }, '*')
  } catch (error) {
    window.postMessage({
      type: 'WALLET_RESPONSE',
      id,
      error: error.message
    }, '*')
  }
})

// 页面加载完成后注入提供者
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectProvider)
} else {
  injectProvider()
} 