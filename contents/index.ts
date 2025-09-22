import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start",
  all_frames: true
}

// Prevent duplicate injection flag
let injected = false

// Inject EIP-6963 provider
function injectProvider() {
  if (injected) {
    console.log("⚠️ [Content Script] Provider already injected, skipping duplicate injection")
    return
  }

  console.log("🎯 [Content Script] Starting EIP-6963 provider injection...")
  console.log("📍 [Content Script] Current page:", window.location.href)

  try {
    // Use chrome.runtime.getURL to get inject file URL
    const injectUrl = chrome.runtime.getURL("inject.js")
    console.log("🔗 [Content Script] Inject URL:", injectUrl)

    // Create and inject script tag
    const script = document.createElement("script")
    script.src = injectUrl
    script.type = "text/javascript"
    script.defer = false
    script.async = false

    script.onload = () => {
      console.log("✅ [Content Script] Inject script loaded successfully")
      injected = true
    }

    script.onerror = (error) => {
      console.error("❌ [Content Script] Inject script failed to load:", error)
    }

    // Inject to page head
    ;(document.head || document.documentElement).appendChild(script)

    console.log("🚀 [Content Script] Inject script tag inserted")
  } catch (error) {
    console.error("💥 [Content Script] Error injecting script:", error)
  }
}

// 监听来自页面的 EIP-6963 请求
window.addEventListener(
  "message",
  (event) => {
    // 检查消息来源和类型
    if (
      event.source !== window ||
      !event.data.type ||
      event.data.type !== "EIP6963_REQUEST"
    ) {
      return
    }

    console.log("📨 [Content Script] 收到 EIP-6963 请求:", event.data)

    // 转发到 background script
    chrome.runtime.sendMessage(
      {
        type: "EIP6963_PROVIDER_REQUEST",
        method: event.data.method,
        params: event.data.params,
        id: event.data.id,
        origin: event.data.origin
      },
      (response) => {
        console.log("📬 [Content Script] 收到 background 响应:", response)

        // 转发响应到页面
        window.postMessage(
          {
            type: "EIP6963_RESPONSE",
            id: event.data.id,
            result: response?.result,
            error: response?.error
          },
          "*"
        )
      }
    )
  },
  false
)

// 只在合适的时机注入一次
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectProvider)
} else {
  injectProvider()
}

console.log("🔌 [Content Script] EIP-6963 内容脚本已加载")
