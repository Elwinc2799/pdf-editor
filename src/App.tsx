import { useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, Loader2, AlertCircle, Plus, Minus, Download, FileText } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'

// Setup pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// Helper to convert array of pages to string like "1, 3, 5-7" - actually, just comma separated for simplicity
const formatPages = (pages: number[]) => {
  return [...pages].sort((a, b) => a - b).join(', ')
}

// Helper to parse string "1, 3" back to array [1, 3]
const parsePages = (str: string, max: number) => {
  const parts = str.split(',')
  const res = new Set<number>()
  for (const p of parts) {
    const n = parseInt(p.trim())
    if (!isNaN(n) && n > 0 && n <= max) {
      res.add(n)
    }
  }
  return Array.from(res).sort((a, b) => a - b)
}

const Thumbnail = ({ pdfDoc, pageNum, isActive, onClick }: { pdfDoc: any, pageNum: number, isActive: boolean, onClick: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let renderTask: any = null
    let isCancelled = false

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum)
        if (isCancelled) return
        
        const viewport = page.getViewport({ scale: 1 })
        const canvas = canvasRef.current
        if (!canvas) return

        const scale = 140 / viewport.width
        const scaledViewport = page.getViewport({ scale })

        canvas.height = scaledViewport.height
        canvas.width = scaledViewport.width

        const renderContext = {
          canvasContext: canvas.getContext('2d')!,
          viewport: scaledViewport,
        }

        renderTask = page.render(renderContext)
        await renderTask.promise
      } catch (err) {
        // ignore cancellation errors
      }
    }
    renderPage()

    return () => {
      isCancelled = true
      if (renderTask) {
        renderTask.cancel()
      }
    }
  }, [pdfDoc, pageNum])

  return (
    <div 
      onClick={onClick}
      className={`relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all flex-shrink-0 bg-white ${isActive ? 'border-primary ring-4 ring-primary/20 scale-105 shadow-md' : 'border-border hover:border-primary/50 shadow-sm'}`}
      style={{ width: 144 }}
    >
      <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10 pointer-events-none">
        {pageNum}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 hover:opacity-100 transition-opacity z-0 pointer-events-none" />
      <canvas ref={canvasRef} className="block w-full h-auto" />
    </div>
  )
}

type Bucket = {
  id: string
  name: string
  pages: number[]
}

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [numPages, setNumPages] = useState(0)
  
  const [buckets, setBuckets] = useState<Bucket[]>([{ id: '1', name: 'Document 1', pages: [] }])
  const [activeBucketId, setActiveBucketId] = useState('1')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0]
      setFile(f)
      setError(null)
      setPdfDoc(null)
      setNumPages(0)
      
      try {
        const arrayBuffer = await f.arrayBuffer()
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        setPdfDoc(doc)
        setNumPages(doc.numPages)
      } catch (err: any) {
        setError("Could not parse PDF. Make sure it is a valid file.")
      }
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  })

  const handleThumbnailClick = (pageNum: number) => {
    setBuckets(prev => prev.map(b => {
      if (b.id === activeBucketId) {
        const has = b.pages.includes(pageNum)
        const newPages = has ? b.pages.filter(p => p !== pageNum) : [...b.pages, pageNum]
        return { ...b, pages: newPages.sort((x, y) => x - y) }
      }
      return b
    }))
  }

  const handleAddBucket = () => {
    const newId = Math.random().toString(36).substring(7)
    setBuckets(prev => [...prev, { id: newId, name: `Document ${prev.length + 1}`, pages: [] }])
    setActiveBucketId(newId)
  }

  const handleRemoveBucket = (id: string) => {
    setBuckets(prev => {
      const next = prev.filter(b => b.id !== id)
      if (next.length > 0 && activeBucketId === id) {
        setActiveBucketId(next[next.length - 1].id)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (!file) {
      setError("Please upload a PDF file first.")
      return
    }

    const emptyBuckets = buckets.some(b => b.pages.length === 0)
    if (emptyBuckets) {
      setError("All output documents must have at least one page assigned.")
      return
    }

    setLoading(true)
    setError(null)

    // Convert 1-based frontend indexing to 0-based backend indexing
    const config = buckets.map(b => ({
      name: b.name,
      pages: b.pages.map(p => p - 1)
    }))

    const formData = new FormData()
    formData.append('file', file)
    formData.append('config', JSON.stringify(config))

    try {
      const response = await fetch('/api/advanced-split', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'Something went wrong')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'split_pdfs.zip'
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
    <div className="min-h-screen bg-muted/20 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Interactive PDF Splitter</h1>
            <p className="text-sm text-muted-foreground mt-1">Upload a PDF, preview pages, and visually create multiple output files.</p>
          </div>
        </div>

        {/* Upload Zone */}
        {!pdfDoc && (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors bg-white ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-medium text-foreground">
                  <span className="text-primary hover:underline">Click to upload</span> or drag and drop
                </p>
                <p className="text-sm text-muted-foreground mt-1">Select a PDF to start previewing pages</p>
              </div>
            </div>
          </div>
        )}

        {/* Workspace */}
        {pdfDoc && (
          <div className="space-y-6 animate-in fade-in duration-500">
            
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-border">
              <div className="flex items-center space-x-3">
                <FileText className="text-primary h-6 w-6" />
                <div>
                  <p className="font-semibold text-sm truncate max-w-md">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">{numPages} Pages</p>
                </div>
              </div>
              <button 
                onClick={() => { setFile(null); setPdfDoc(null); setBuckets([{ id: '1', name: 'Document 1', pages: [] }]) }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Change File
              </button>
            </div>

            {/* Top Section: Previews */}
            <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/10">
                <h3 className="font-semibold text-sm">Page Preview</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Click a page to add/remove it from the active document below.</p>
              </div>
              <div className="p-4 flex space-x-4 overflow-x-auto pb-6 scrollbar-thin">
                {Array.from({ length: numPages }).map((_, i) => {
                  const pageNum = i + 1
                  const activeBucket = buckets.find(b => b.id === activeBucketId)
                  const isActive = activeBucket?.pages.includes(pageNum) || false
                  const assignedTo = buckets.find(b => b.id !== activeBucketId && b.pages.includes(pageNum))
                  
                  return (
                    <div key={i} className="flex flex-col items-center space-y-2">
                      <Thumbnail 
                        pdfDoc={pdfDoc} 
                        pageNum={pageNum} 
                        isActive={isActive} 
                        onClick={() => handleThumbnailClick(pageNum)} 
                      />
                      {assignedTo && !isActive && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px] px-1 bg-muted rounded">
                          in {assignedTo.name}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom Section: Buckets */}
            <div className="bg-white rounded-xl shadow-sm border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg">Output Documents</h3>
                  <p className="text-sm text-muted-foreground">Define your output files and assign pages to them.</p>
                </div>
                <button
                  onClick={handleAddBucket}
                  className="flex items-center space-x-1 bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Document</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {buckets.map((bucket) => {
                  const isActive = bucket.id === activeBucketId
                  return (
                    <div 
                      key={bucket.id}
                      onClick={() => setActiveBucketId(bucket.id)}
                      className={`relative flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isActive ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {buckets.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveBucket(bucket.id) }}
                          className="absolute top-3 right-3 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      )}
                      
                      <input
                        type="text"
                        value={bucket.name}
                        onChange={(e) => {
                          const val = e.target.value
                          setBuckets(prev => prev.map(b => b.id === bucket.id ? { ...b, name: val } : b))
                        }}
                        className="font-semibold bg-transparent border-b border-transparent focus:border-primary focus:outline-none w-[85%] truncate mb-4 pb-1"
                        placeholder="Document Name"
                      />
                      
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Pages:</label>
                        <input
                          type="text"
                          value={formatPages(bucket.pages)}
                          onChange={(e) => {
                            const val = e.target.value
                            setBuckets(prev => prev.map(b => b.id === bucket.id ? { ...b, pages: parsePages(val, numPages) } : b))
                          }}
                          className="w-full text-sm bg-white border border-input rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-primary/5"
                          placeholder="e.g. 1, 3, 5-7"
                        />
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                        {bucket.pages.length} page(s) selected
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-lg text-sm border border-red-100">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center space-x-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-all text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    <span>Zip and Download</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
