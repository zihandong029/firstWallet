const fs = require("fs")
const path = require("path")

// 构建后修复 manifest.json
function fixManifest() {
  // 尝试两个可能的路径
  const possiblePaths = [
    path.join(__dirname, "build", "chrome-mv3-dev", "manifest.json"),
    path.join(__dirname, "build", "chrome-mv3-prod", "manifest.json")
  ]

  let manifestPath = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      manifestPath = p
      break
    }
  }

  if (!manifestPath) {
    console.log("manifest.json not found in build directory")
    return
  }

  console.log("Found manifest at:", manifestPath)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

  // 确保包含 inject.js 在 web_accessible_resources 中
  if (!manifest.web_accessible_resources) {
    manifest.web_accessible_resources = []
  }

  // 查找现有的条目
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

  // 如果没找到，创建新条目
  if (!found) {
    manifest.web_accessible_resources.push({
      matches: ["<all_urls>"],
      resources: ["inject.js"]
    })
  }

  // 确保包含 http 权限
  if (!manifest.host_permissions.includes("http://*/*")) {
    manifest.host_permissions.push("http://*/*")
  }

  // 写回文件
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(
    "✅ manifest.json fixed - inject.js added to web_accessible_resources"
  )

  // 确保 inject.js 文件存在于构建目录
  const injectPath = path.join(path.dirname(manifestPath), "inject.js")
  const possibleSources = [
    path.join(__dirname, "assets", "inject.js"),
    path.join(__dirname, "public", "inject.js")
  ]
  
  let sourceInjectPath = null
  for (const source of possibleSources) {
    if (fs.existsSync(source)) {
      sourceInjectPath = source
      break
    }
  }
  
  if (!fs.existsSync(injectPath) && sourceInjectPath) {
    fs.copyFileSync(sourceInjectPath, injectPath)
    console.log("✅ inject.js copied to build directory from:", sourceInjectPath)
  } else if (!sourceInjectPath) {
    console.log("⚠️ Warning: inject.js source file not found")
  } else {
    console.log("ℹ️ inject.js already exists in build directory")
  }
}

fixManifest()
