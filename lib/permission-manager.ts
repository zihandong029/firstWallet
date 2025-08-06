// 钱包授权机制实现
import { ethers } from 'ethers'

// 授权类型定义
export enum PermissionType {
  VIEW_BALANCE = 'view_balance',           // 查看余额
  SEND_TRANSACTION = 'send_transaction',   // 发送交易
  SIGN_MESSAGE = 'sign_message',           // 签名消息
  TOKEN_APPROVAL = 'token_approval',       // 代币授权
  NFT_APPROVAL = 'nft_approval'           // NFT授权
}

// 授权请求接口
export interface PermissionRequest {
  id: string
  dappUrl: string
  dappName: string
  dappIcon?: string
  permissions: PermissionType[]
  accounts?: string[]  // 请求访问的账户地址
  chainId?: number    // 请求的网络
  expiresAt?: number  // 过期时间戳
  metadata?: {
    description?: string
    amount?: string    // 授权金额限制
    tokenAddress?: string  // 代币合约地址
    nftAddress?: string   // NFT合约地址
    [key: string]: any
  }
}

// 已授权的权限
export interface GrantedPermission {
  id: string
  dappUrl: string
  dappName: string
  dappIcon?: string
  permissions: PermissionType[]
  accounts: string[]
  chainId: number
  grantedAt: number
  expiresAt?: number
  isActive: boolean
  usage: {
    lastUsed: number
    transactionCount: number
    totalAmount: string
  }
  metadata?: any
}

// 授权管理器
export class PermissionManager {
  private static instance: PermissionManager
  private permissions: Map<string, GrantedPermission> = new Map()
  private pendingRequests: Map<string, PermissionRequest> = new Map()
  
  static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager()
    }
    return PermissionManager.instance
  }

  // 加载已保存的授权
  async loadPermissions(): Promise<void> {
    try {
      const stored = localStorage.getItem('wallet_permissions')
      if (stored) {
        const data = JSON.parse(stored)
        this.permissions = new Map(data)
        console.log('✅ 已加载授权数据:', this.permissions.size, '个授权')
      }
    } catch (error) {
      console.error('❌ 加载授权数据失败:', error)
    }
  }

  // 保存授权到本地存储
  private async savePermissions(): Promise<void> {
    try {
      const data = Array.from(this.permissions.entries())
      localStorage.setItem('wallet_permissions', JSON.stringify(data))
      console.log('✅ 授权数据已保存')
    } catch (error) {
      console.error('❌ 保存授权数据失败:', error)
    }
  }

  // 请求权限
  async requestPermission(request: PermissionRequest): Promise<string> {
    console.log('📋 收到权限请求:', request)
    
    // 生成请求ID
    const requestId = `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    request.id = requestId
    
    // 验证请求
    if (!this.validatePermissionRequest(request)) {
      throw new Error('无效的权限请求')
    }
    
    // 检查是否已有相同的授权
    const existingPermission = this.findExistingPermission(request)
    if (existingPermission && existingPermission.isActive) {
      console.log('✅ 发现现有授权，直接返回')
      return existingPermission.id
    }
    
    // 存储待处理的请求
    this.pendingRequests.set(requestId, request)
    
    console.log('⏳ 权限请求已提交，等待用户确认:', requestId)
    return requestId
  }

  // 验证权限请求
  private validatePermissionRequest(request: PermissionRequest): boolean {
    if (!request.dappUrl || !request.permissions.length) {
      return false
    }
    
    // 验证URL格式
    try {
      new URL(request.dappUrl)
    } catch {
      return false
    }
    
    // 验证权限类型
    for (const permission of request.permissions) {
      if (!Object.values(PermissionType).includes(permission)) {
        return false
      }
    }
    
    return true
  }

  // 查找现有授权
  private findExistingPermission(request: PermissionRequest): GrantedPermission | null {
    for (const permission of this.permissions.values()) {
      if (permission.dappUrl === request.dappUrl && 
          permission.chainId === request.chainId &&
          this.hasRequiredPermissions(permission.permissions, request.permissions)) {
        return permission
      }
    }
    return null
  }

  // 检查是否包含所需权限
  private hasRequiredPermissions(granted: PermissionType[], required: PermissionType[]): boolean {
    return required.every(perm => granted.includes(perm))
  }

  // 用户批准权限
  async approvePermission(requestId: string, userAccounts: string[]): Promise<GrantedPermission> {
    const request = this.pendingRequests.get(requestId)
    if (!request) {
      throw new Error('权限请求不存在或已过期')
    }

    console.log('✅ 用户批准权限:', requestId)

    // 创建授权记录
    const permission: GrantedPermission = {
      id: `granted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dappUrl: request.dappUrl,
      dappName: request.dappName,
      dappIcon: request.dappIcon,
      permissions: request.permissions,
      accounts: userAccounts,
      chainId: request.chainId || 1,
      grantedAt: Date.now(),
      expiresAt: request.expiresAt,
      isActive: true,
      usage: {
        lastUsed: Date.now(),
        transactionCount: 0,
        totalAmount: '0'
      },
      metadata: request.metadata
    }

    // 保存授权
    this.permissions.set(permission.id, permission)
    await this.savePermissions()

    // 移除待处理请求
    this.pendingRequests.delete(requestId)

    console.log('✅ 权限已授予:', permission.id)
    return permission
  }

  // 用户拒绝权限
  async rejectPermission(requestId: string): Promise<void> {
    const request = this.pendingRequests.get(requestId)
    if (!request) {
      throw new Error('权限请求不存在')
    }

    console.log('❌ 用户拒绝权限:', requestId)
    this.pendingRequests.delete(requestId)
  }

  // 检查权限
  checkPermission(dappUrl: string, permission: PermissionType, account: string, chainId: number): boolean {
    for (const granted of this.permissions.values()) {
      if (granted.dappUrl === dappUrl &&
          granted.chainId === chainId &&
          granted.accounts.includes(account) &&
          granted.permissions.includes(permission) &&
          granted.isActive &&
          !this.isExpired(granted)) {
        return true
      }
    }
    return false
  }

  // 检查是否过期
  private isExpired(permission: GrantedPermission): boolean {
    if (!permission.expiresAt) return false
    return Date.now() > permission.expiresAt
  }

  // 撤销权限
  async revokePermission(permissionId: string): Promise<void> {
    const permission = this.permissions.get(permissionId)
    if (!permission) {
      throw new Error('权限不存在')
    }

    permission.isActive = false
    await this.savePermissions()
    console.log('✅ 权限已撤销:', permissionId)
  }

  // 撤销DApp的所有权限
  async revokeDappPermissions(dappUrl: string): Promise<void> {
    let revokedCount = 0
    for (const permission of this.permissions.values()) {
      if (permission.dappUrl === dappUrl && permission.isActive) {
        permission.isActive = false
        revokedCount++
      }
    }
    
    if (revokedCount > 0) {
      await this.savePermissions()
      console.log(`✅ 已撤销 ${dappUrl} 的 ${revokedCount} 个权限`)
    }
  }

  // 清理过期权限
  async cleanupExpiredPermissions(): Promise<void> {
    let cleanedCount = 0
    for (const permission of this.permissions.values()) {
      if (this.isExpired(permission)) {
        permission.isActive = false
        cleanedCount++
      }
    }
    
    if (cleanedCount > 0) {
      await this.savePermissions()
      console.log(`✅ 已清理 ${cleanedCount} 个过期权限`)
    }
  }

  // 获取所有有效权限
  getActivePermissions(): GrantedPermission[] {
    return Array.from(this.permissions.values())
      .filter(p => p.isActive && !this.isExpired(p))
      .sort((a, b) => b.grantedAt - a.grantedAt)
  }

  // 获取待处理的权限请求
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values())
  }

  // 更新使用统计
  async updateUsageStats(dappUrl: string, chainId: number, transactionAmount?: string): Promise<void> {
    for (const permission of this.permissions.values()) {
      if (permission.dappUrl === dappUrl && 
          permission.chainId === chainId && 
          permission.isActive) {
        permission.usage.lastUsed = Date.now()
        permission.usage.transactionCount++
        
        if (transactionAmount) {
          const currentTotal = ethers.parseEther(permission.usage.totalAmount || '0')
          const newAmount = ethers.parseEther(transactionAmount)
          permission.usage.totalAmount = ethers.formatEther(currentTotal + newAmount)
        }
        
        await this.savePermissions()
        break
      }
    }
  }

  // 批量撤销权限
  async batchRevokePermissions(permissionIds: string[]): Promise<void> {
    let revokedCount = 0
    for (const id of permissionIds) {
      const permission = this.permissions.get(id)
      if (permission && permission.isActive) {
        permission.isActive = false
        revokedCount++
      }
    }
    
    if (revokedCount > 0) {
      await this.savePermissions()
      console.log(`✅ 批量撤销了 ${revokedCount} 个权限`)
    }
  }
}

// 权限请求的简化工厂函数
export class PermissionRequestBuilder {
  private request: Partial<PermissionRequest> = {}

  static create(dappUrl: string, dappName: string): PermissionRequestBuilder {
    const builder = new PermissionRequestBuilder()
    builder.request.dappUrl = dappUrl
    builder.request.dappName = dappName
    builder.request.permissions = []
    return builder
  }

  addPermission(permission: PermissionType): PermissionRequestBuilder {
    if (!this.request.permissions) {
      this.request.permissions = []
    }
    this.request.permissions.push(permission)
    return this
  }

  setAccounts(accounts: string[]): PermissionRequestBuilder {
    this.request.accounts = accounts
    return this
  }

  setChainId(chainId: number): PermissionRequestBuilder {
    this.request.chainId = chainId
    return this
  }

  setExpiration(expiresAt: number): PermissionRequestBuilder {
    this.request.expiresAt = expiresAt
    return this
  }

  setMetadata(metadata: any): PermissionRequestBuilder {
    this.request.metadata = metadata
    return this
  }

  build(): PermissionRequest {
    if (!this.request.dappUrl || !this.request.dappName || !this.request.permissions?.length) {
      throw new Error('权限请求构建失败：缺少必要参数')
    }
    return this.request as PermissionRequest
  }
}

export default PermissionManager
