import React, { useState } from "react"

interface EIP6963AuthorizationPageProps {
  requestId: string
  origin: string
  onClose: () => void
}

const EIP6963AuthorizationPage: React.FC<EIP6963AuthorizationPageProps> = ({
  requestId,
  origin,
  onClose
}) => {
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState("")

  const handleApprove = async () => {
    setApproving(true)
    setError("")

    try {
      console.log("✅ [授权页面] 用户批准授权:", requestId)

      // 通知 background script 用户批准了授权
      chrome.runtime.sendMessage({
        type: "AUTHORIZATION_RESPONSE",
        requestId: requestId,
        approved: true
      })

      // 关闭窗口
      window.close()
    } catch (err) {
      console.error("❌ [授权页面] 批准授权失败:", err)
      setError("批准授权失败")
      setApproving(false)
    }
  }

  const handleReject = async () => {
    try {
      console.log("❌ [授权页面] 用户拒绝授权:", requestId)

      // 通知 background script 用户拒绝了授权
      chrome.runtime.sendMessage({
        type: "AUTHORIZATION_RESPONSE",
        requestId: requestId,
        approved: false
      })

      // 关闭窗口
      window.close()
    } catch (err) {
      console.error("❌ [授权页面] 拒绝授权失败:", err)
      setError("拒绝授权失败")
    }
  }

  const formatOrigin = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace("www.", "")
    } catch {
      return url
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* 头部 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="text-2xl">🔐</div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">连接请求</h1>
          <p className="text-gray-600">
            <span className="font-semibold text-blue-600">
              {formatOrigin(origin)}
            </span>{" "}
            想要连接到您的钱包
          </p>
        </div>

        {/* DApp 信息 */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
              {formatOrigin(origin).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-800 text-lg">
                {formatOrigin(origin)}
              </div>
              <div className="text-sm text-gray-500">
                {origin}
              </div>
            </div>
          </div>
        </div>

        {/* 权限说明 */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">此应用将能够：</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-lg">👁️</div>
              <span className="text-sm text-gray-700 flex-1">
                查看您的账户地址和余额
              </span>
              <div className="text-blue-500 text-sm">✓</div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-lg">✍️</div>
              <span className="text-sm text-gray-700 flex-1">
                请求交易签名（需要您的确认）
              </span>
              <div className="text-blue-500 text-sm">✓</div>
            </div>
          </div>
        </div>

        {/* 安全提示 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-2">
            <div className="text-amber-500 mt-0.5">⚠️</div>
            <div className="text-sm text-amber-800">
              <div className="font-medium mb-1">安全提示</div>
              <div>只连接您信任的网站。恶意网站可能会盗取您的资产。</div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleApprove}
            disabled={approving}>
            {approving ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>连接中...</span>
              </span>
            ) : (
              "连接"
            )}
          </button>

          <button
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            onClick={handleReject}
            disabled={approving}>
            取消
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-700 text-sm text-center">{error}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EIP6963AuthorizationPage
