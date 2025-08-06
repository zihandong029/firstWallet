import React, { useState } from "react"

import { WalletManager } from "~lib/wallet"

interface WalletSetupProps {
  onWalletCreated: () => void
}

const WalletSetup: React.FC<WalletSetupProps> = ({ onWalletCreated }) => {
  const [mode, setMode] = useState<"create" | "import" | "importPrivateKey">(
    "create"
  )
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [mnemonic, setMnemonic] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [generatedMnemonic, setGeneratedMnemonic] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mnemonicConfirmed, setMnemonicConfirmed] = useState(false)

  const walletManager = WalletManager.getInstance()

  const handleCreateWallet = async () => {
    if (password !== confirmPassword) {
      setError("密码不匹配")
      return
    }

    if (password.length < 8) {
      setError("密码至少需要8位字符")
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = await walletManager.generateWallet(password)
      setGeneratedMnemonic(result.mnemonic)
      setStep(2)
    } catch (err) {
      setError("创建钱包失败: " + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleImportWallet = async () => {
    if (password !== confirmPassword) {
      setError("密码不匹配")
      return
    }

    if (password.length < 8) {
      setError("密码至少需要8位字符")
      return
    }

    if (!mnemonic.trim()) {
      setError("请输入助记词")
      return
    }

    setLoading(true)
    setError("")

    try {
      await walletManager.restoreWallet(mnemonic.trim(), password)
      onWalletCreated()
    } catch (err) {
      setError("导入钱包失败: " + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleImportPrivateKey = async () => {
    if (password !== confirmPassword) {
      setError("密码不匹配")
      return
    }

    if (password.length < 8) {
      setError("密码至少需要8位字符")
      return
    }

    if (!privateKey.trim()) {
      setError("请输入私钥")
      return
    }

    setLoading(true)
    setError("")

    try {
      await walletManager.importFromPrivateKey(privateKey.trim(), password)
      onWalletCreated()
    } catch (err) {
      setError("导入钱包失败: " + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmMnemonic = () => {
    if (mnemonicConfirmed) {
      onWalletCreated()
    } else {
      setMnemonicConfirmed(true)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("复制失败:", err)
    }
  }

  if (step === 2 && mode === "create") {
    return (
      <div className="form-container">
        <h1 className="text-2xl font-bold text-white text-center mb-4">
          备份助记词
        </h1>
        <p className="text-white/80 text-center mb-6 leading-relaxed">
          请将下面的助记词安全保存，这是恢复钱包的唯一方式。不要与任何人分享！
        </p>

        <div className="bg-red-50/90 border border-red-200 rounded-lg p-4 mb-6 backdrop-blur-sm">
          <div className="text-red-800 text-sm font-medium text-center">
            ⚠️ 请务必将助记词抄写在纸上并安全保存
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {generatedMnemonic.split(" ").map((word, index) => (
              <div
                key={index}
                className="bg-white/20 rounded-lg p-3 text-center">
                <span className="text-white/60 text-xs block mb-1">
                  {index + 1}
                </span>
                <span className="text-white font-medium">{word}</span>
              </div>
            ))}
          </div>
          <button
            className="w-full py-3 px-4 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium border border-white/30"
            onClick={() => copyToClipboard(generatedMnemonic)}>
            📋 复制助记词
          </button>
        </div>

        {!mnemonicConfirmed ? (
          <button
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
            onClick={handleConfirmMnemonic}>
            我已安全保存助记词
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50/90 border border-green-200 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-green-700 font-medium text-center">
                ✅ 助记词已确认，钱包创建成功！
              </div>
            </div>
            <button
              className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
              onClick={handleConfirmMnemonic}>
              进入钱包
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="form-container">
      <h1 className="form-title text-white">设置钱包2</h1>
      <p className="form-subtitle text-white/80">
        选择创建新钱包或导入已有钱包
      </p>

      {/* 模式选择器 */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
        <button
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            mode === "create"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
          onClick={() => setMode("create")}>
          创建新钱包
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            mode === "import"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
          onClick={() => setMode("import")}>
          导入助记词
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            mode === "importPrivateKey"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
          onClick={() => setMode("importPrivateKey")}>
          导入私钥
        </button>
      </div>

      {mode === "create" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              设置密码
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少8位字符"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              确认密码
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="重复输入密码"
            />
          </div>

          <div className="bg-yellow-50/90 border border-yellow-200 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-yellow-800 text-sm font-medium">
              ⚠️ 请妥善保管密码，密码丢失将无法恢复钱包
            </div>
          </div>

          {error && (
            <div className="bg-red-50/90 border border-red-200 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-red-700 text-sm font-medium text-center">
                {error}
              </div>
            </div>
          )}

          <button
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            onClick={handleCreateWallet}
            disabled={loading || !password || !confirmPassword}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                创建中...
              </span>
            ) : (
              "创建钱包"
            )}
          </button>
        </div>
      )}

      {mode === "import" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              助记词
            </label>
            <textarea
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-200 min-h-[100px] resize-vertical"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="输入12个单词的助记词，用空格分隔"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              设置密码
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少8位字符"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              确认密码
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="重复输入密码"
            />
          </div>

          {error && (
            <div className="bg-red-50/90 border border-red-200 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-red-700 text-sm font-medium text-center">
                {error}
              </div>
            </div>
          )}

          <button
            className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            onClick={handleImportWallet}
            disabled={loading || !password || !confirmPassword || !mnemonic}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                导入中...
              </span>
            ) : (
              "导入钱包"
            )}
          </button>
        </div>
      )}

      {mode === "importPrivateKey" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              私钥
            </label>
            <textarea
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-200 min-h-[100px] resize-vertical font-mono text-sm"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="输入私钥（64位十六进制字符串，可选择是否包含0x前缀）"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              设置密码
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少8位字符"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              确认密码
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="重复输入密码"
            />
          </div>

          <div className="bg-orange-50/90 border border-orange-200 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-orange-800 text-sm font-medium">
              ⚠️ 私钥导入后无法查看助记词，请确保私钥安全保存
            </div>
          </div>

          {error && (
            <div className="bg-red-50/90 border border-red-200 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-red-700 text-sm font-medium text-center">
                {error}
              </div>
            </div>
          )}

          <button
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            onClick={handleImportPrivateKey}
            disabled={loading || !password || !confirmPassword || !privateKey}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                导入中...
              </span>
            ) : (
              "导入钱包"
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default WalletSetup
