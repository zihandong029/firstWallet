// Etherscan API Provider
import type { 
  TransactionHistoryProvider, 
  Transaction, 
  TokenTransfer, 
  TokenBalance, 
  QueryOptions
} from '../transaction-history'
import { TransactionHistoryError } from '../transaction-history'
import { formatEther } from 'ethers'

export interface EtherscanConfig {
  apiKey: string
  baseUrl: string
  chainId: number
  chainName: string
  symbol: string
  explorerUrl: string
}

export class EtherscanProvider implements TransactionHistoryProvider {
  private config: EtherscanConfig

  constructor(config: EtherscanConfig) {
    this.config = config
  }

  getChainInfo() {
    return {
      chainId: this.config.chainId,
      name: this.config.chainName,
      symbol: this.config.symbol
    }
  }

  async getTransactions(address: string, options: QueryOptions = {}): Promise<Transaction[]> {
    try {
      const { limit = 50, offset = 0, sort = 'desc' } = options
      
      const params = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: '0',
        endblock: '99999999',
        page: Math.floor(offset / limit + 1).toString(),
        offset: limit.toString(),
        sort: sort,
        apikey: this.config.apiKey
      })

      const response = await fetch(`${this.config.baseUrl}/api?${params}`)
      const data = await response.json()

      if (data.status !== '1') {
        throw new Error(data.message || '获取交易记录失败')
      }

      return data.result.map((tx: any) => this.formatTransaction(tx, address))
    } catch (error) {
      throw new TransactionHistoryError(
        `Etherscan获取交易失败: ${error.message}`,
        'etherscan',
        this.config.chainId,
        error
      )
    }
  }

  async getTokenTransfers(address: string, tokenAddress?: string): Promise<TokenTransfer[]> {
    try {
      const params = new URLSearchParams({
        module: 'account',
        action: 'tokentx',
        address: address,
        startblock: '0',
        endblock: '99999999',
        sort: 'desc',
        apikey: this.config.apiKey
      })

      if (tokenAddress) {
        params.append('contractaddress', tokenAddress)
      }

      const response = await fetch(`${this.config.baseUrl}/api?${params}`)
      const data = await response.json()

      if (data.status !== '1') {
        throw new Error(data.message || '获取代币转账失败')
      }

      return data.result.map((tx: any) => this.formatTokenTransfer(tx, address))
    } catch (error) {
      throw new TransactionHistoryError(
        `Etherscan获取代币转账失败: ${error.message}`,
        'etherscan',
        this.config.chainId,
        error
      )
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      const params = new URLSearchParams({
        module: 'account',
        action: 'balance',
        address: address,
        tag: 'latest',
        apikey: this.config.apiKey
      })

      const response = await fetch(`${this.config.baseUrl}/api?${params}`)
      const data = await response.json()

      if (data.status !== '1') {
        throw new Error(data.message || '获取余额失败')
      }

      return formatEther(data.result)
    } catch (error) {
      throw new TransactionHistoryError(
        `Etherscan获取余额失败: ${error.message}`,
        'etherscan',
        this.config.chainId,
        error
      )
    }
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    // Etherscan不直接提供代币余额API，需要单独查询每个代币
    // 这里返回空数组，实际使用时可能需要其他方法
    return []
  }

  private formatTransaction(tx: any, userAddress: string): Transaction {
    const isOutgoing = tx.from.toLowerCase() === userAddress.toLowerCase()
    const timestamp = parseInt(tx.timeStamp) * 1000

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      valueFormatted: formatEther(tx.value),
      symbol: this.config.symbol,
      timestamp,
      blockNumber: parseInt(tx.blockNumber),
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      status: tx.txreceipt_status === '1' ? 'success' : 'failed',
      type: isOutgoing ? 'send' : 'receive',
      chainId: this.config.chainId,
      chainName: this.config.chainName,
      explorerUrl: `${this.config.explorerUrl}/tx/${tx.hash}`
    }
  }

  private formatTokenTransfer(tx: any, userAddress: string): TokenTransfer {
    const isOutgoing = tx.from.toLowerCase() === userAddress.toLowerCase()
    const decimals = parseInt(tx.tokenDecimal)
    const value = tx.value
    const valueFormatted = (parseFloat(value) / Math.pow(10, decimals)).toString()

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value,
      valueFormatted,
      tokenAddress: tx.contractAddress,
      tokenName: tx.tokenName,
      tokenSymbol: tx.tokenSymbol,
      tokenDecimals: decimals,
      timestamp: parseInt(tx.timeStamp) * 1000,
      blockNumber: parseInt(tx.blockNumber),
      type: isOutgoing ? 'send' : 'receive',
      chainId: this.config.chainId
    }
  }
}

// 预配置的网络Provider
export const createEthereumProvider = (apiKey: string = 'YourApiKeyToken') => {
  return new EtherscanProvider({
    apiKey,
    baseUrl: 'https://api.etherscan.io',
    chainId: 1,
    chainName: 'Ethereum',
    symbol: 'ETH',
    explorerUrl: 'https://etherscan.io'
  })
}

export const createSepoliaProvider = (apiKey: string = 'YourApiKeyToken') => {
  return new EtherscanProvider({
    apiKey,
    baseUrl: 'https://api-sepolia.etherscan.io',
    chainId: 11155111,
    chainName: 'Sepolia',
    symbol: 'SepoliaETH',
    explorerUrl: 'https://sepolia.etherscan.io'
  })
}
