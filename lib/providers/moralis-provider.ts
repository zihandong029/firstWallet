// Moralis统一API Provider（备用方案）
import type { 
  TransactionHistoryProvider, 
  Transaction, 
  TokenTransfer, 
  TokenBalance, 
  QueryOptions
} from '../transaction-history'
import { TransactionHistoryError } from '../transaction-history'
import { formatEther } from 'ethers'

export interface MoralisConfig {
  apiKey: string
  baseUrl: string
}

export class MoralisProvider implements TransactionHistoryProvider {
  private config: MoralisConfig
  private chainId: number
  private chainName: string
  private symbol: string

  constructor(config: MoralisConfig, chainId: number) {
    this.config = config
    this.chainId = chainId
    this.setChainInfo(chainId)
  }

  private setChainInfo(chainId: number) {
    const chainMap: Record<number, { name: string; symbol: string }> = {
      1: { name: 'Ethereum', symbol: 'ETH' },
      11155111: { name: 'Sepolia', symbol: 'SepoliaETH' },
      137: { name: 'Polygon', symbol: 'MATIC' },
      56: { name: 'BSC', symbol: 'BNB' },
      43114: { name: 'Avalanche', symbol: 'AVAX' }
    }
    
    const info = chainMap[chainId] || { name: 'Unknown', symbol: 'ETH' }
    this.chainName = info.name
    this.symbol = info.symbol
  }

  getChainInfo() {
    return {
      chainId: this.chainId,
      name: this.chainName,
      symbol: this.symbol
    }
  }

  async getTransactions(address: string, options: QueryOptions = {}): Promise<Transaction[]> {
    try {
      const { limit = 50 } = options
      const chainHex = `0x${this.chainId.toString(16)}`
      
      const params = new URLSearchParams({
        chain: chainHex,
        limit: limit.toString(),
        cursor: '', // Moralis使用cursor分页
      })

      const response = await fetch(
        `${this.config.baseUrl}/v2/${address}?${params}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      return data.result.map((tx: any) => this.formatTransaction(tx, address))
    } catch (error) {
      throw new TransactionHistoryError(
        `Moralis获取交易失败: ${error.message}`,
        'moralis',
        this.chainId,
        error
      )
    }
  }

  async getTokenTransfers(address: string, tokenAddress?: string): Promise<TokenTransfer[]> {
    try {
      const chainHex = `0x${this.chainId.toString(16)}`
      const params = new URLSearchParams({
        chain: chainHex,
        limit: '50',
      })

      if (tokenAddress) {
        params.append('contract_addresses[]', tokenAddress)
      }

      const response = await fetch(
        `${this.config.baseUrl}/v2/${address}/erc20/transfers?${params}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      return data.result.map((tx: any) => this.formatTokenTransfer(tx, address))
    } catch (error) {
      throw new TransactionHistoryError(
        `Moralis获取代币转账失败: ${error.message}`,
        'moralis',
        this.chainId,
        error
      )
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      const chainHex = `0x${this.chainId.toString(16)}`
      
      const response = await fetch(
        `${this.config.baseUrl}/v2/${address}/balance?chain=${chainHex}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return formatEther(data.balance)
    } catch (error) {
      throw new TransactionHistoryError(
        `Moralis获取余额失败: ${error.message}`,
        'moralis',
        this.chainId,
        error
      )
    }
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      const chainHex = `0x${this.chainId.toString(16)}`
      
      const response = await fetch(
        `${this.config.baseUrl}/v2/${address}/erc20?chain=${chainHex}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      return data.map((token: any) => this.formatTokenBalance(token))
    } catch (error) {
      throw new TransactionHistoryError(
        `Moralis获取代币余额失败: ${error.message}`,
        'moralis',
        this.chainId,
        error
      )
    }
  }

  private formatTransaction(tx: any, userAddress: string): Transaction {
    const isOutgoing = tx.from_address?.toLowerCase() === userAddress.toLowerCase()
    
    return {
      hash: tx.hash,
      from: tx.from_address,
      to: tx.to_address,
      value: tx.value,
      valueFormatted: formatEther(tx.value),
      symbol: this.symbol,
      timestamp: new Date(tx.block_timestamp).getTime(),
      blockNumber: parseInt(tx.block_number),
      gasUsed: tx.gas_used,
      gasPrice: tx.gas_price,
      status: tx.receipt_status === '1' ? 'success' : 'failed',
      type: isOutgoing ? 'send' : 'receive',
      chainId: this.chainId,
      chainName: this.chainName,
      explorerUrl: tx.explorer_url
    }
  }

  private formatTokenTransfer(tx: any, userAddress: string): TokenTransfer {
    const isOutgoing = tx.from_address?.toLowerCase() === userAddress.toLowerCase()
    const decimals = parseInt(tx.token_decimals)
    const value = tx.value
    const valueFormatted = (parseFloat(value) / Math.pow(10, decimals)).toString()

    return {
      hash: tx.transaction_hash,
      from: tx.from_address,
      to: tx.to_address,
      value,
      valueFormatted,
      tokenAddress: tx.address,
      tokenName: tx.token_name,
      tokenSymbol: tx.token_symbol,
      tokenDecimals: decimals,
      timestamp: new Date(tx.block_timestamp).getTime(),
      blockNumber: parseInt(tx.block_number),
      type: isOutgoing ? 'send' : 'receive',
      chainId: this.chainId
    }
  }

  private formatTokenBalance(token: any): TokenBalance {
    const decimals = parseInt(token.decimals)
    const balance = token.balance
    const balanceFormatted = (parseFloat(balance) / Math.pow(10, decimals)).toString()

    return {
      address: token.token_address,
      name: token.name,
      symbol: token.symbol,
      decimals,
      balance,
      balanceFormatted,
      usdValue: token.usd_value,
      logoUrl: token.logo
    }
  }
}

// 创建Moralis provider实例
export const createMoralisProvider = (apiKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjdiNjRkYmY5LTFhNWItNGY0Yy1hMzhhLWJmOWYzNDQ0NDM5YyIsIm9yZ0lkIjoiNDY0NzYzIiwidXNlcklkIjoiNDc4MTQwIiwidHlwZUlkIjoiNzMzNjQyNGUtZWMwYS00OWIzLTllYWMtMjYyMTM5MWEyOGM1IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTUwMDY5ODgsImV4cCI6NDkxMDc2Njk4OH0.qjOqRD3pdF8jjZ_hQW3ZR_7Jfx3UEQYqRN0JaDBclXQ', chainId: number) => {
  return new MoralisProvider({
    apiKey,
    baseUrl: 'https://deep-index.moralis.io/api'
  }, chainId)
}
