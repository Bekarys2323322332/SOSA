import React, { useState, useEffect } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { useSnackbar } from 'notistack'
import { supabase } from '../utils/supabaseClient'

interface InvestorViewProps {
  walletAddress: string
}

interface StartupIdea {
  id: string
  wallet_address: string
  title: string
  description: string
  image_url: string | null
  money_needed: number
  share_offered: string
  end_date: string
  status: 'open' | 'funded' | 'expired'
  created_at: string
}

const InvestorView: React.FC<InvestorViewProps> = ({ walletAddress }) => {
  const [ideas, setIdeas] = useState<StartupIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [investAmount, setInvestAmount] = useState<{ [key: string]: string }>({})
  const [investingId, setInvestingId] = useState<string | null>(null)
  const { activeAddress, transactionSigner, algodClient } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  useEffect(() => {
    fetchIdeas()

    // Set up real-time subscription
    const subscription = supabase
      .channel('startup_ideas_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'startup_ideas' }, () => {
        fetchIdeas()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchIdeas = async () => {
    try {
      const { data, error } = await supabase
        .from('startup_ideas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Update status based on end date
      const updatedIdeas = await Promise.all(
        (data || []).map(async (idea) => {
          const now = new Date()
          const endDate = new Date(idea.end_date)

          if (idea.status === 'open' && now > endDate) {
            // Update to expired
            await supabase
              .from('startup_ideas')
              .update({ status: 'expired' })
              .eq('id', idea.id)

            return { ...idea, status: 'expired' as const }
          }

          return idea
        })
      )

      setIdeas(updatedIdeas)
    } catch (error) {
      console.error('Error fetching ideas:', error)
      enqueueSnackbar('Failed to fetch ideas', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleInvest = async (idea: StartupIdea) => {
    const amount = parseFloat(investAmount[idea.id] || '0')

    if (amount <= 0) {
      enqueueSnackbar('Please enter a valid amount', { variant: 'warning' })
      return
    }

    if (amount > idea.money_needed) {
      enqueueSnackbar('Amount exceeds money needed', { variant: 'warning' })
      return
    }

    setInvestingId(idea.id)

    try {
      // Get suggested params from algod
      const suggestedParams = await algodClient.getTransactionParams().do()

      // Convert USDC amount to microalgos (assuming USDC asset, adjust if using ALGO)
      // For ALGO: multiply by 1,000,000 (microalgos)
      // For USDC asset: use the actual amount (usually 6 decimals)
      const amountInMicroUnits = Math.floor(amount * 1_000_000)

      // Create payment transaction to startup's wallet
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress!,
        receiver: idea.wallet_address,
        amount: amountInMicroUnits,
        note: new Uint8Array(Buffer.from(`Investment in: ${idea.title}`)),
        suggestedParams,
      })

      // Sign and send transaction using the wallet's transaction signer
      const encodedTxn = algosdk.encodeUnsignedTransaction(txn)
      const signedTxns = await transactionSigner([txn], [0])

      // Send transaction to network
      const { txid } = await algodClient.sendRawTransaction(signedTxns[0]).do()

      enqueueSnackbar('Transaction sent! Waiting for confirmation...', { variant: 'info' })

      // Wait for confirmation
      await algosdk.waitForConfirmation(algodClient, txid, 4)

      // Calculate share percentage based on investment
      const sharePercentage = (amount / idea.money_needed) * 100

      // Save investment to database
      const { error: investmentError } = await supabase
        .from('investments')
        .insert([
          {
            idea_id: idea.id,
            investor_address: walletAddress,
            amount: amount,
            share_percentage: sharePercentage,
            transaction_id: txid,
            invested_at: new Date().toISOString()
          }
        ])

      if (investmentError) throw investmentError

      // Get total invested amount for this idea
      const { data: allInvestments, error: sumError } = await supabase
        .from('investments')
        .select('amount')
        .eq('idea_id', idea.id)

      if (sumError) throw sumError

      const totalInvested = allInvestments.reduce((sum, inv) => sum + inv.amount, 0)

      // Update idea status if fully funded
      if (totalInvested >= idea.money_needed) {
        await supabase
          .from('startup_ideas')
          .update({ status: 'funded' })
          .eq('id', idea.id)
      }

      enqueueSnackbar(
        `Successfully invested ${amount} ALGO! You now own ${sharePercentage.toFixed(2)}% share.`,
        { variant: 'success' }
      )

      setInvestAmount(prev => ({ ...prev, [idea.id]: '' }))
      fetchIdeas()
    } catch (error) {
      console.error('Investment error:', error)
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Failed to process investment',
        { variant: 'error' }
      )
    } finally {
      setInvestingId(null)
    }
  }

  const handleAmountChange = (ideaId: string, value: string) => {
    setInvestAmount(prev => ({ ...prev, [ideaId]: value }))
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-2">Loading ideas...</p>
      </div>
    )
  }

  if (ideas.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No startup ideas available yet.</p>
      </div>
    )
  }

  return (
    <div className="mt-6 w-full">
      <h2 className="text-2xl font-bold mb-4">Available Startup Ideas</h2>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {ideas.map((idea) => (
          <div key={idea.id} className="card bg-base-100 shadow-xl border">
            {idea.image_url && (
              <figure>
                <img
                  src={idea.image_url}
                  alt={idea.title}
                  className="h-48 w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </figure>
            )}
            <div className="card-body p-4">
              <h3 className="card-title text-lg">{idea.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-3">{idea.description}</p>

              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div>
                  <span className="font-semibold">Needed:</span> {idea.money_needed.toLocaleString()} ALGO
                </div>
                <div>
                  <span className="font-semibold">Share:</span> {idea.share_offered}
                </div>
                <div className="col-span-2">
                  <span className="font-semibold">Ends:</span> {new Date(idea.end_date).toLocaleDateString()}
                </div>
                <div className="col-span-2">
                  <span className={`badge badge-sm ${idea.status === 'open' ? 'badge-success' :
                    idea.status === 'funded' ? 'badge-info' :
                      'badge-error'
                    }`}>
                    {idea.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {idea.status === 'open' && (
                <div className="card-actions mt-4">
                  <div className="join w-full">
                    <input
                      type="number"
                      placeholder="Amount (ALGO)"
                      className="input input-bordered input-sm join-item flex-1"
                      value={investAmount[idea.id] || ''}
                      onChange={(e) => handleAmountChange(idea.id, e.target.value)}
                      min="0"
                      step="0.01"
                      disabled={investingId === idea.id}
                    />
                    <button
                      className="btn btn-primary btn-sm join-item"
                      onClick={() => handleInvest(idea)}
                      disabled={investingId === idea.id}
                    >
                      {investingId === idea.id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        'Invest'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default InvestorView
