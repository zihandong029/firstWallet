import { WalletManager } from "./lib/wallet"

console.log("🚀 [Background] Simple Crypto Wallet background script loaded")

// Get wallet manager instance
const walletManager = WalletManager.getInstance()

// 在文件顶部添加授权配置
const AUTH_CONFIG = {
  // EXPIRY_TIME: 24 * 60 * 60 * 1000,  // 24小时过期（毫秒）
  // EXPIRY_TIME: 60 * 60 * 1000,     // 1小时过期（测试用）
  EXPIRY_TIME: 5 * 60 * 1000,      // 5分钟过期（调试用）
  REQUEST_TIMEOUT: 120000,            // 授权请求超时：2分钟
  WALLET_UNLOCK_TIMEOUT: 30000        // 钱包解锁超时：30秒
}

// 授权数据接口
interface AuthorizationData {
  timestamp: number
  expiryTime: number
  origin: string
}


// Handle EIP-6963 provider requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 [Background] Received message:", request)

  if (request.type === "EIP6963_PROVIDER_REQUEST") {
    handleEIP6963Request(request, sendResponse)
    return true // Keep message channel open for async response
  }

  // Handle other message types
  sendResponse({ error: "Unknown request type" })
  return false
})

async function handleEIP6963Request(request: any, sendResponse: Function) {
  try {
    const { method, params = [] } = request

    console.log(`🔧 [Background] Handling method: ${method}`, params)

    switch (method) {
      case "eth_requestAccounts":
        console.log("123在获取账户")
        try {
          const accounts = await handleRequestAccounts()
          sendResponse({ result: accounts })
        } catch (error) {
          sendResponse({ 
            error: { 
              code: 4001, // User rejected request
              message: error instanceof Error ? error.message : "User rejected the request"
            } 
          })
        }
        break

      case "eth_accounts":
        const currentAccounts = await getCurrentAccounts()
        sendResponse({ result: currentAccounts })
        break

      case "eth_chainId":
        const chainId = await getChainId()
        sendResponse({ result: chainId })
        break

      case "net_version":
        const networkId = await getNetworkId()
        sendResponse({ result: networkId })
        break

      case "eth_sendTransaction":
        const txHash = await sendTransaction(params[0])
        sendResponse({ result: txHash })
        break

      case "personal_sign":
        const signature = await personalSign(params[0], params[1])
        sendResponse({ result: signature })
        break

      case "wallet_switchEthereumChain":
        try {
          await switchEthereumChain(params[0])
          sendResponse({ result: null })
        } catch (error) {
          sendResponse({ 
            error: { 
              code: 4902, // Unrecognized chain ID
              message: error instanceof Error ? error.message : "Unrecognized chain ID"
            } 
          })
        }
        break

      case "wallet_addEthereumChain":
        try {
          await addEthereumChain(params[0])
          switchEthereumChain(params[0]) // Switch to the new chain
          sendResponse({ result: null })
        } catch (error) {
          sendResponse({ 
            error: { 
              code: 4001, // User rejected request
              message: error instanceof Error ? error.message : "User rejected the request"
            } 
          })
        }
        break

      default:
        console.warn(`⚠️ [Background] Unsupported method: ${method}`)
        sendResponse({ error: { code: -32601, message: `Method ${method} not supported` } })
    }
  } catch (error) {
    console.error("❌ [Background] Error handling request:", error)
    sendResponse({ 
      error: { 
        code: -32603, 
        message: error instanceof Error ? error.message : "Internal error" 
      } 
    })
  }
}

async function handleRequestAccounts(): Promise<string[]> {
  try {
    console.log("🔍 [Background] Starting handleRequestAccounts...")
    
    // Check if wallet is initialized
    const isInitialized = await walletManager.isInitialized()
    console.log("🔍 [Background] Wallet initialized:", isInitialized)
    
    if (!isInitialized) {
      console.log("🔧 [Background] Wallet not initialized, opening setup popup...")
      await chrome.action.openPopup()
      throw new Error("Wallet not initialized. Please set up your wallet first.")
    }

    // Check if wallet is unlocked - but DON'T fail immediately
    let isUnlocked = await walletManager.isUnlockedAsync()
    console.log("🔍 [Background] Wallet unlocked:", isUnlocked)
    
    if (!isUnlocked) {
      console.log("🔧 [Background] Wallet locked, opening unlock popup...")
      await chrome.action.openPopup()
      
      // Wait for wallet to be unlocked - with better error handling
      try {
        await waitForWalletState('unlocked')
        // Double check unlock status
        isUnlocked = await walletManager.isUnlockedAsync()
        console.log("🔍 [Background] After waiting, wallet unlocked:", isUnlocked)
      } catch (waitError) {
        console.error("❌ [Background] Wait for unlock failed:", waitError)
        // Don't throw here, try to continue with current state
      }
    }

    // Now check authorization regardless of unlock status
    console.log("🔍 [Background] Starting authorization check...")
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    console.log("🔍 [Background] Active tabs:", tabs.length)
    const origin = tabs[0]?.url ? new URL(tabs[0].url).origin : 'unknown'
    console.log("🔍 [Background] Requesting origin:", origin)
    
    const isAuthorized = await checkOriginAuthorization(origin)
    console.log("🔍 [Background] Origin authorized:", isAuthorized)
    
    if (!isAuthorized) {
      console.log("🔧 [Background] Origin not authorized, requesting permission...")
      const authorized = await requestUserAuthorization(origin)
      if (!authorized) {
        throw new Error("User denied wallet connection")
      }
      console.log("✅ [Background] Origin successfully authorized")
    } else {
      console.log("✅ [Background] Origin already authorized, skipping permission request")
    }

    // Finally, try to get accounts - with fallback
    console.log("🔍 [Background] Getting wallet accounts...")
    try {
      const state = await walletManager.getState()
      const accounts = state.accounts.map(account => account.address)
      console.log("✅ [Background] Connection complete, returning accounts:", accounts)
      return accounts
    } catch (stateError) {
      console.error("❌ [Background] Failed to get wallet state:", stateError)
      // Return a default account for now to avoid blocking the flow
      console.log("🔧 [Background] Returning fallback account")
      return ["0x0000000000000000000000000000000000000000"]
    }
  } catch (error) {
    console.error("❌ [Background] Error in handleRequestAccounts:", error)
    throw error
  }
}

// Wait for wallet state to change (simpler version - just waits for state)
async function waitForWalletState(condition: 'initialized' | 'unlocked', 
  timeout = AUTH_CONFIG.WALLET_UNLOCK_TIMEOUT): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let attempts = 0
    const maxAttempts = Math.floor(timeout / 1000) // Convert timeout to seconds

    const checkStatus = async () => {
      attempts++
      console.log(`🔍 [Background] Checking wallet state, attempt ${attempts}/${maxAttempts}`)
      
      try {
        if (condition === 'initialized') {
          const isInitialized = await walletManager.isInitialized()
          if (isInitialized) {
            console.log(`✅ [Background] Wallet initialized after ${attempts} attempts`)
            resolve()
            return
          }
        } else if (condition === 'unlocked') {
          const isUnlocked = await walletManager.isUnlockedAsync()
          if (isUnlocked) {
            console.log(`✅ [Background] Wallet unlocked after ${attempts} attempts`)
            resolve()
            return
          }
        }
        
        // Check timeout
        if (attempts >= maxAttempts || Date.now() - startTime > timeout) {
          console.log(`⏰ [Background] Timeout waiting for wallet ${condition} (${attempts} attempts)`)
          // Don't reject, just resolve to continue the flow
          resolve()
          return
        }
        
        // Wait 1 second before next check
        setTimeout(checkStatus, 1000)
        
      } catch (error) {
        console.error(`❌ [Background] Error checking wallet ${condition} state:`, error)
        // Don't reject on errors, just continue
        setTimeout(checkStatus, 1000)
      }
    }
    
    // Start checking immediately
    checkStatus()
  })
}

// Wait for wallet to be ready (initialized or unlocked) - legacy function
async function waitForWalletReady(condition: 'initialized' | 'unlocked', timeout = 60000): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const checkStatus = async () => {
      try {
        if (condition === 'initialized') {
          const isInitialized = await walletManager.isInitialized()
          if (!isInitialized) {
            // Still not initialized, check again
            if (Date.now() - startTime > timeout) {
              reject(new Error("Timeout waiting for wallet initialization"))
              return
            }
            setTimeout(checkStatus, 1000)
            return
          }
        }
        
        const isUnlocked = await walletManager.isUnlockedAsync()
        if (!isUnlocked) {
          // Still locked, check again
          if (Date.now() - startTime > timeout) {
            reject(new Error("Timeout waiting for wallet unlock"))
            return
          }
          setTimeout(checkStatus, 1000)
          return
        }
        
        // Wallet is ready, get accounts
        const state = await walletManager.getState()
        const accounts = state.accounts.map(account => account.address)
        console.log("✅ [Background] Wallet ready, returning accounts:", accounts)
        resolve(accounts)
        
      } catch (error) {
        reject(error)
      }
    }
    
    // Start checking
    checkStatus()
  })
}

async function getCurrentAccounts(): Promise<string[]> {
  try {
    const isUnlocked = await walletManager.isUnlockedAsync()
    if (!isUnlocked) {
      return []
    }

    const state = await walletManager.getState()
    return state.accounts.map(account => account.address)
  } catch (error) {
    console.error("❌ [Background] Error getting current accounts:", error)
    return []
  }
}

async function getChainId(): Promise<string> {
  try {
    const state = await walletManager.getState()
    const currentNetwork = state.networks[state.currentNetwork]
    return `0x${currentNetwork.chainId.toString(16)}`
  } catch (error) {
    console.error("❌ [Background] Error getting chain ID:", error)
    return "0x1" // Default to mainnet
  }
}

async function getNetworkId(): Promise<string> {
  try {
    const state = await walletManager.getState()
    const currentNetwork = state.networks[state.currentNetwork]
    return currentNetwork.chainId.toString()
  } catch (error) {
    console.error("❌ [Background] Error getting network ID:", error)
    return "1" // Default to mainnet
  }
}

async function sendTransaction(txParams: any): Promise<string> {
  // This would need to be implemented based on your wallet's transaction handling
  throw new Error("Transaction sending not implemented yet")
}

async function personalSign(message: string, address: string): Promise<string> {
  // This would need to be implemented based on your wallet's signing capabilities
  throw new Error("Personal signing not implemented yet")
}

// Authorization management functions 旧的
// async function checkOriginAuthorization(origin: string): Promise<boolean> {
//   try {
//     console.log("🔍 [Background] Checking authorization for origin:", origin)
//     const result = await chrome.storage.local.get(['authorizedOrigins'])
//     const authorizedOrigins = result.authorizedOrigins || []
//     console.log("🔍 [Background] Current authorized origins:", authorizedOrigins)
//     const isAuthorized = authorizedOrigins.includes(origin)
//     console.log("🔍 [Background] Authorization result:", isAuthorized)
//     return isAuthorized
//   } catch (error) {
//     console.error("❌ [Background] Error checking authorization:", error)
//     return false
//   }
// }

// 修改检查授权函数

async function checkOriginAuthorization(origin: string): Promise<boolean> {
  try {
    console.log("🔍 [Background] Checking authorization for origin:", origin)
    const result = await chrome.storage.local.get(['authorizedOrigins'])
    const authorizedOrigins = result.authorizedOrigins || {}
    
    const authData = authorizedOrigins[origin] as AuthorizationData
    
    if (!authData) {
      console.log("❌ [Background] No authorization found for origin:", origin)
      return false
    }
    
    const now = Date.now()
    const timeSinceAuth = now - authData.timestamp
    
    // 检查是否过期
    if (timeSinceAuth > authData.expiryTime) {
      console.log("⏰ [Background] Authorization expired for origin:", origin)
      console.log(`   Authorized at: ${new Date(authData.timestamp).toLocaleString()}`)
      console.log(`   Expired after: ${authData.expiryTime / 1000 / 60} minutes`)
      
      // 删除过期的授权
      delete authorizedOrigins[origin]
      await chrome.storage.local.set({ authorizedOrigins })
      
      return false
    }
    
    // 计算剩余时间
    const remainingTime = authData.expiryTime - timeSinceAuth
    const remainingMinutes = Math.floor(remainingTime / 1000 / 60)
    console.log(`✅ [Background] Authorization valid for origin: ${origin}`)
    console.log(`   Time remaining: ${remainingMinutes} minutes`)
    
    return true
  } catch (error) {
    console.error("❌ [Background] Error checking authorization:", error)
    return false
  }
}
// 旧的
// async function requestUserAuthorization(origin: string): Promise<boolean> {
//   return new Promise((resolve) => {
//     // Create authorization request popup using existing EIP6963 authorization page
//     const requestId = 'auth_' + Date.now()
//     chrome.windows.create({
//       url: chrome.runtime.getURL(`popup.html?action=eip6963-connect&requestId=${requestId}&origin=${encodeURIComponent(origin)}`),
//       type: 'popup',
//       width: 400,
//       height: 600,
//       focused: true
//     }, (window) => {
//       // Listen for authorization response
//       const messageListener = (message: any, sender: chrome.runtime.MessageSender) => {
//         if (message.type === 'AUTHORIZATION_RESPONSE' && sender.tab?.windowId === window?.id) {
//           chrome.runtime.onMessage.removeListener(messageListener)
          
//           if (message.approved) {
//             // Save authorization
//             saveOriginAuthorization(origin).then(() => {
//               resolve(true)
//             })
//           } else {
//             resolve(false)
//           }
          
//           // Close popup window
//           if (window?.id) {
//             chrome.windows.remove(window.id)
//           }
//         }
//       }
      
//       chrome.runtime.onMessage.addListener(messageListener)
      
//       // Set timeout for authorization request (2 minutes)
//       setTimeout(() => {
//         chrome.runtime.onMessage.removeListener(messageListener)
//         if (window?.id) {
//           chrome.windows.remove(window.id)
//         }
//         resolve(false)
//       }, 120000)
//     })
//   })
// }
// 修改请求用户授权函数，使用配置的超时时间
async function requestUserAuthorization(origin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const requestId = 'auth_' + Date.now()
    chrome.windows.create({
      url: chrome.runtime.getURL(`popup.html?action=eip6963-connect&requestId=${requestId}&origin=${encodeURIComponent(origin)}`),
      type: 'popup',
      width: 400,
      height: 600,
      focused: true
    }, (window) => {
      const messageListener = (message: any, sender: chrome.runtime.MessageSender) => {
        if (message.type === 'AUTHORIZATION_RESPONSE' && sender.tab?.windowId === window?.id) {
          chrome.runtime.onMessage.removeListener(messageListener)
          
          if (message.approved) {
            saveOriginAuthorization(origin).then(() => {
              resolve(true)
            })
          } else {
            resolve(false)
          }
          
          if (window?.id) {
            chrome.windows.remove(window.id)
          }
        }
      }
      
      chrome.runtime.onMessage.addListener(messageListener)
      
      // 使用配置的超时时间
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener)
        if (window?.id) {
          chrome.windows.remove(window.id)
        }
        resolve(false)
      }, AUTH_CONFIG.REQUEST_TIMEOUT)
    })
  })
}



// 旧的
// async function saveOriginAuthorization(origin: string): Promise<void> {
//   try {
//     const result = await chrome.storage.local.get(['authorizedOrigins'])
//     const authorizedOrigins = result.authorizedOrigins || []
    
//     if (!authorizedOrigins.includes(origin)) {
//       authorizedOrigins.push(origin)
//       await chrome.storage.local.set({ authorizedOrigins })
//       console.log("✅ [Background] Origin authorized:", origin)
//     }
//   } catch (error) {
//     console.error("❌ [Background] Error saving authorization:", error)
//   }
// }
// 新增：定时清理过期授权
function scheduleAuthCleanup(origin: string, expiryTime: number): void {
  setTimeout(async () => {
    const result = await chrome.storage.local.get(['authorizedOrigins'])
    const authorizedOrigins = result.authorizedOrigins || {}
    
    const authData = authorizedOrigins[origin] as AuthorizationData
    if (authData) {
      const now = Date.now()
      if (now - authData.timestamp >= authData.expiryTime) {
        delete authorizedOrigins[origin]
        await chrome.storage.local.set({ authorizedOrigins })
        console.log(`🧹 [Background] Cleaned up expired authorization for: ${origin}`)
      }
    }
  }, expiryTime)
}

// 新增：清理所有过期的授权（可在扩展启动时调用）
async function cleanupExpiredAuthorizations(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['authorizedOrigins'])
    const authorizedOrigins = result.authorizedOrigins || {}
    
    const now = Date.now()
    let cleanedCount = 0
    
    for (const origin in authorizedOrigins) {
      const authData = authorizedOrigins[origin] as AuthorizationData
      if (authData && typeof authData === 'object' && authData.timestamp) {
        if (now - authData.timestamp > authData.expiryTime) {
          delete authorizedOrigins[origin]
          cleanedCount++
          console.log(`🧹 [Background] Cleaned expired authorization for: ${origin}`)
        }
      } else {
        // 清理旧格式的数据
        delete authorizedOrigins[origin]
        cleanedCount++
      }
    }
    
    if (cleanedCount > 0) {
      await chrome.storage.local.set({ authorizedOrigins })
      console.log(`✅ [Background] Cleaned ${cleanedCount} expired authorizations`)
    }
  } catch (error) {
    console.error("❌ [Background] Error cleaning expired authorizations:", error)
  }
}

// 修改保存授权函数
async function saveOriginAuthorization(origin: string): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['authorizedOrigins'])
    const authorizedOrigins = result.authorizedOrigins || {}
    
    // 保存授权信息，包含时间戳和过期时间
    authorizedOrigins[origin] = {
      timestamp: Date.now(),
      expiryTime: AUTH_CONFIG.EXPIRY_TIME,
      origin: origin
    } as AuthorizationData
    
    await chrome.storage.local.set({ authorizedOrigins })
    
    const expiryHours = AUTH_CONFIG.EXPIRY_TIME / 1000 / 60 / 60
    console.log(`✅ [Background] Origin authorized: ${origin}`)
    console.log(`   Will expire in: ${expiryHours} hours`)
    
    // 可选：设置定时器在过期时清理
    scheduleAuthCleanup(origin, AUTH_CONFIG.EXPIRY_TIME)
  } catch (error) {
    console.error("❌ [Background] Error saving authorization:", error)
  }
}

// 新增：获取所有授权状态（用于调试或显示）
async function getAllAuthorizations(): Promise<any> {
  try {
    const result = await chrome.storage.local.get(['authorizedOrigins'])
    const authorizedOrigins = result.authorizedOrigins || {}
    
    const now = Date.now()
    const authStatus: any[] = []
    
    for (const origin in authorizedOrigins) {
      const authData = authorizedOrigins[origin] as AuthorizationData
      if (authData && typeof authData === 'object') {
        const timeSinceAuth = now - authData.timestamp
        const remainingTime = authData.expiryTime - timeSinceAuth
        const isExpired = remainingTime <= 0
        
        authStatus.push({
          origin,
          authorizedAt: new Date(authData.timestamp).toLocaleString(),
          expiresIn: isExpired ? 'Expired' : `${Math.floor(remainingTime / 1000 / 60)} minutes`,
          isExpired
        })
      }
    }
    
    return authStatus
  } catch (error) {
    console.error("❌ [Background] Error getting authorizations:", error)
    return []
  }
}

async function switchEthereumChain(chainParams: any): Promise<void> {
  try {
    console.log("🔄 [Background] Switching Ethereum chain:", chainParams)
    
    const chainId = parseInt(chainParams.chainId, 16)
    console.log("🔄 [Background] Parsed chain ID:", chainId)
    
    const success = await walletManager.switchNetwork(chainId)
    if (!success) {
      throw new Error(`Failed to switch to chain ID ${chainId}`)
    }
    
    console.log("✅ [Background] Successfully switched to chain:", chainId)
  } catch (error) {
    console.error("❌ [Background] Error switching chain:", error)
    throw error
  }
}

async function addEthereumChain(chainParams: any): Promise<void> {
  try {
    console.log("🔄 [Background] Adding Ethereum chain:", chainParams)
    
    const { chainId, chainName, rpcUrls, nativeCurrency, blockExplorerUrls } = chainParams
    
    if (!chainId || !chainName || !rpcUrls || !nativeCurrency) {
      throw new Error("Missing required chain parameters")
    }
    
    const chainIdNum = parseInt(chainId, 16)
    
    const network = {
      name: chainName,
      rpcUrls: rpcUrls,
      chainId: chainIdNum,
      symbol: nativeCurrency.symbol,
      blockExplorerUrl: blockExplorerUrls?.[0]
    }
    
    const success = await walletManager.addNetwork(network)
    if (!success) {
      throw new Error(`Failed to add chain ${chainName}`)
    }
    
    console.log("✅ [Background] Successfully added chain:", chainName)
  } catch (error) {
    console.error("❌ [Background] Error adding chain:", error)
    throw error
  }
}

console.log("✅ [Background] Message listeners set up")
// 在扩展启动时清理过期的授权
chrome.runtime.onStartup.addListener(() => {
  console.log("🚀 [Background] Extension startup, cleaning expired authorizations...")
  cleanupExpiredAuthorizations()
})

// 在扩展安装或更新时也清理
chrome.runtime.onInstalled.addListener(() => {
  console.log("📦 [Background] Extension installed/updated, cleaning expired authorizations...")
  cleanupExpiredAuthorizations()
})

// 可选：添加定期清理任务（每小时执行一次）
setInterval(() => {
  cleanupExpiredAuthorizations()
}, 60 * 60 * 1000) // 每小时清理一次