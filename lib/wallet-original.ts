// Browser polyfills
import './polyfills'

import * as bip39 from 'bip39'
import HDKey from 'hdkey'
import { ethers } from 'ethers'
import CryptoJS from 'crypto-js'

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
  rpcUrl: string
  chainId: number
  symbol: string
  blockExplorerUrl?: string
}

export class WalletManager {
  private static instance: WalletManager
  private password: string = ''

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager()
    }
    return WalletManager.instance
  }

  // 生成新钱包
  async generateWallet(password: string): Promise<{ mnemonic: string; address: string }> {
    const mnemonic = bip39.generateMnemonic()
    const accounts = await this.deriveAccountsFromMnemonic(mnemonic, 1)
    
    const walletState: WalletState = {
      isLocked: false,
      accounts,
      currentAccount: 0,
      mnemonic,
      networks: this.getDefaultNetworks(),
      currentNetwork: 0
    }

    await this.saveWallet(walletState, password)
    this.password = password
    
    return {
      mnemonic,
      address: accounts[0].address
    }
  }

  // 从助记词恢复钱包
  async restoreWallet(mnemonic: string, password: string): Promise<string> {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('无效的助记词')
    }

    const accounts = await this.deriveAccountsFromMnemonic(mnemonic, 1)
    
    const walletState: WalletState = {
      isLocked: false,
      accounts,
      currentAccount: 0,
      mnemonic,
      networks: this.getDefaultNetworks(),
      currentNetwork: 0
    }

    await this.saveWallet(walletState, password)
    this.password = password
    
    return accounts[0].address
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
      const wallet = new ethers.Wallet(cleanPrivateKey)
      
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
        // 私钥导入的钱包没有助记词
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

  // 从助记词派生账户
  private async deriveAccountsFromMnemonic(mnemonic: string, count: number): Promise<Account[]> {
    const seed = await bip39.mnemonicToSeed(mnemonic)
    const hdkey = HDKey.fromMasterSeed(seed)
    const accounts: Account[] = []

    for (let i = 0; i < count; i++) {
      const childKey = hdkey.derive(`m/44'/60'/0'/0/${i}`)
      const privateKey = '0x' + childKey.privateKey.toString('hex')
      const wallet = new ethers.Wallet(privateKey)
      
      accounts.push({
        address: wallet.address,
        privateKey,
        publicKey: '0x' + childKey.publicKey.toString('hex'),
        index: i
      })
    }

    return accounts
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

  // 添加新账户
  async addAccount(): Promise<Account> {
    const walletState = await this.getWalletState()
    if (!walletState || !walletState.mnemonic) {
      throw new Error('钱包未解锁或助记词不存在')
    }

    const newAccounts = await this.deriveAccountsFromMnemonic(
      walletState.mnemonic,
      walletState.accounts.length + 1
    )
    
    const newAccount = newAccounts[newAccounts.length - 1]
    walletState.accounts.push(newAccount)
    
    await this.saveWallet(walletState, this.password)
    return newAccount
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
    const wallet = new ethers.Wallet(currentAccount.privateKey)
    
    return await wallet.signTransaction(transaction)
  }

  // 签名消息
  async signMessage(message: string): Promise<string> {
    const walletState = await this.getWalletState()
    if (!walletState) {
      throw new Error('钱包未解锁')
    }

    const currentAccount = walletState.accounts[walletState.currentAccount]
    const wallet = new ethers.Wallet(currentAccount.privateKey)
    
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
    
    // try {
    //   const provider = new ethers.JsonRpcProvider(network.rpcUrl)
    //   const balance = await provider.getBalance(targetAddress)
    //   return ethers.formatEther(balance)
    // } catch (error) {
    //   console.error('获取余额失败:', error)
    //   return '0.0'
    // }
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
      const provider = new ethers.JsonRpcProvider(network.rpcUrl)
      const wallet = new ethers.Wallet(currentAccount.privateKey, provider)

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

  // 获取默认网络
  private getDefaultNetworks(): Network[] {
    return [
      {
        name: 'Ethereum Mainnet',
        rpcUrl: 'https://mainnet.infura.io/v3/d8ed0bd1de8242d998a1405b6932ab33',
        chainId: 1,
        symbol: 'ETH',
        blockExplorerUrl: 'https://etherscan.io'
      },
      {
        name: 'Sepolia Testnet', 
        rpcUrl: 'https://sepolia.infura.io/v3/d8ed0bd1de8242d998a1405b6932ab33',
        chainId: 11155111,
        symbol: 'SEP',
        blockExplorerUrl: 'https://sepolia.etherscan.io'
      }
    ]
  }

  // 检查钱包是否存在
  async walletExists(): Promise<boolean> {
    const result = await chrome.storage.local.get(['encryptedWallet'])
    return !!result.encryptedWallet
  }
} 