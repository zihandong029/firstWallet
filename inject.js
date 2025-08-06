// 创建钱包提供者
class WalletProvider {
  constructor() {
    this.isConnected = false
    this.chainId = '0x1' // Ethereum mainnet
    this.networkVersion = '1'
    this.selectedAddress = null
    this.accounts = []
    this.requestId = 0
    this.pendingRequests = new Map()

    // 监听来自内容脚本的响应
    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data.type || event.data.type !== 'WALLET_RESPONSE') {
        return
      }

      const { id, result, error } = event.data
      const pendingRequest = this.pendingRequests.get(id)
      
      if (pendingRequest) {
        this.pendingRequests.delete(id)
        if (error) {
          pendingRequest.reject(new Error(error))
        } else {
          pendingRequest.resolve(result)
        }
      }
    })
  }

  // 发送请求到内容脚本
  async request({ method, params = [] }) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      this.pendingRequests.set(id, { resolve, reject })

      window.postMessage({
        type: 'WALLET_REQUEST',
        method,
        params,
        id
      }, '*')

      // 设置超时
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 30000)
    })
  }

  // 启用钱包连接
  async enable() {
    return this.request({ method: 'eth_requestAccounts' })
  }

  // 发送交易
  async sendTransaction(transactionParameters) {
    return this.request({
      method: 'eth_sendTransaction',
      params: [transactionParameters]
    })
  }

  // 签名消息
  async personalSign(message, account) {
    return this.request({
      method: 'personal_sign',
      params: [message, account]
    })
  }

  // 签名类型化数据
  async signTypedData(account, typedData) {
    return this.request({
      method: 'eth_signTypedData_v4',
      params: [account, typedData]
    })
  }

  // 获取账户余额
  async getBalance(address, blockTag = 'latest') {
    return this.request({
      method: 'eth_getBalance',
      params: [address, blockTag]
    })
  }

  // 获取交易计数
  async getTransactionCount(address, blockTag = 'latest') {
    return this.request({
      method: 'eth_getTransactionCount',
      params: [address, blockTag]
    })
  }

  // 获取 Gas 价格
  async getGasPrice() {
    return this.request({
      method: 'eth_gasPrice'
    })
  }

  // 估算 Gas
  async estimateGas(transactionObject) {
    return this.request({
      method: 'eth_estimateGas',
      params: [transactionObject]
    })
  }

  // 调用合约方法
  async call(callObject, blockTag = 'latest') {
    return this.request({
      method: 'eth_call',
      params: [callObject, blockTag]
    })
  }

  // 获取区块信息
  async getBlock(blockHashOrBlockTag, includeTransactions = false) {
    return this.request({
      method: 'eth_getBlockByNumber',
      params: [blockHashOrBlockTag, includeTransactions]
    })
  }

  // 获取交易信息
  async getTransaction(transactionHash) {
    return this.request({
      method: 'eth_getTransactionByHash',
      params: [transactionHash]
    })
  }

  // 获取交易收据
  async getTransactionReceipt(transactionHash) {
    return this.request({
      method: 'eth_getTransactionReceipt',
      params: [transactionHash]
    })
  }

  // 监听事件
  on(eventName, listener) {
    // 简单的事件监听器实现
    if (!this.listeners) {
      this.listeners = {}
    }
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = []
    }
    this.listeners[eventName].push(listener)
  }

  // 移除事件监听器
  removeListener(eventName, listener) {
    if (this.listeners && this.listeners[eventName]) {
      const index = this.listeners[eventName].indexOf(listener)
      if (index > -1) {
        this.listeners[eventName].splice(index, 1)
      }
    }
  }

  // 触发事件
  emit(eventName, ...args) {
    if (this.listeners && this.listeners[eventName]) {
      this.listeners[eventName].forEach(listener => listener(...args))
    }
  }

  // 检查是否为钱包
  get isMetaMask() {
    return true
  }

  // 检查是否连接
  get isConnected() {
    return this.connected
  }
}

// 创建提供者实例
const provider = new WalletProvider()

// 将提供者注入到 window 对象
window.ethereum = provider

// 触发 ethereum 对象注入事件
window.dispatchEvent(new Event('ethereum#initialized'))

// 兼容性：也注入到 web3 对象
if (typeof window.web3 === 'undefined') {
  window.web3 = {
    currentProvider: provider,
    eth: {
      defaultAccount: provider.selectedAddress
    }
  }
}

console.log('钱包提供者已注入') 