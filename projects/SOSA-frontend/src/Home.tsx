// src/components/Home.tsx
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import PostIdea from './PostIdea'
import InvestorView from './InvestorView'

interface HomeProps { }

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [userType, setUserType] = useState<'startuper' | 'investor' | null>(null)
  const [openPostModal, setOpenPostModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  const selectUserType = (type: 'startuper' | 'investor') => {
    setUserType(type)
    if (type === 'startuper') {
      setOpenPostModal(true)
    }
  }

  const resetUserType = () => {
    setUserType(null)
    setOpenPostModal(false)
  }

  return (
    <div className="hero min-h-screen bg-teal-400">
      <div className="hero-content text-center rounded-lg p-6 max-w-md bg-white mx-auto">
        <div className="max-w-md">
          <h1 className="text-4xl">
            Welcome to <div className="font-bold">AlmatyInvestments</div>
          </h1>

          <div className="grid">
            <div className="divider" />

            {!activeAddress ? (
              <button data-test-id="connect-wallet" className="btn m-2" onClick={toggleWalletModal}>
                Wallet Connection
              </button>
            ) : !userType ? (
              <>
                <p className="mb-4 text-gray-600">Choose your role:</p>
                <button
                  data-test-id="select-startuper"
                  className="btn btn-primary m-2"
                  onClick={() => selectUserType('startuper')}
                >
                  I'm a Startuper
                </button>
                <button
                  data-test-id="select-investor"
                  className="btn btn-secondary m-2"
                  onClick={() => selectUserType('investor')}
                >
                  I'm an Investor
                </button>
                <button
                  className="btn btn-ghost btn-sm m-2"
                  onClick={toggleWalletModal}
                >
                  Change Wallet
                </button>
              </>
            ) : (
              <button
                className="btn btn-ghost m-2"
                onClick={resetUserType}
              >
                ← Back to Role Selection
              </button>
            )}
          </div>

          {userType === 'startuper' && (
            <PostIdea
              openModal={openPostModal}
              setModalState={setOpenPostModal}
              walletAddress={activeAddress!}
            />
          )}

          {userType === 'investor' && (
            <InvestorView walletAddress={activeAddress!} />
          )}

          <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
        </div>
      </div>
    </div>
  )
}

export default Home
