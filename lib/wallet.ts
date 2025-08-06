// 简化版钱包实现，减少Node.js依赖
import { ethers, Wallet, HDNodeWallet, JsonRpcProvider } from 'ethers'
import CryptoJS from 'crypto-js'
import * as bip39 from 'bip39'

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

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager()
    }
    return WalletManager.instance
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
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  // 锁定钱包
  async lockWallet(): Promise<void> {
    this.password = ''
    this.providers.clear() // 清除provider缓存
    const walletState = await this.getWalletState()
    if (walletState) {
      walletState.isLocked = true
      await chrome.storage.local.set({ walletState })
    }
  }

  // 获取钱包状态
  async getWalletState(): Promise<WalletState | null> {
    if (!this.password) {
      return null
    }
    return await this.loadWallet(this.password)
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
      return ethers.formatEther(balance)
    } catch (error) {
      console.error('获取余额失败:', error)
      return '0' // 如果获取失败，返回 0
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
        value: ethers.parseEther(amount),
        gasLimit: gasLimit ? BigInt(gasLimit) : 21000n,
        gasPrice: gasPrice ? ethers.parseUnits(gasPrice, 'gwei') : undefined
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
        symbol: 'SEP',
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
}