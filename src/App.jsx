import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const ADMIN_PASSWORD = 'goodmate1998-2026'
const DOWNVOTE_THRESHOLD = 3

function getAnonId() {
  let id = localStorage.getItem('anon_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('anon_id', id)
  }
  return id
}

function hasRepliedToday() {
  const last = localStorage.getItem('last_replied')
  if (!last) return false
  return new Date(last).toDateString() === new Date().toDateString()
}

function markRepliedToday() {
  localStorage.setItem('last_replied', new Date().toISOString())
}

const anonId = getAnonId()

export default function App() {
  const [page, setPage] = useState('prompt')
  const [randomPost, setRandomPost] = useState(null)
  const [reply, setReply] = useState('')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [replies, setReplies] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [voted, setVoted] = useState({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminInput, setAdminInput] = useState('')
  const [showAdminLogin, setShowAdminLogin] = useState(false)

  useEffect(() => {
    if (hasRepliedToday()) {
      setPage('feed')
      fetchPosts()
    } else {
      fetchRandomPost()
    }
  }, [])

  async function fetchRandomPost() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('posts')
      .select('*')
      .gte('created_at', sevenDaysAgo)
      .lt('downvotes', DOWNVOTE_THRESHOLD)
    if (data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)]
      setRandomPost(random)
    } else {
      setPage('new')
    }
  }

  async function fetchPosts() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('posts')
      .select('*')
      .gte('created_at', sevenDaysAgo)
      .lt('downvotes', DOWNVOTE_THRESHOLD)
      .order('created_at', { ascending: false })
    setPosts(data || [])
  }

  async function fetchReplies(postId) {
    const { data } = await supabase
      .from('replies')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    setReplies(data || [])
  }

  async function submitPromptReply() {
    if (!reply.trim()) return
    await supabase.from('replies').insert({
      post_id: randomPost.id,
      content: reply,
      anon_id: anonId
    })
    markRepliedToday()
    setReply('')
    await fetchPosts()
    setPage('feed')
  }

  async function submitReply() {
    if (!reply.trim()) return
    await supabase.from('replies').insert({
      post_id: selectedPost.id,
      content: reply,
      anon_id: anonId
    })
    setReply('')
    fetchReplies(selectedPost.id)
  }

  async function submitPost() {
    if (!title.trim()) return
    await supabase.from('posts').insert({ title, content, anon_id: anonId })
    setTitle('')
    setContent('')
    await fetchPosts()
    setPage('feed')
  }

  async function handleVote(post, type) {
    const current = voted[post.id]

    if (current === type) {
      if (type === 'up') {
        await supabase.rpc('decrement_upvotes', { post_id: post.id })
      } else {
        await supabase.rpc('decrement_downvotes', { post_id: post.id })
      }
      setVoted(prev => ({ ...prev, [post.id]: null }))
      setPosts(prev => prev.map(p => p.id === post.id
        ? {
            ...p,
            upvotes: type === 'up' ? p.upvotes - 1 : p.upvotes,
            downvotes: type === 'down' ? p.downvotes - 1 : p.downvotes
          }
        : p
      ))
      return
    }

    if (current === 'up') {
      await supabase.rpc('decrement_upvotes', { post_id: post.id })
    } else if (current === 'down') {
      await supabase.rpc('decrement_downvotes', { post_id: post.id })
    }

    if (type === 'up') {
      await supabase.rpc('increment_upvotes', { post_id: post.id })
    } else {
      await supabase.rpc('increment_downvotes', { post_id: post.id })
    }

    setVoted(prev => ({ ...prev, [post.id]: type }))
    setPosts(prev => prev.map(p => p.id === post.id
      ? {
          ...p,
          upvotes: type === 'up' ? p.upvotes + 1 : (current === 'up' ? p.upvotes - 1 : p.upvotes),
          downvotes: type === 'down' ? p.downvotes + 1 : (current === 'down' ? p.downvotes - 1 : p.downvotes)
        }
      : p
    ))
  }

  async function deletePost(postId) {
    await supabase.from('posts').delete().eq('id', postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  async function deleteReply(replyId) {
    await supabase.from('replies').delete().eq('id', replyId)
    setReplies(prev => prev.filter(r => r.id !== replyId))
  }

  function handleAdminLogin() {
    if (adminInput === ADMIN_PASSWORD) {
      setIsAdmin(true)
      setShowAdminLogin(false)
      setAdminInput('')
    } else {
      alert('Wrong password')
    }
  }

  function openPost(post) {
    setSelectedPost(post)
    fetchReplies(post.id)
    setPage('post')
  }

  if (page === 'prompt') return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Goodmate</h1>
      {randomPost ? (
        <>
          <p className="text-sm text-gray-400 mb-4">Reply to this post to unlock posting for today</p>
          <div className="border border-gray-200 rounded-xl p-4 mb-4">
            <p className="font-semibold text-lg">{randomPost.title}</p>
            {randomPost.content && <p className="text-gray-600 mt-1">{randomPost.content}</p>}
            <p className="text-xs text-gray-400 mt-2">Anon · {new Date(randomPost.created_at).toLocaleString()}</p>
          </div>
          <textarea
            placeholder="Write a reply..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-3 h-24 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black mb-3"
          />
          <button
            onClick={submitPromptReply}
            className="bg-black text-white px-5 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
          >
            Reply & Enter
          </button>
        </>
      ) : (
        <p className="text-gray-400">Loading...</p>
      )}
    </div>
  )

  if (page === 'feed') return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1
          className="text-3xl font-bold cursor-pointer"
          onClick={() => setShowAdminLogin(prev => !prev)}
        >
          Goodmate
        </h1>
        <div className="flex gap-2 items-center">
          {isAdmin && (
            <span className="text-xs text-green-600 font-medium">Admin</span>
          )}
          <button
            onClick={() => setPage('new')}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
          >
            + New Post
          </button>
        </div>
      </div>

      {showAdminLogin && !isAdmin && (
        <div className="border border-gray-200 rounded-xl p-4 mb-4 flex gap-2">
          <input
            type="password"
            placeholder="Admin password"
            value={adminInput}
            onChange={e => setAdminInput(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            onClick={handleAdminLogin}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
          >
            Enter
          </button>
        </div>
      )}

      {posts.length === 0 && (
        <p className="text-gray-400 text-sm">No posts yet. Be the first!</p>
      )}

      {posts.map(post => (
        <div key={post.id} className="border border-gray-200 rounded-xl p-4 mb-3">
          <div onClick={() => openPost(post)} className="cursor-pointer mb-3">
            <p className="font-semibold">{post.title}</p>
            <p className="text-xs text-gray-400 mt-1">Anon · {new Date(post.created_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => handleVote(post, 'up')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                voted[post.id] === 'up'
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-400'
              }`}
            >
              ❤️ {post.upvotes}
            </button>
            <button
              onClick={() => handleVote(post, 'down')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                voted[post.id] === 'down'
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              🌫️ {post.downvotes}
            </button>
            {isAdmin && (
              <button
                onClick={() => deletePost(post.id)}
                className="ml-auto text-xs text-red-400 hover:text-red-600 transition"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  if (page === 'post') return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <button
        onClick={() => setPage('feed')}
        className="text-sm text-gray-500 hover:text-black mb-4 inline-block"
      >
        ← Back
      </button>
      <h2 className="text-2xl font-bold mb-2">{selectedPost.title}</h2>
      {selectedPost.content && <p className="text-gray-600 mb-4">{selectedPost.content}</p>}
      <hr className="mb-4" />
      <h3 className="font-semibold mb-3">Replies</h3>
      {replies.length === 0 && <p className="text-sm text-gray-400 mb-4">No replies yet.</p>}
      {replies.map(r => (
        <div key={r.id} className="border-b border-gray-100 py-3 flex justify-between items-start">
          <div>
            <p className="text-sm">{r.content}</p>
            <p className="text-xs text-gray-400 mt-1">Anon · {new Date(r.created_at).toLocaleString()}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => deleteReply(r.id)}
              className="text-xs text-red-400 hover:text-red-600 transition ml-4 shrink-0"
            >
              Delete
            </button>
          )}
        </div>
      ))}
      <div className="mt-4">
        <textarea
          placeholder="Write a reply..."
          value={reply}
          onChange={e => setReply(e.target.value)}
          className="w-full border border-gray-200 rounded-lg p-3 h-24 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black mb-3"
        />
        <button
          onClick={submitReply}
          className="bg-black text-white px-5 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
        >
          Reply
        </button>
      </div>
    </div>
  )

  if (page === 'new') return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <button
        onClick={() => setPage('feed')}
        className="text-sm text-gray-500 hover:text-black mb-4 inline-block"
      >
        ← Back
      </button>
      <h2 className="text-2xl font-bold mb-4">New Post</h2>
      <input
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full border border-gray-200 rounded-lg p-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-black"
      />
      <textarea
        placeholder="Content (optional)"
        value={content}
        onChange={e => setContent(e.target.value)}
        className="w-full border border-gray-200 rounded-lg p-3 h-24 text-sm resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-black"
      />
      <button
        onClick={submitPost}
        className="bg-black text-white px-5 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
      >
        Post
      </button>
    </div>
  )
}