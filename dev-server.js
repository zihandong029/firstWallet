const http = require("http")
const fs = require("fs")
const path = require("path")
const url = require("url")

// 端口配置
const PORT = 3000

// MIME 类型映射
const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url)
  let pathname = parsedUrl.pathname

  // 默认页面
  if (pathname === "/") {
    pathname = "/test-eip6963-debug.html"
  }

  // 构建文件路径
  const filePath = path.join(__dirname, pathname)

  // 获取文件扩展名
  const extname = path.extname(filePath).toLowerCase()
  const contentType = mimeTypes[extname] || "text/plain"

  console.log(`📥 [服务器] 请求: ${req.method} ${pathname}`)

  // 检查文件是否存在
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.log(`❌ [服务器] 文件不存在: ${filePath}`)
      res.writeHead(404, { "Content-Type": "text/html" })
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>404 - 文件未找到</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f5f5f5; 
            }
            .error-container {
              background: white;
              border-radius: 8px;
              padding: 40px;
              display: inline-block;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #e74c3c; }
            a { color: #3498db; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>404 - 文件未找到</h1>
            <p>请求的文件不存在: <code>${pathname}</code></p>
            <p><a href="/">返回首页</a></p>
          </div>
        </body>
        </html>
      `)
      return
    }

    // 读取文件
    fs.readFile(filePath, (err, content) => {
      if (err) {
        console.log(`❌ [服务器] 读取文件失败: ${err.message}`)
        res.writeHead(500, { "Content-Type": "text/html" })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>500 - 服务器错误</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px; 
                background: #f5f5f5; 
              }
              .error-container {
                background: white;
                border-radius: 8px;
                padding: 40px;
                display: inline-block;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              h1 { color: #e74c3c; }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1>500 - 服务器内部错误</h1>
              <p>读取文件时发生错误</p>
            </div>
          </body>
          </html>
        `)
        return
      }

      console.log(`✅ [服务器] 成功响应: ${pathname} (${content.length} bytes)`)

      // 设置CORS头部（允许扩展访问）
      res.writeHead(200, {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Cache-Control": "no-cache"
      })

      res.end(content)
    })
  })
})

// 启动服务器
server.listen(PORT, () => {
  console.log("🚀 [服务器] HTTP服务器启动成功!")
  console.log(`📍 [服务器] 地址: http://localhost:${PORT}`)
  console.log(
    `🔗 [服务器] 测试页面: http://localhost:${PORT}/test-eip6963-debug.html`
  )
  console.log("")
  console.log("📝 [说明] 可用的路由:")
  console.log("   / ────────────── 默认跳转到测试页面")
  console.log("   /test-eip6963-debug.html ── EIP-6963 钱包测试页面")
  console.log("")
  console.log("⚡ [提示] 按 Ctrl+C 停止服务器")
  console.log("")
})

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n💫 [服务器] 正在关闭服务器...")
  server.close(() => {
    console.log("✅ [服务器] 服务器已关闭")
    process.exit(0)
  })
})

// 错误处理
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`❌ [服务器] 端口 ${PORT} 已被占用!`)
    console.log("💡 [建议] 请尝试以下解决方案:")
    console.log(`   1. 关闭占用端口 ${PORT} 的其他程序`)
    console.log(`   2. 修改此文件中的 PORT 变量为其他端口号`)
  } else {
    console.log(`❌ [服务器] 启动失败: ${err.message}`)
  }
  process.exit(1)
})

// 监听未捕获的异常
process.on("uncaughtException", (err) => {
  console.log(`💥 [服务器] 未捕获的异常: ${err.message}`)
  process.exit(1)
})
