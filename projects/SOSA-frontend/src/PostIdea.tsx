// src/components/PostIdea.tsx
import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface PostIdeaProps {
  openModal: boolean
  setModalState: (state: boolean) => void
  walletAddress: string
}

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const PostIdea: React.FC<PostIdeaProps> = ({ openModal, setModalState, walletAddress }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    moneyNeeded: '',
    shareOffered: '',
    duration: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + parseInt(formData.duration))

      const { data, error: supabaseError } = await supabase
        .from('startup_ideas')
        .insert([
          {
            wallet_address: walletAddress,
            title: formData.title,
            description: formData.description,
            image_url: formData.imageUrl || null,
            money_needed: parseFloat(formData.moneyNeeded),
            share_offered: formData.shareOffered,
            end_date: endDate.toISOString(),
            status: 'open',
            created_at: new Date().toISOString()
          }
        ])
        .select()

      if (supabaseError) throw supabaseError

      // Reset form and close modal
      setFormData({
        title: '',
        description: '',
        imageUrl: '',
        moneyNeeded: '',
        shareOffered: '',
        duration: ''
      })
      setModalState(false)
      alert('Idea posted successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post idea')
    } finally {
      setLoading(false)
    }
  }

  if (!openModal) return null

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">Post Your Startup Idea</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text">Title *</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter idea title"
              className="input input-bordered w-full"
              required
            />
          </div>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text">Description *</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your startup idea"
              className="textarea textarea-bordered h-24"
              required
            />
          </div>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text">Image URL (optional)</span>
            </label>
            <input
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/image.jpg"
              className="input input-bordered w-full"
            />
          </div>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text">Money Needed (USDC) *</span>
            </label>
            <input
              type="number"
              name="moneyNeeded"
              value={formData.moneyNeeded}
              onChange={handleInputChange}
              placeholder="10000"
              className="input input-bordered w-full"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text">Share Offered *</span>
            </label>
            <input
              type="text"
              name="shareOffered"
              value={formData.shareOffered}
              onChange={handleInputChange}
              placeholder="1% equity for 500 USDC"
              className="input input-bordered w-full"
              required
            />
          </div>

          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text">Duration (days) *</span>
            </label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
              placeholder="30"
              className="input input-bordered w-full"
              required
              min="1"
            />
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() => setModalState(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Posting...' : 'Post Idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PostIdea
