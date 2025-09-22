// 多链交易历史查询接口
export interface Transaction {
  hash: string
  from: string
  to: string
  value: string // 以wei为单位的字符串
  valueFormatted: string // 格式化后的值
  symbol: string
  timestamp: number
  blockNumber: number
  gasUsed?: string
  gasPrice?: string
  status: 'success' | 'failed' | 'pending'
  type: 'send' | 'receive' | 'contract'
  chainId: number
  chainName: string
  explorerUrl?: string
}

export interface TokenTransfer {
  hash: string
  from: string
  to: string
  value: string
  valueFormatted: string
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  tokenDecimals: number
  timestamp: number
  blockNumber: number
  type: 'send' | 'receive'
  chainId: number
}

export interface TokenBalance {
  address: string
  name: string
  symbol: string
  decimals: number
  balance: string
  balanceFormatted: string
  usdValue?: number
  logoUrl?: string
}

export interface QueryOptions {
  limit?: number
  offset?: number
  startTime?: number
  endTime?: number
  sort?: 'asc' | 'desc'
}

export interface TransactionHistoryProvider {
  getTransactions(address: string, options?: QueryOptions): Promise<Transaction[]>
  getTokenTransfers(address: string, tokenAddress?: string): Promise<TokenTransfer[]>
  getBalance(address: string): Promise<string>
  getTokenBalances(address: string): Promise<TokenBalance[]>
  getChainInfo(): { chainId: number; name: string; symbol: string }
}

// 统一的错误类型
export class TransactionHistoryError extends Error {
  constructor(
    message: string, 
    public provider: string, 
    public chainId: number,
    public originalError?: any
  ) {
    super(message)
    this.name = 'TransactionHistoryError'
  }
}
