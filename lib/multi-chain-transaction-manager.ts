// 多链交易历史管理器
import type { 
  TransactionHistoryProvider, 
  Transaction, 
  TokenTransfer, 
  TokenBalance, 
  QueryOptions
} from './transaction-history'
import { TransactionHistoryError } from './transaction-history'
import { createEthereumProvider, createSepoliaProvider } from './providers/etherscan-provider'
import { createMoralisProvider } from './providers/moralis-provider'

export interface MultiChainConfig {
  etherscanApiKey?: string
  moralisApiKey?: string
  enableFallback?: boolean
}

export class MultiChainTransactionManager {
  private providers: Map<number, TransactionHistoryProvider> = new Map()
  private fallbackProvider: TransactionHistoryProvider | null = null
  private config: MultiChainConfig

  constructor(config: MultiChainConfig = {}) {
    this.config = {
      etherscanApiKey: 'YourApiKeyToken',
      moralisApiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjdiNjRkYmY5LTFhNWItNGY0Yy1hMzhhLWJmOWYzNDQ0NDM5YyIsIm9yZ0lkIjoiNDY0NzYzIiwidXNlcklkIjoiNDc4MTQwIiwidHlwZUlkIjoiNzMzNjQyNGUtZWMwYS00OWIzLTllYWMtMjYyMTM5MWEyOGM1IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTUwMDY5ODgsImV4cCI6NDkxMDc2Njk4OH0.qjOqRD3pdF8jjZ_hQW3ZR_7Jfx3UEQYqRN0JaDBclXQ',
      enableFallback: true,
      ...config
    }
    
    this.initializeProviders()
  }

  private initializeProviders() {
    // 主要Provider - 专用API
    this.providers.set(1, createEthereumProvider(this.config.etherscanApiKey))
    this.providers.set(11155111, createSepoliaProvider(this.config.etherscanApiKey))
    
    // 备用Provider - 统一API (Moralis)
    if (this.config.enableFallback && this.config.moralisApiKey) {
      this.fallbackProvider = createMoralisProvider(this.config.moralisApiKey, 1)
    }
  }

  // 添加自定义Provider
  addProvider(chainId: number, provider: TransactionHistoryProvider) {
    this.providers.set(chainId, provider)
    console.log(`✅ 已添加 Chain ID ${chainId} 的交易历史Provider`)
  }

  // 获取支持的链
  getSupportedChains(): number[] {
    return Array.from(this.providers.keys())
  }

  // 获取链信息
  getChainInfo(chainId: number) {
    const provider = this.providers.get(chainId)
    return provider?.getChainInfo() || null
  }

  // 获取交易历史
  async getTransactions(
    chainId: number, 
    address: string, 
    options: QueryOptions = {}
  ): Promise<Transaction[]> {
    console.log(`🔍 [MultiChain] 获取交易历史 - Chain: ${chainId}, Address: ${address}`)
    
    // 尝试主要Provider
    const primaryProvider = this.providers.get(chainId)
    if (primaryProvider) {
      try {
        const transactions = await primaryProvider.getTransactions(address, options)
        console.log(`✅ [MultiChain] 主要Provider成功获取 ${transactions.length} 条交易`)
        return transactions
      } catch (error) {
        console.warn(`⚠️ [MultiChain] 主要Provider失败:`, error.message)
        
        // 如果启用备用，尝试备用Provider
        if (this.config.enableFallback && this.fallbackProvider) {
          try {
            console.log(`🔄 [MultiChain] 尝试备用Provider...`)
            // 重新创建针对特定链的backup provider
            const backupProvider = createMoralisProvider(this.config.moralisApiKey!, chainId)
            const transactions = await backupProvider.getTransactions(address, options)
            console.log(`✅ [MultiChain] 备用Provider成功获取 ${transactions.length} 条交易`)
            return transactions
          } catch (fallbackError) {
            console.error(`❌ [MultiChain] 备用Provider也失败:`, fallbackError.message)
          }
        }
        
        throw error
      }
    }

    // 如果没有主要Provider，直接尝试备用
    if (this.config.enableFallback && this.fallbackProvider) {
      try {
        console.log(`🔄 [MultiChain] 使用备用Provider (无主要Provider)...`)
        const backupProvider = createMoralisProvider(this.config.moralisApiKey!, chainId)
        return await backupProvider.getTransactions(address, options)
      } catch (error) {
        throw new TransactionHistoryError(
          `不支持的链或所有Provider都失败`,
          'multi-chain',
          chainId,
          error
        )
      }
    }

    throw new TransactionHistoryError(
      `Chain ID ${chainId} 暂不支持交易历史查询`,
      'multi-chain',
      chainId
    )
  }

  // 获取代币转账记录
  async getTokenTransfers(
    chainId: number, 
    address: string, 
    tokenAddress?: string
  ): Promise<TokenTransfer[]> {
    console.log(`🔍 [MultiChain] 获取代币转账 - Chain: ${chainId}, Address: ${address}`)
    
    const provider = this.providers.get(chainId)
    if (provider) {
      try {
        return await provider.getTokenTransfers(address, tokenAddress)
      } catch (error) {
        if (this.config.enableFallback && this.fallbackProvider) {
          try {
            const backupProvider = createMoralisProvider(this.config.moralisApiKey!, chainId)
            return await backupProvider.getTokenTransfers(address, tokenAddress)
          } catch (fallbackError) {
            console.error(`❌ [MultiChain] 备用Provider获取代币转账失败:`, fallbackError.message)
          }
        }
        throw error
      }
    }

    throw new TransactionHistoryError(
      `Chain ID ${chainId} 暂不支持代币转账查询`,
      'multi-chain',
      chainId
    )
  }

  // 获取代币余额
  async getTokenBalances(chainId: number, address: string): Promise<TokenBalance[]> {
    console.log(`🔍 [MultiChain] 获取代币余额 - Chain: ${chainId}, Address: ${address}`)
    
    // 优先使用统一API (Moralis) 获取代币余额，因为它支持更好
    if (this.config.enableFallback && this.fallbackProvider) {
      try {
        const backupProvider = createMoralisProvider(this.config.moralisApiKey!, chainId)
        return await backupProvider.getTokenBalances(address)
      } catch (error) {
        console.warn(`⚠️ [MultiChain] 统一API获取代币余额失败:`, error.message)
      }
    }

    const provider = this.providers.get(chainId)
    if (provider) {
      try {
        return await provider.getTokenBalances(address)
      } catch (error) {
        throw error
      }
    }

    return []
  }

  // 测试Provider连接
  async testConnection(chainId: number, address: string): Promise<{
    success: boolean
    provider: string
    error?: string
    latency?: number
  }> {
    const startTime = Date.now()
    
    try {
      const provider = this.providers.get(chainId)
      if (!provider) {
        return {
          success: false,
          provider: 'none',
          error: `Chain ID ${chainId} 没有配置Provider`
        }
      }

      // 尝试获取余额来测试连接
      await provider.getBalance(address)
      const latency = Date.now() - startTime

      return {
        success: true,
        provider: provider.constructor.name,
        latency
      }
    } catch (error) {
      return {
        success: false,
        provider: this.providers.get(chainId)?.constructor.name || 'unknown',
        error: error.message
      }
    }
  }
}
