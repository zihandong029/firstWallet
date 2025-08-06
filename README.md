# 浏览器钱包插件

一个类似 MetaMask 的以太坊钱包浏览器扩展，基于 Plasmo 框架开发。

## 功能特性

### 🔐 安全功能
- ✅ 助记词生成和恢复
- ✅ 密码加密存储
- ✅ 钱包锁定/解锁
- ✅ 私钥本地存储

### 💰 钱包功能
- ✅ 创建新钱包
- ✅ 导入现有钱包
- ✅ 多账户支持
- ✅ 账户切换
- ✅ 余额查询
- ✅ 发送交易

### 🌐 网络支持
- ✅ 以太坊主网
- ✅ Sepolia 测试网
- ✅ 可配置 RPC 节点

### 🔌 dApp 集成
- ✅ 兼容 MetaMask API
- ✅ 自动注入 `window.ethereum`
- ✅ 支持 `eth_requestAccounts`
- ✅ 支持 `eth_sendTransaction`
- ✅ 支持 `personal_sign`
- ✅ 支持余额查询等基础 RPC 方法

## 安装和开发

### 环境要求
- Node.js 16+
- pnpm

### 开发模式
```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev
```

### 构建生产版本
```bash
# 构建扩展
pnpm build

# 打包扩展
pnpm package
```

## 使用说明

### 首次使用
1. 安装扩展后，点击扩展图标
2. 选择"创建新钱包"或"导入钱包"
3. 设置密码（至少8位字符）
4. 如果创建新钱包，请安全保存助记词

### 日常使用
1. 点击扩展图标解锁钱包
2. 查看账户余额和地址
3. 发送交易或切换账户
4. 与 dApp 交互时会自动检测到钱包

### 与 dApp 交互
当访问支持以太坊的网站时，钱包会自动注入 `window.ethereum` 对象，dApp 可以通过以下方式与钱包交互：

```javascript
// 请求连接钱包
await window.ethereum.request({ method: 'eth_requestAccounts' })

// 发送交易
await window.ethereum.request({
  method: 'eth_sendTransaction',
  params: [{
    to: '0x...',
    value: '0x...',
    gas: '0x5208'
  }]
})

// 签名消息
await window.ethereum.request({
  method: 'personal_sign',
  params: ['要签名的消息', '0x用户地址']
})
```

## 技术架构

### 核心组件
- **钱包管理器** (`lib/wallet.ts`): 处理钱包创建、导入、签名等核心功能
- **用户界面** (`components/`): React 组件构建的用户界面
- **内容脚本** (`content.ts`): 与网页交互的桥梁
- **注入脚本** (`inject.js`): 提供 `window.ethereum` API
- **后台脚本** (`background.ts`): 处理钱包请求和权限管理

### 安全机制
- 使用 BIP39 标准生成助记词
- 使用 HD 钱包 (BIP44) 派生账户
- AES 加密存储敏感数据
- 密码验证和会话管理

### 依赖库
- **ethers.js**: 以太坊交互库
- **bip39**: 助记词生成和验证
- **hdkey**: HD 钱包密钥派生
- **crypto-js**: 加密解密
- **React**: 用户界面框架
- **Plasmo**: 浏览器扩展开发框架

## 注意事项

⚠️ **安全警告**：
- 请务必安全保存助记词，丢失后无法恢复钱包
- 不要在不安全的网络环境下使用
- 定期备份钱包数据
- 使用强密码保护钱包

⚠️ **测试建议**：
- 首次使用请在测试网络上进行
- 小额测试交易功能
- 确认安全后再使用主网

## 开发计划

### 即将添加的功能
- [ ] 交易历史记录
- [ ] 代币 (ERC-20) 支持
- [ ] NFT (ERC-721/ERC-1155) 支持
- [ ] 更多网络支持
- [ ] 地址簿功能
- [ ] 交易确认弹窗
- [ ] Gas 费优化建议

### 已知限制
- 目前只支持以太坊兼容网络
- 网络连接依赖外部 RPC 节点
- 暂不支持硬件钱包集成

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 许可证

MIT License
