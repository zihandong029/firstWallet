import React, { useEffect, useState } from "react"

interface AuthorizeConnectionProps {
  origin: string
  onApprove: () => void
  onReject: () => void
}

export const AuthorizeConnection: React.FC<AuthorizeConnectionProps> = ({
  origin,
  onApprove,
  onReject
}) => {
  const [connecting, setConnecting] = useState(false)

  const handleApprove = () => {
    setConnecting(true)
    onApprove()
  }

  const handleReject = () => {
    onReject()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Connect to {new URL(origin).hostname}
          </h2>
          <p className="text-sm text-gray-600">
            This site is requesting to connect to your wallet
          </p>
        </div>

        {/* Connection Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Origin:</span>
            <span className="text-sm text-gray-900 font-mono">{origin}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              Permissions:
            </span>
            <span className="text-sm text-gray-900">Read wallet address</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Network:</span>
            <span className="text-sm text-gray-900">Ethereum Mainnet</span>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <svg
              className="w-5 h-5 text-yellow-400 mr-3 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800 mb-1">
                Be careful
              </h4>
              <p className="text-sm text-yellow-700">
                Only connect to websites you trust. This will allow the site to
                view your account balance and suggest transactions.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={handleReject}
            disabled={connecting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={connecting}
            className="flex-1 px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
            {connecting ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  )
}
