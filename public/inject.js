// Prevent duplicate injection
if (window.simpleCryptoWalletInjected) {
  console.log(
    "⚠️ [EIP-6963] Simple Crypto Wallet provider already injected, skipping"
  )
} else {
  // EI// EIP-6963 announcement function
  function announceProvider() {
    console.log("📢 [EIP-6963] Announcing wallet provider:", walletInfo.name)

    const announceEvent = new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({
        info: Object.freeze({ ...walletInfo }),
        provider: walletProvider // Don't freeze the provider - it needs to be mutable
      })
    })

    window.dispatchEvent(announceEvent)
    console.log("✅ [EIP-6963] Announcement event dispatched")
  }
  class EIP6963Provider {
    constructor() {
      this.isConnected = false
      this.chainId = "0x1" // Ethereum mainnet
      this.networkVersion = "1"
      this.selectedAddress = null
      this.accounts = []
      this.requestId = 0
      this.pendingRequests = new Map()
      this.eventListeners = new Map()

      // EIP-6963 identifier
      this.isSimpleCryptoWallet = true

      // Listen for responses from content script
      window.addEventListener("message", (event) => {
        if (
          event.source !== window ||
          !event.data.type ||
          event.data.type !== "EIP6963_RESPONSE"
        ) {
          return
        }

        const { id, result, error } = event.data
        const pendingRequest = this.pendingRequests.get(id)

        if (pendingRequest) {
          this.pendingRequests.delete(id)

          if (error) {
            pendingRequest.reject(new Error(error.message || "Request failed"))
          } else {
            // Handle specific method results
            if (pendingRequest.method === "eth_requestAccounts") {
              if (result && Array.isArray(result) && result.length > 0) {
                this.accounts = result
                this.selectedAddress = result[0] || null
                this.isConnected = true
                this.emit("connect", { chainId: this.chainId })
                this.emit("accountsChanged", result)
                console.log(
                  "✅ [EIP-6963] Connected successfully with accounts:",
                  result
                )
              } else {
                this.accounts = []
                this.selectedAddress = null
                this.isConnected = false
                console.log(
                  "⚠️ [EIP-6963] Connection failed - no accounts returned"
                )
              }
            }

            pendingRequest.resolve(result)
          }
        }
      })

      console.log("🔌 EIP-6963 Provider initialized")
    }

    // Send request to content script
    async request({ method, params = [] }) {
      console.log(`📤 [EIP-6963] Sending request:`, { method, params })

      return new Promise((resolve, reject) => {
        const id = ++this.requestId
        this.pendingRequests.set(id, { resolve, reject, method })

        window.postMessage(
          {
            type: "EIP6963_REQUEST",
            method,
            params,
            id,
            origin: window.location.origin
          },
          "*"
        )

        // Set timeout (30 seconds)
        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id)
            reject(new Error(`Request timeout: ${method}`))
          }
        }, 30000)
      })
    }

    // Legacy API support
    async send(method, params) {
      if (typeof method === "object") {
        return this.request(method)
      }
      return this.request({ method, params })
    }

    // Legacy async API
    async sendAsync(payload, callback) {
      try {
        const result = await this.request({
          method: payload.method,
          params: payload.params
        })
        callback(null, {
          jsonrpc: "2.0",
          id: payload.id,
          result
        })
      } catch (error) {
        callback(error, {
          jsonrpc: "2.0",
          id: payload.id,
          error: {
            code: -32603,
            message: error.message
          }
        })
      }
    }

    // Enable method
    async enable() {
      return this.request({ method: "eth_requestAccounts" })
    }

    // Event management
    on(eventName, listener) {
      if (!this.eventListeners.has(eventName)) {
        this.eventListeners.set(eventName, [])
      }
      this.eventListeners.get(eventName).push(listener)
    }

    addListener(eventName, listener) {
      this.on(eventName, listener)
    }

    removeListener(eventName, listener) {
      const listeners = this.eventListeners.get(eventName)
      if (listeners) {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }

    removeAllListeners(eventName) {
      if (eventName) {
        this.eventListeners.delete(eventName)
      } else {
        this.eventListeners.clear()
      }
    }

    emit(eventName, ...args) {
      const listeners = this.eventListeners.get(eventName)
      if (listeners) {
        listeners.forEach((listener) => listener(...args))
      }
    }

    // Compatibility properties
    get isMetaMask() {
      return false
    }

    get connected() {
      return this.isConnected
    }

    get chainId() {
      return this.chainId
    }

    get networkVersion() {
      return this.networkVersion
    }
  }
}

// Create wallet provider instance
const walletProvider = new EIP6963Provider()

// EIP-6963 wallet information
const walletInfo = {
  uuid: "simple-crypto-wallet-" + Math.random().toString(36).substr(2, 9),
  name: "Simple Crypto Wallet",
  icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTQiIGZpbGw9IiM0Yjc3YmUiLz4KPHA+PHRleHQgeD0iMTYiIHk9IjIwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn5qAPC90ZXh0PjwvcD4KPC9zdmc+",
  rdns: "com.simplecryptowallet.extension"
}

// EIP-6963 announcement function
function announceProvider() {
  console.log("📢 [EIP-6963] Announcing wallet provider:", walletInfo.name)

  const announceEvent = new CustomEvent("eip6963:announceProvider", {
    detail: Object.freeze({
      info: Object.freeze({ ...walletInfo }),
      provider: Object.freeze(walletProvider)
    })
  })

  window.dispatchEvent(announceEvent)
  console.log("�?[EIP-6963] Announcement event dispatched")
}

// Listen for EIP-6963 provider requests
window.addEventListener("eip6963:requestProvider", () => {
  console.log("📨 [EIP-6963] Received provider request event")
  announceProvider()
})

// Initialize EIP-6963 after page load
function initializeEIP6963() {
  console.log("🚀 [EIP-6963] Initializing wallet announcement")

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announceProvider)
  } else {
    announceProvider()
  }

  // Delayed announcements to ensure DApp listeners are ready
  setTimeout(announceProvider, 100)
  setTimeout(announceProvider, 500)
  setTimeout(announceProvider, 1000)
}

// Initialize immediately
initializeEIP6963()

// Legacy compatibility: inject to window.ethereum if not occupied
if (!window.ethereum) {
  window.ethereum = walletProvider
  console.log("�?[EIP-6963] Injected to window.ethereum")
}

console.log("🚀 [EIP-6963] Simple Crypto Wallet provider injection complete")

// Mark as injected
window.simpleCryptoWalletInjected = true
