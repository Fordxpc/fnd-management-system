import { useState } from 'react';
import './App.css';

function App() {
  const [isOwner, setIsOwner] = useState(true);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Funadhoo Airport</h1>
          <p className="text-slate-500 mt-2">Staff Duty & Leave Management</p>
        </div>

        {/* Role Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-md mb-6">
          <button 
            className={`flex-1 py-2 rounded-md font-medium ${isOwner ? 'bg-blue-600 text-white shadow' : 'text-slate-600'}`}
            onClick={() => setIsOwner(true)}
          >
            Owner / Manager
          </button>
          <button 
            className={`flex-1 py-2 rounded-md font-medium ${!isOwner ? 'bg-blue-600 text-white shadow' : 'text-slate-600'}`}
            onClick={() => setIsOwner(false)}
          >
            Staff
          </button>
        </div>

        {/* Sign In Form */}
        <p className="text-slate-600 mb-6 text-sm">
          {isOwner ? 'Sign in to manage your airport roster' : 'Sign in to view your schedule'}
        </p>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              placeholder="name@funadhooairport.com" 
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              placeholder="Your password" 
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition duration-200"
          >
            Sign In
          </button>
        </form>

        <div className="text-center mt-6">
          <a href="#" className="text-sm text-blue-600 hover:underline">Forgot password?</a>
          <p className="text-sm text-slate-500 mt-2">
            No account? <a href="#" className="text-blue-600 hover:underline">Register</a>
          </p>
        </div>

      </div>
    </div>
  );
}

export default App;