// 简化版钱包实现，减少Node.js依赖
import { ethers, Wallet, HDNodeWallet, JsonRpcProvider, formatEther, parseEther, parseUnits } from 'ethers'
import CryptoJS from 'crypto-js'
import * as bip39 from 'bip39'
import { MultiChainTransactionManager } from './multi-chain-transaction-manager'
import type { Transaction, TokenTransfer, TokenBalance, QueryOptions } from './transaction-history'

export interface Account {
  address: string
  privateKey: string
  publicKey: string
  index: number
}

export interface WalletState {
  isLocked: boolean
  accounts: Account[]
  currentAccount: number
  mnemonic?: string
  networks: Network[]
  currentNetwork: number
}

export interface Network {
  name: string
  rpcUrls: string[] // 改为数组支持多个RPC
  chainId: number
  symbol: string
  blockExplorerUrl?: string
  currentRpcIndex?: number // 当前使用的RPC索引
}

export class WalletManager {
  private static instance: WalletManager
  private password: string = ''
  private providers: Map<string, JsonRpcProvider> = new Map() // 缓存provider
  private unlockTimeout: number = 30 * 60 * 1000 // 30分钟自动锁定
  private transactionManager: MultiChainTransactionManager // 交易历史管理器

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager()
      // 初始化时检查解锁状态
      WalletManager.instance.initializeUnlockState()
      // 初始化交易历史管理器
      WalletManager.instance.initializeTransactionManager()
    }
    return WalletManager.instance
  }

  // 初始化解锁状态
  private async initializeUnlockState(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['unlockInfo'])
      if (result.unlockInfo) {
        const { password, expiresAt } = result.unlockInfo
        const now = Date.now()
        
        if (expiresAt > now) {
          // 解锁状态仍然有效
          this.password = password
          console.log('🔓 钱包解锁状态已恢复')
          
          // 设置自动锁定定时器
          const timeLeft = expiresAt - now
          setTimeout(() => {
            this.autoLockWallet()
          }, timeLeft)
        } else {
          // 解锁已过期，清理
          await chrome.storage.local.remove(['unlockInfo'])
          console.log('🔒 钱包解锁已过期')
        }
      }
    } catch (error) {
      console.error('初始化解锁状态失败:', error)
    }
  }

  // 确保解锁状态已初始化
  private async ensureUnlockStateInitialized(): Promise<void> {
    if (!this.password) {
      await this.initializeUnlockState()
    }
  }

  // 自动锁定钱包
  private async autoLockWallet(): Promise<void> {
    console.log('⏰ 钱包自动锁定')
    await this.lockWallet()
  }

  // 获取可用的RPC provider
  private async getWorkingProvider(network: Network): Promise<JsonRpcProvider> {
    const cacheKey = `${network.chainId}-${network.currentRpcIndex || 0}`
    
    // 检查缓存
    if (this.providers.has(cacheKey)) {
      const cachedProvider = this.providers.get(cacheKey)!
      try {
        // 测试连接
        await Promise.race([
          cachedProvider.getBlockNumber(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ])
        return cachedProvider
      } catch (error) {
        console.warn('缓存的provider连接失败，尝试其他RPC')
        this.providers.delete(cacheKey)
      }
    }

    // 尝试每个RPC端点
    const startIndex = network.currentRpcIndex || 0
    console.log('startIndex:', startIndex)
    console.log('RPC URLs:', JSON.stringify(network.rpcUrls))
    for (let i = 0; i < network.rpcUrls.length; i++) {
      const rpcIndex = (startIndex + i) % network.rpcUrls.length
      const rpcUrl = network.rpcUrls[rpcIndex]
      console.log(`尝试连接RPC: ${rpcUrl}`)
      try {
        const provider = new JsonRpcProvider(rpcUrl)
        
        // 测试连接（5秒超时）
        await Promise.race([
          provider.getBlockNumber(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('连接超时')), 5000))
        ])
        
        console.log(`✅ RPC连接成功: ${rpcUrl}`)
        
        // 更新当前使用的RPC索引
        network.currentRpcIndex = rpcIndex
        await this.updateNetworkRpcIndex(network.chainId, rpcIndex)
        
        // 缓存provider
        const newCacheKey = `${network.chainId}-${rpcIndex}`
        this.providers.set(newCacheKey, provider)
        
        return provider
      } catch (error) {
        console.warn(`❌ RPC连接失败: ${rpcUrl}`, error)
        continue
      }
    }
    
    throw new Error(`所有RPC节点都无法连接，网络: ${network.name}`)
  }

  // 更新网络的RPC索引
  private async updateNetworkRpcIndex(chainId: number, rpcIndex: number): Promise<void> {
    try {
      const walletState = await this.getWalletState()
      if (walletState) {
        const network = walletState.networks.find(n => n.chainId === chainId)
        if (network) {
          network.currentRpcIndex = rpcIndex
          await this.saveWallet(walletState, this.password)
        }
      }
    } catch (error) {
      console.warn('更新RPC索引失败:', error)
    }
  }

  // 生成新钱包 - 使用ethers内置方法
  async generateWallet(password: string): Promise<{ mnemonic: string; address: string }> {
    console.log('🔄 [Ethers 默认方法] 开始生成钱包...')
    
    // 使用ethers生成钱包，避免使用bip39
    const wallet = Wallet.createRandom()
    const mnemonic = wallet.mnemonic?.phrase || ''
    
    console.log('🔑 [Ethers] 生成的助记词:', mnemonic)
    console.log('📊 [Ethers] 助记词长度:', mnemonic.split(' ').length, '个单词')
    console.log('🏠 [Ethers] 生成的地址:', wallet.address)
    console.log('🔐 [Ethers] 私钥:', wallet.privateKey)
    
    const account: Account = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: '', // 简化处理
      index: 0
    }
    
    const walletState: WalletState = {
      isLocked: false,
      accounts: [account],
      currentAccount: 0,
      mnemonic,
      networks: this.getDefaultNetworks(),
      currentNetwork: 0
    }

    await this.saveWallet(walletState, password)
    this.password = password
    
    console.log('✅ [Ethers] 钱包生成完成')
    
    return {
      mnemonic,
      address: account.address
    }
  }

  // 从助记词恢复钱包 - 使用ethers内置方法
  async restoreWallet(mnemonic: string, password: string): Promise<string> {
    try {
      const wallet = Wallet.fromPhrase(mnemonic)
      
      const account: Account = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: '',
        index: 0
      }
      
      const walletState: WalletState = {
        isLocked: false,
        accounts: [account],
        currentAccount: 0,
        mnemonic,
        networks: this.getDefaultNetworks(),
        currentNetwork: 0
      }

      await this.saveWallet(walletState, password)
      this.password = password
      
      return account.address
    } catch (error) {
      throw new Error('无效的助记词')
    }
  }

  // 从私钥导入钱包
  async importFromPrivateKey(privateKey: string, password: string): Promise<string> {
    try {
      // 确保私钥格式正确
      let cleanPrivateKey = privateKey.trim()
      if (!cleanPrivateKey.startsWith('0x')) {
        cleanPrivateKey = '0x' + cleanPrivateKey
      }

      // 验证私钥并创建钱包
      const wallet = new Wallet(cleanPrivateKey)
      
      const account: Account = {
        address: wallet.address,
        privateKey: cleanPrivateKey,
        publicKey: '',
        index: 0
      }

      const walletState: WalletState = {
        isLocked: false,
        accounts: [account],
        currentAccount: 0,
        mnemonic: undefined,
        networks: this.getDefaultNetworks(),
        currentNetwork: 0
      }

      await this.saveWallet(walletState, password)
      this.password = password
      
      return account.address
    } catch (error) {
      throw new Error('无效的私钥格式')
    }
  }

  // 解锁钱包
  async unlockWallet(password: string): Promise<boolean> {
    try {
      const walletState = await this.loadWallet(password)
      if (walletState) {
        this.password = password
        
        // 保存解锁状态到storage，30分钟后过期
        const expiresAt = Date.now() + this.unlockTimeout
        await chrome.storage.local.set({
          unlockInfo: {
            password,
            expiresAt
          }
        })
        
        // 设置自动锁定定时器
        setTimeout(() => {
          this.autoLockWallet()
        }, this.unlockTimeout)
        
        console.log('🔓 钱包已解锁，将在30分钟后自动锁定')
        return true
      }
      return false
    } catch (error) {
      console.error('解锁钱包失败:', error)
      return false
    }
  }

  // 锁定钱包
  async lockWallet(): Promise<void> {
    this.password = ''
    this.providers.clear() // 清除provider缓存
    
    // 清除保存的解锁状态
    await chrome.storage.local.remove(['unlockInfo'])
    
    const walletState = await this.getWalletState()
    if (walletState) {
      walletState.isLocked = true
      await chrome.storage.local.set({ walletState })
    }
    
    console.log('🔒 钱包已锁定')
  }

  // 获取钱包状态
  async getWalletState(): Promise<WalletState | null> {
    // 检查钱包是否存在
    const walletExists = await this.walletExists()
    if (!walletExists) {
      return null
    }
    
    // 如果没有密码（钱包被锁定），返回锁定状态
    if (!this.password) {
      // 返回一个表示锁定状态的基本对象
      return {
        isLocked: true,
        accounts: [],
        currentAccount: 0,
        networks: this.getDefaultNetworks(),
        currentNetwork: 0
      }
    }
    
    // 钱包已解锁，延长解锁时间（表示用户活跃）
    await this.extendUnlockTime()
    
    // 钱包已解锁，加载完整状态
    try {
      const walletState = await this.loadWallet(this.password)
      if (walletState) {
        walletState.isLocked = false
      }
      return walletState
    } catch (error) {
      console.error('加载钱包状态失败:', error)
      // 如果加载失败，可能是密码错误，返回锁定状态
      this.password = '' // 清除无效密码
      await chrome.storage.local.remove(['unlockInfo'])
      return {
        isLocked: true,
        accounts: [],
        currentAccount: 0,
        networks: this.getDefaultNetworks(),
        currentNetwork: 0
      }
    }
  }

  // 添加新账户 - 简化版本，只能通过助记词派生
  async addAccount(): Promise<Account> {
    const walletState = await this.getWalletState()
    if (!walletState || !walletState.mnemonic) {
      throw new Error('钱包未解锁或助记词不存在')
    }

    try {
      // 使用ethers派生新账户
      const masterWallet = Wallet.fromPhrase(walletState.mnemonic)
      const path = `m/44'/60'/0'/0/${walletState.accounts.length}`
      const derivedWallet = HDNodeWallet.fromPhrase(walletState.mnemonic, undefined, path)
      
      const newAccount: Account = {
        address: derivedWallet.address,
        privateKey: derivedWallet.privateKey,
        publicKey: '',
        index: walletState.accounts.length
      }
      
      walletState.accounts.push(newAccount)
      await this.saveWallet(walletState, this.password)
      
      return newAccount
    } catch (error) {
      throw new Error('添加账户失败')
    }
  }

  // 切换账户
  async switchAccount(index: number): Promise<void> {
    const walletState = await this.getWalletState()
    if (!walletState) {
      throw new Error('钱包未解锁')
    }

    if (index < 0 || index >= walletState.accounts.length) {
      throw new Error('无效的账户索引')
    }

    walletState.currentAccount = index
    await this.saveWallet(walletState, this.password)
  }

  // 签名交易
  async signTransaction(transaction: any): Promise<string> {
    const walletState = await this.getWalletState()
    if (!walletState) {
      throw new Error('钱包未解锁')
    }

    const currentAccount = walletState.accounts[walletState.currentAccount]
    const wallet = new Wallet(currentAccount.privateKey)
    
    return await wallet.signTransaction(transaction)
  }

  // 签名消息
  async signMessage(message: string): Promise<string> {
    const walletState = await this.getWalletState()
    if (!walletState) {
      throw new Error('钱包未解锁')
    }

    const currentAccount = walletState.accounts[walletState.currentAccount]
    const wallet = new Wallet(currentAccount.privateKey)
    
    return await wallet.signMessage(message)
  }

  // 获取余额
  async getBalance(address?: string): Promise<string> {
    const walletState = await this.getWalletState()
    if (!walletState) {
      throw new Error('钱包未解锁')
    }

    const targetAddress = address || walletState.accounts[walletState.currentAccount].address
    const network = walletState.networks[walletState.currentNetwork]
    
    try {
      const provider = await this.getWorkingProvider(network)
      const balance = await provider.getBalance(targetAddress)
      console.log("🔍 [余额查询] 获取余额成功:", balance)
      return formatEther(balance)
    } catch (error) {
      console.error("❌ [余额查询] 获取余额失败:", error)
      return "0" // 如果获取失败，返回 0
    }
  }

  // 发送交易
  async sendTransaction(to: string, amount: string, gasLimit?: string, gasPrice?: string): Promise<string> {
    const walletState = await this.getWalletState()
    if (!walletState) {
      throw new Error('钱包未解锁')
    }

    const currentAccount = walletState.accounts[walletState.currentAccount]
    const network = walletState.networks[walletState.currentNetwork]
    
    try {
      const provider = await this.getWorkingProvider(network)
      const wallet = new Wallet(currentAccount.privateKey, provider)

      const transaction = {
        to,
        value: parseEther(amount),
        gasLimit: gasLimit ? BigInt(gasLimit) : 21000n,
        gasPrice: gasPrice ? parseUnits(gasPrice, 'gwei') : undefined
      }

      const tx = await wallet.sendTransaction(transaction)
      return tx.hash
    } catch (error) {
      throw new Error(`发送交易失败: ${(error as Error).message}`)
    }
  }

  // 测试网络连接
  async testNetworkConnection(chainId: number): Promise<{ success: boolean; rpcUrl?: string; error?: string }> {
    console.log(`🔍 测试网络连接，Chain ID: ${chainId}`)
    const walletState = await this.getWalletState()
    if (!walletState) {
      return { success: false, error: '钱包未解锁' }
    }

    const network = walletState.networks.find(n => n.chainId === chainId)
    if (!network) {
      return { success: false, error: '网络不存在' }
    }

    try {
      const provider = await this.getWorkingProvider(network)
      const currentRpcUrl = network.rpcUrls[network.currentRpcIndex || 0]
      return { success: true, rpcUrl: currentRpcUrl }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  // 保存钱包
  private async saveWallet(walletState: WalletState, password: string): Promise<void> {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(walletState), password).toString()
    await chrome.storage.local.set({ encryptedWallet: encrypted })
  }

  // 加载钱包
  private async loadWallet(password: string): Promise<WalletState | null> {
    const result = await chrome.storage.local.get(['encryptedWallet'])
    if (!result.encryptedWallet) {
      return null
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(result.encryptedWallet, password).toString(CryptoJS.enc.Utf8)
      return JSON.parse(decrypted)
    } catch (error) {
      throw new Error('密码错误')
    }
  }

  // 获取默认网络 - 添加多个RPC备用节点
  private getDefaultNetworks(): Network[] {
    return [
      {
        name: 'Ethereum Mainnet',
        rpcUrls: [
          'https://mainnet.infura.io/v3/69e676eb042d4b12bd9d53140b956039',
          // 'https://eth.llamarpc.com',
          'https://rpc.ankr.com/eth',
          'https://ethereum.publicnode.com',
          'https://eth-mainnet.rpcfast.com',
          // 'https://mainnet.infura.io/v3/d8ed0bd1de8242d998a1405b6932ab33',
          'https://eth-mainnet.alchemyapi.io/v2/demo',
          'https://cloudflare-eth.com'
        ],
        chainId: 1,
        symbol: 'ETH',
        blockExplorerUrl: 'https://etherscan.io',
        currentRpcIndex: 0
      },
      {
        name: 'Sepolia Testnet', 
        rpcUrls: [
          'https://sepolia.infura.io/v3/69e676eb042d4b12bd9d53140b956039',
          'https://rpc.sepolia.org',
          'https://rpc2.sepolia.org',
          'https://rpc-sepolia.rockx.com',
          // 'https://sepolia.infura.io/v3/d8ed0bd1de8242d998a1405b6932ab33',
          'https://eth-sepolia.public.blastapi.io',
          'https://ethereum-sepolia.publicnode.com'
        ],
        chainId: 11155111,
        symbol: 'SepoliaETH',
        blockExplorerUrl: 'https://sepolia.etherscan.io',
        currentRpcIndex: 0
      }
    ]
  }

  // 检查钱包是否存在
  async walletExists(): Promise<boolean> {
    const result = await chrome.storage.local.get(['encryptedWallet'])
    return !!result.encryptedWallet
  }

  // 生成新钱包 - 使用 bip39 生成助记词
  async generateWalletWithBip39(password: string): Promise<{ mnemonic: string; address: string }> {
    try {
      console.log('🔄 [BIP39-12] 开始使用 bip39 生成 12 个助记词...')
      
      // 使用 bip39 生成 128 位熵（12个助记词）
      const entropy = bip39.generateMnemonic(128)
      
      console.log('🎲 [BIP39-12] 生成的熵长度: 128 位')
      console.log('🔑 [BIP39-12] 生成的助记词:', entropy)
      console.log('📊 [BIP39-12] 助记词长度:', entropy.split(' ').length, '个单词')
      
      // 验证生成的助记词
      const isValid = bip39.validateMnemonic(entropy)
      console.log('✅ [BIP39-12] 助记词验证结果:', isValid)
      
      if (!isValid) {
        throw new Error('生成的助记词验证失败')
      }
      
      // 使用生成的助记词创建钱包
      const wallet = Wallet.fromPhrase(entropy)
      
      console.log('🏠 [BIP39-12] 生成的地址:', wallet.address)
      console.log('🔐 [BIP39-12] 私钥:', wallet.privateKey)
      
      const account: Account = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: '', // 简化处理
        index: 0
      }
      
      const walletState: WalletState = {
        isLocked: false,
        accounts: [account],
        currentAccount: 0,
        mnemonic: entropy,
        networks: this.getDefaultNetworks(),
        currentNetwork: 0
      }

      await this.saveWallet(walletState, password)
      this.password = password
      
      console.log('✅ [BIP39-12] 钱包生成完成')
      
      return {
        mnemonic: entropy,
        address: account.address
      }
    } catch (error) {
      console.error('❌ [BIP39-12] 生成钱包失败:', error)
      throw new Error(`使用 bip39 生成钱包失败: ${(error as Error).message}`)
    }
  }

  // 生成新钱包 - 使用 bip39 生成 24 个助记词
  async generateWalletWithBip39_24Words(password: string): Promise<{ mnemonic: string; address: string }> {
    try {
      console.log('🔄 [BIP39-24] 开始使用 bip39 生成 24 个助记词...')
      
      // 使用 bip39 生成 256 位熵（24个助记词）
      const entropy = bip39.generateMnemonic(256)
      
      console.log('🎲 [BIP39-24] 生成的熵长度: 256 位')
      console.log('🔑 [BIP39-24] 生成的助记词:', entropy)
      console.log('📊 [BIP39-24] 助记词长度:', entropy.split(' ').length, '个单词')
      
      // 验证生成的助记词
      const isValid = bip39.validateMnemonic(entropy)
      console.log('✅ [BIP39-24] 助记词验证结果:', isValid)
      
      if (!isValid) {
        throw new Error('生成的助记词验证失败')
      }
      
      // 使用生成的助记词创建钱包
      const wallet = Wallet.fromPhrase(entropy)
      
      console.log('🏠 [BIP39-24] 生成的地址:', wallet.address)
      console.log('🔐 [BIP39-24] 私钥:', wallet.privateKey)
      
      const account: Account = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: '', // 简化处理
        index: 0
      }
      
      const walletState: WalletState = {
        isLocked: false,
        accounts: [account],
        currentAccount: 0,
        mnemonic: entropy,
        networks: this.getDefaultNetworks(),
        currentNetwork: 0
      }

      await this.saveWallet(walletState, password)
      this.password = password
      
      console.log('✅ [BIP39-24] 钱包生成完成')
      
      return {
        mnemonic: entropy,
        address: account.address
      }
    } catch (error) {
      console.error('❌ [BIP39-24] 生成钱包失败:', error)
      throw new Error(`使用 bip39 生成 24 位助记词钱包失败: ${(error as Error).message}`)
    }
  }

  // 验证助记词 - 使用 bip39 验证
  validateMnemonic(mnemonic: string): boolean {
    try {
      console.log('🔍 [验证] 开始验证助记词...')
      console.log('📝 [验证] 输入助记词:', mnemonic)
      console.log('📊 [验证] 单词数量:', mnemonic.trim().split(' ').length)
      
      const isValid = bip39.validateMnemonic(mnemonic.trim())
      console.log('✅ [验证] 验证结果:', isValid ? '通过' : '失败')
      
      return isValid
    } catch (error) {
      console.error('❌ [验证] 验证过程出错:', error)
      return false
    }
  }

  // 从助记词生成种子 - 使用 bip39
  async mnemonicToSeed(mnemonic: string, passphrase?: string): Promise<string> {
    try {
      console.log('🔄 [种子转换] 开始将助记词转换为种子...')
      console.log('📝 [种子转换] 输入助记词:', mnemonic)
      console.log('🔐 [种子转换] 密码短语:', passphrase ? '已提供' : '未提供')
      
      if (!this.validateMnemonic(mnemonic)) {
        throw new Error('无效的助记词')
      }
      
      const seed = await bip39.mnemonicToSeed(mnemonic, passphrase)
      const seedHex = seed.toString('hex')
      
      console.log('🌱 [种子转换] 生成的种子:', seedHex)
      console.log('📏 [种子转换] 种子长度:', seedHex.length, '字符')
      console.log('🔢 [种子转换] 种子字节数:', seedHex.length / 2, '字节')
      console.log('✅ [种子转换] 转换完成')
      
      return seedHex
    } catch (error) {
      console.error('❌ [种子转换] 转换失败:', error)
      throw new Error(`助记词转种子失败: ${(error as Error).message}`)
    }
  }

  // 延长解锁时间（用户活跃时调用）
  async extendUnlockTime(): Promise<void> {
    if (this.password) {
      const expiresAt = Date.now() + this.unlockTimeout
      await chrome.storage.local.set({
        unlockInfo: {
          password: this.password,
          expiresAt
        }
      })
      console.log('🔄 解锁时间已延长')
    }
  }

  // 检查钱包是否已初始化（是否有加密的钱包数据）
  async isInitialized(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(['encryptedWallet'])
      return !!result.encryptedWallet
    } catch (error) {
      console.error('检查钱包初始化状态失败:', error)
      return false
    }
  }

  // 检查钱包是否已解锁
  isUnlocked(): boolean {
    return !!this.password
  }

  // 异步版本的 isUnlocked 方法，用于兼容 background.ts
  async isUnlockedAsync(): Promise<boolean> {
    // 确保初始化状态已加载
    await this.ensureUnlockStateInitialized()
    console.log('🔍 [WalletManager] isUnlockedAsync - password exists:', !!this.password)
    return this.isUnlocked()
  }

  // 获取当前钱包状态
  async getState(): Promise<WalletState> {
    if (!this.isUnlocked()) {
      throw new Error('Wallet is locked. Please unlock first.')
    }

    const walletState = await this.loadWallet(this.password)
    if (!walletState) {
      throw new Error('Wallet not found. Please create or import a wallet first.')
    }

    return walletState
  }

  // 网络切换相关方法

  // 切换到指定网络
  async switchNetwork(chainId: number): Promise<boolean> {
    try {
      console.log(`🔄 [WalletManager] 切换到网络 Chain ID: ${chainId}`)
      
      const walletState = await this.getWalletState()
      if (!walletState) {
        throw new Error('钱包未解锁')
      }

      // 查找目标网络
      const networkIndex = walletState.networks.findIndex(n => n.chainId === chainId)
      if (networkIndex === -1) {
        throw new Error(`不支持的网络 Chain ID: ${chainId}`)
      }

      // 测试网络连接
      const network = walletState.networks[networkIndex]
      try {
        await this.getWorkingProvider(network)
        console.log(`✅ [WalletManager] 网络连接测试成功: ${network.name}`)
      } catch (error) {
        console.warn(`⚠️ [WalletManager] 网络连接测试失败: ${network.name}`, error)
        // 即使连接测试失败也继续切换，让用户知道可能有连接问题
      }

      // 更新当前网络
      walletState.currentNetwork = networkIndex
      await this.saveWallet(walletState, this.password)
      
      console.log(`✅ [WalletManager] 成功切换到网络: ${network.name} (Chain ID: ${chainId})`)
      return true
    } catch (error) {
      console.error('❌ [WalletManager] 切换网络失败:', error)
      throw error
    }
  }

  // 添加自定义网络
  async addNetwork(network: Omit<Network, 'currentRpcIndex'>): Promise<boolean> {
    try {
      console.log(`🔄 [WalletManager] 添加自定义网络: ${network.name}`)
      
      const walletState = await this.getWalletState()
      if (!walletState) {
        throw new Error('钱包未解锁')
      }

      // 检查网络是否已存在
      const existingNetwork = walletState.networks.find(n => n.chainId === network.chainId)
      if (existingNetwork) {
        throw new Error(`网络已存在: ${existingNetwork.name} (Chain ID: ${network.chainId})`)
      }

      // 验证网络参数
      if (!network.name || !network.rpcUrls || network.rpcUrls.length === 0 || !network.chainId) {
        throw new Error('网络参数不完整')
      }

      // 测试网络连接
      const networkWithIndex: Network = { ...network, currentRpcIndex: 0 }
      try {
        await this.getWorkingProvider(networkWithIndex)
        console.log(`✅ [WalletManager] 自定义网络连接测试成功: ${network.name}`)
      } catch (error) {
        console.warn(`⚠️ [WalletManager] 自定义网络连接测试失败: ${network.name}`, error)
        throw new Error(`无法连接到网络 ${network.name}: ${(error as Error).message}`)
      }

      // 添加网络
      walletState.networks.push(networkWithIndex)
      await this.saveWallet(walletState, this.password)
      
      console.log(`✅ [WalletManager] 成功添加自定义网络: ${network.name}`)
      return true
    } catch (error) {
      console.error('❌ [WalletManager] 添加网络失败:', error)
      throw error
    }
  }

  // 获取当前网络信息
  async getCurrentNetwork(): Promise<Network | null> {
    try {
      const walletState = await this.getWalletState()
      if (!walletState) {
        return null
      }
      
      return walletState.networks[walletState.currentNetwork] || null
    } catch (error) {
      console.error('❌ [WalletManager] 获取当前网络失败:', error)
      return null
    }
  }

  // 获取所有可用网络
  async getAllNetworks(): Promise<Network[]> {
    try {
      const walletState = await this.getWalletState()
      if (!walletState) {
        return this.getDefaultNetworks()
      }
      
      return walletState.networks
    } catch (error) {
      console.error('❌ [WalletManager] 获取网络列表失败:', error)
      return this.getDefaultNetworks()
    }
  }

  // 移除自定义网络
  async removeNetwork(chainId: number): Promise<boolean> {
    try {
      console.log(`🔄 [WalletManager] 移除网络 Chain ID: ${chainId}`)
      
      const walletState = await this.getWalletState()
      if (!walletState) {
        throw new Error('钱包未解锁')
      }

      // 查找目标网络
      const networkIndex = walletState.networks.findIndex(n => n.chainId === chainId)
      if (networkIndex === -1) {
        throw new Error(`网络不存在 Chain ID: ${chainId}`)
      }

      // 不允许删除默认网络（以太坊主网和测试网）
      const defaultChainIds = [1, 11155111] // Mainnet and Sepolia
      if (defaultChainIds.includes(chainId)) {
        throw new Error('不能删除默认网络')
      }

      // 如果当前使用的是要删除的网络，切换到主网
      if (walletState.currentNetwork === networkIndex) {
        walletState.currentNetwork = 0 // 切换到第一个网络（通常是主网）
      } else if (walletState.currentNetwork > networkIndex) {
        // 调整当前网络索引
        walletState.currentNetwork--
      }

      // 移除网络
      walletState.networks.splice(networkIndex, 1)
      await this.saveWallet(walletState, this.password)
      
      console.log(`✅ [WalletManager] 成功移除网络 Chain ID: ${chainId}`)
      return true
    } catch (error) {
      console.error('❌ [WalletManager] 移除网络失败:', error)
      throw error
    }
  }

  // 初始化交易历史管理器
  private initializeTransactionManager(): void {
    this.transactionManager = new MultiChainTransactionManager({
      etherscanApiKey: 'YourApiKeyToken', // 建议从环境变量获取
      moralisApiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjdiNjRkYmY5LTFhNWItNGY0Yy1hMzhhLWJmOWYzNDQ0NDM5YyIsIm9yZ0lkIjoiNDY0NzYzIiwidXNlcklkIjoiNDc4MTQwIiwidHlwZUlkIjoiNzMzNjQyNGUtZWMwYS00OWIzLTllYWMtMjYyMTM5MWEyOGM1IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTUwMDY5ODgsImV4cCI6NDkxMDc2Njk4OH0.qjOqRD3pdF8jjZ_hQW3ZR_7Jfx3UEQYqRN0JaDBclXQ', // 建议从环境变量获取
      enableFallback: true
    })
    console.log('✅ [WalletManager] 交易历史管理器已初始化')
  }

  // ======================== 交易历史相关方法 ========================

  // 获取当前账户的交易历史
  async getTransactionHistory(options: QueryOptions = {}): Promise<Transaction[]> {
    try {
      console.log('🔍 [WalletManager] 获取交易历史...')
      
      const walletState = await this.getWalletState()
      if (!walletState) {
        throw new Error('钱包未解锁')
      }

      const currentAccount = walletState.accounts[walletState.currentAccount]
      const currentNetwork = walletState.networks[walletState.currentNetwork]
      
      return await this.transactionManager.getTransactions(
        currentNetwork.chainId,
        currentAccount.address,
        options
      )
    } catch (error) {
      console.error('❌ [WalletManager] 获取交易历史失败:', error)
      throw error
    }
  }

  // 获取指定账户和网络的交易历史
  async getTransactionHistoryFor(
    chainId: number, 
    address: string, 
    options: QueryOptions = {}
  ): Promise<Transaction[]> {
    try {
      return await this.transactionManager.getTransactions(chainId, address, options)
    } catch (error) {
      console.error('❌ [WalletManager] 获取指定交易历史失败:', error)
      throw error
    }
  }

  // 获取代币转账记录
  async getTokenTransfers(tokenAddress?: string): Promise<TokenTransfer[]> {
    try {
      console.log('🔍 [WalletManager] 获取代币转账记录...')
      
      const walletState = await this.getWalletState()
      if (!walletState) {
        throw new Error('钱包未解锁')
      }

      const currentAccount = walletState.accounts[walletState.currentAccount]
      const currentNetwork = walletState.networks[walletState.currentNetwork]
      
      return await this.transactionManager.getTokenTransfers(
        currentNetwork.chainId,
        currentAccount.address,
        tokenAddress
      )
    } catch (error) {
      console.error('❌ [WalletManager] 获取代币转账失败:', error)
      throw error
    }
  }

  // 获取代币余额列表
  async getTokenBalances(): Promise<TokenBalance[]> {
    try {
      console.log('🔍 [WalletManager] 获取代币余额...')
      
      const walletState = await this.getWalletState()
      if (!walletState) {
        throw new Error('钱包未解锁')
      }

      const currentAccount = walletState.accounts[walletState.currentAccount]
      const currentNetwork = walletState.networks[walletState.currentNetwork]
      
      return await this.transactionManager.getTokenBalances(
        currentNetwork.chainId,
        currentAccount.address
      )
    } catch (error) {
      console.error('❌ [WalletManager] 获取代币余额失败:', error)
      return [] // 失败时返回空数组而不是抛出错误
    }
  }

  // 测试交易历史服务连接
  async testTransactionService(): Promise<{
    success: boolean
    provider: string
    error?: string
    latency?: number
  }> {
    try {
      const walletState = await this.getWalletState()
      if (!walletState) {
        throw new Error('钱包未解锁')
      }

      const currentAccount = walletState.accounts[walletState.currentAccount]
      const currentNetwork = walletState.networks[walletState.currentNetwork]
      
      return await this.transactionManager.testConnection(
        currentNetwork.chainId,
        currentAccount.address
      )
    } catch (error) {
      return {
        success: false,
        provider: 'unknown',
        error: error.message
      }
    }
  }

  // 获取支持的链列表
  getSupportedChainsForHistory(): number[] {
    return this.transactionManager.getSupportedChains()
  }

  // 获取链信息
  getChainInfoForHistory(chainId: number) {
    return this.transactionManager.getChainInfo(chainId)
  }

//   //添加新的区块链网络
//   async addNewNetwork(network: Omit<Network, 'currentRpcIndex'>): Promise<void> {
//     try {
//       const walletState = await this.getWalletState()
//       if (!walletState) {
//         throw new Error('钱包未解锁')
//       }

//       await this.transactionManager.addNetwork(network)
//     } catch (error) {
//       console.error('❌ [WalletManager] 添加新网络失败:', error)
//       throw error
//     }
//   }
}