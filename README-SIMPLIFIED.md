# 简化版钱包扩展

这是一个基于 Plasmo 的简化版 EIP-6963 兼容钱包扩展。

## 核心文件

### 必需文件

- `background.ts` - 后台脚本，处理钱包逻辑
- `inject.js` - 注入到页面的 EIP-6963 提供者
- `contents/index.ts` - 内容脚本，连接页面和后台
- `popup.tsx` - 钱包弹窗界面

### 核心库

- `lib/wallet.ts` - 钱包管理核心逻辑
- `lib/permission-manager.ts` - 权限管理

### 组件

- `components/WalletSetup.tsx` - 钱包设置组件
- `components/WalletUnlock.tsx` - 钱包解锁组件
- `components/WalletDashboard.tsx` - 钱包仪表板
- `components/EIP6963AuthorizationPage.tsx` - EIP-6963 授权页面

### 测试

- `test-eip6963-debug.html` - EIP-6963 功能测试页面

## 开发命令

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 打包扩展
npm run package
```

## 功能特性

- ✅ EIP-6963 标准兼容
- ✅ 钱包创建和管理
- ✅ 账户导入和导出
- ✅ 权限管理
- ✅ 交易签名
- ✅ 消息签名

## 使用说明

1. 运行 `npm run dev` 启动开发服务器
2. 在 Chrome 中加载 `build/chrome-mv3-dev` 目录作为扩展
3. 打开 `test-eip6963-debug.html` 测试钱包功能
