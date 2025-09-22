import { defineConfig } from "plasmo"

export default defineConfig({
  // 添加Node.js polyfill配置
  define: {
    global: "globalThis"
  },
  resolve: {
    alias: {
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      assert: "assert",
      util: "util",
      buffer: "buffer"
    }
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        globals: {
          crypto: "crypto",
          assert: "assert",
          util: "util",
          stream: "stream",
          buffer: "Buffer"
        }
      }
    }
  },
  // 更新 manifest 配置
  manifest: (manifest) => {
    // 保留 Plasmo 的默认配置，然后添加我们的自定义配置
    manifest.name = "Simple Crypto Wallet"
    manifest.description =
      "A simple and secure EIP-6963 compatible crypto wallet extension"
    manifest.version = "1.0.0"
    manifest.permissions = ["storage", "activeTab"]
    manifest.host_permissions = ["https://*/*", "http://*/*"]

    // 确保 web_accessible_resources 包含 inject.js
    if (!manifest.web_accessible_resources) {
      manifest.web_accessible_resources = []
    }

    // 查找现有的 web_accessible_resources 条目并添加 inject.js
    let found = false
    for (const resource of manifest.web_accessible_resources) {
      if (resource.matches && resource.matches.includes("<all_urls>")) {
        if (!resource.resources.includes("inject.js")) {
          resource.resources.push("inject.js")
        }
        found = true
        break
      }
    }

    // 如果没有找到匹配的条目，创建一个新的
    if (!found) {
      manifest.web_accessible_resources.push({
        matches: ["<all_urls>"],
        resources: ["inject.js"]
      })
    }

    return manifest
  }
})
