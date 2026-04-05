import React, { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'split' | 'keep'>('split')
  const [pageNumbers, setPageNumbers] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setError(null)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please upload a PDF file first.")
      return
    }
    if (!pageNumbers.trim()) {
      setError("Please enter page numbers.")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    
    let endpoint = '/api/split'
    if (mode === 'split') {
      formData.append('pages_for_pdf1', pageNumbers)
    } else {
      endpoint = '/api/keep'
      formData.append('pages_to_keep', pageNumbers)
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'Something went wrong')
      }

      // Handle file download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = mode === 'split' ? 'split_pdfs.zip' : 'kept_pages.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 p-8 flex items-center justify-center font-sans">
      <div className="max-w-xl w-full bg-background border border-border shadow-sm rounded-xl p-8">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">PDF Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">Split or keep specific pages of your PDF files locally.</p>
        </div>

        {/* Dropzone */}
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-3">
            {file ? (
              <>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <UploadCloud className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    <span className="text-primary hover:underline">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PDF files up to 50MB</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Panel */}
        {file && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Tabs */}
            <div className="flex p-1 space-x-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setMode('split')}
                className={`flex-1 text-sm font-medium px-3 py-2 rounded-md transition-all ${
                  mode === 'split' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Split PDF
              </button>
              <button
                type="button"
                onClick={() => setMode('keep')}
                className={`flex-1 text-sm font-medium px-3 py-2 rounded-md transition-all ${
                  mode === 'keep' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Keep Pages
              </button>
            </div>

            <div className="space-y-3">
              <label htmlFor="pages" className="text-sm font-medium text-foreground block">
                {mode === 'split' ? 'Pages to split into first file:' : 'Pages to keep:'}
              </label>
              <input
                id="pages"
                type="text"
                placeholder="e.g. 1, 2, 3"
                value={pageNumbers}
                onChange={(e) => setPageNumbers(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              />
              <p className="text-xs text-muted-foreground">
                Enter comma-separated page numbers (1-based indexing).
              </p>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md text-sm">
                <AlertCircle className="h-4 w-4" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 h-10 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>{mode === 'split' ? 'Split & Download ZIP' : 'Keep Pages & Download PDF'}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
