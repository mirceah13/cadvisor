'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api-client'
import { 
  Search, 
  FileText, 
  Layers, 
  Box, 
  Ruler, 
  Type, 
  Grid, 
  Building2,
  Home,
  Info,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Calculator,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Navigation,
  DoorOpen,
  Sofa
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Lazy JSON viewer — defers stringify and renders lines incrementally via
// IntersectionObserver so the browser never blocks on large payloads.
// ---------------------------------------------------------------------------
function LazyJsonViewer({ data }: { data: any }) {
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [lines, setLines] = useState<string[]>([])
  const [visibleEnd, setVisibleEnd] = useState(300)
  const [copied, setCopied] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const handleLoad = useCallback(() => {
    setLoadState('loading')
    // setTimeout defers off the current paint cycle so the spinner actually
    // renders before the (potentially multi-ms) JSON.stringify runs.
    setTimeout(() => {
      const json = JSON.stringify(data, null, 2)
      setLines(json.split('\n'))
      setLoadState('done')
    }, 0)
  }, [data])

  // When the sentinel div scrolls into view, reveal 300 more lines.
  useEffect(() => {
    if (loadState !== 'done' || visibleEnd >= lines.length) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleEnd(v => Math.min(v + 300, lines.length))
      },
      { rootMargin: '200px', threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadState, lines.length, visibleEnd])

  const handleCopy = useCallback(async () => {
    if (!lines.length) return
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [lines])

  if (loadState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">Raw JSON metadata</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Not pre-loaded to avoid blocking the browser. Click below to parse
            and display the data incrementally as you scroll.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLoad}>
          Load Raw Data
        </Button>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
        <span className="text-sm text-muted-foreground">Parsing JSON…</span>
      </div>
    )
  }

  const totalLines = lines.length
  const shown = Math.min(visibleEnd, totalLines)
  const remaining = totalLines - shown

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing{' '}
          <span className="font-medium text-foreground">{shown.toLocaleString()}</span>
          {' '}/ {totalLines.toLocaleString()} lines
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy all'}
        </Button>
      </div>
      <div className="overflow-auto max-h-[600px] rounded-lg border bg-muted">
        <pre className="p-4 text-xs font-mono">
          {lines.slice(0, shown).join('\n')}
        </pre>
        {remaining > 0 && (
          <div
            ref={sentinelRef}
            className="px-4 py-3 text-xs text-muted-foreground text-center border-t"
          >
            ↓ {remaining.toLocaleString()} more lines — scroll to load
          </div>
        )}
      </div>
    </div>
  )
}

interface FileDetailsTabProps {
  profile: any
  files: any[]
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  badge?: string | number
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, icon, badge, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            {icon}
            <span className="font-semibold">{title}</span>
            {badge && (
              <Badge variant="secondary" className="ml-2">
                {badge}
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 pt-0">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

function DataRow({ label, value, unit }: { label: string; value: any; unit?: string }) {
  if (value === null || value === undefined || value === '') return null

  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">
        {typeof value === 'boolean' ? (
          <Badge variant={value ? 'default' : 'secondary'}>
            {value ? 'Yes' : 'No'}
          </Badge>
        ) : typeof value === 'object' ? (
          JSON.stringify(value)
        ) : (
          `${value}${unit ? ` ${unit}` : ''}`
        )}
      </span>
    </div>
  )
}

function DataGrid({ data }: { data: Record<string, any> }) {
  return (
    <div className="space-y-1">
      {Object.entries(data).map(([key, value]) => (
        <DataRow key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} value={value} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AutoCAD Color Index (ACI) → CSS hex  
// Colors 1-9 are the standard fixed ACI values; 10-249 use an approximated
// hue wheel, 250-255 are standard grayscale steps.
// ---------------------------------------------------------------------------
function aciToHex(aci: number | undefined | null): string {
  const fixed: Record<number, string> = {
    1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF',
    5: '#0000FF', 6: '#FF00FF', 7: '#FFFFFF', 8: '#414141', 9: '#808080',
    250: '#0D0D0D', 251: '#333333', 252: '#555555', 253: '#777777',
    254: '#999999', 255: '#BBBBBB',
  }
  if (aci == null) return '#888888'
  if (fixed[aci]) return fixed[aci]
  if (aci >= 10 && aci <= 249) {
    const hue = Math.round(((aci - 10) / 240) * 360)
    return `hsl(${hue},80%,55%)`
  }
  return '#888888'
}

function aciToName(aci: number | undefined | null): string {
  const names: Record<number, string> = {
    1: 'Red', 2: 'Yellow', 3: 'Green', 4: 'Cyan',
    5: 'Blue', 6: 'Magenta', 7: 'White', 8: 'Dark Gray', 9: 'Gray',
  }
  if (aci == null) return 'Default'
  return names[aci] ?? `ACI ${aci}`
}

export function FileDetailsTab({ profile, files }: FileDetailsTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)

  // Get files with metadata
  const filesWithMetadata = useMemo(() => {
    return files.filter(f => f.file_metadata && Object.keys(f.file_metadata).length > 0)
  }, [files])

  // Select first file with metadata by default
  useEffect(() => {
    if (!selectedFileId && filesWithMetadata.length > 0) {
      setSelectedFileId(filesWithMetadata[0].id)
    }
  }, [filesWithMetadata, selectedFileId])

  const selectedFile = useMemo(() => {
    return files.find(f => f.id === selectedFileId)
  }, [files, selectedFileId])

  const metadata = selectedFile?.file_metadata || {}

  // Flatten metadata for search
  const flattenData = useCallback((obj: any, prefix = ''): Record<string, string> => {
    let result: Record<string, string> = {}
    
    for (const key in obj) {
      const value = obj[key]
      const newKey = prefix ? `${prefix}.${key}` : key
      
      if (value === null || value === undefined) continue
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        result = { ...result, ...flattenData(value, newKey) }
      } else {
        result[newKey] = String(value)
      }
    }
    
    return result
  }, [])

  const flatData = useMemo(() => {
    if (!metadata || Object.keys(metadata).length === 0) return {}
    return flattenData(metadata)
  }, [metadata, flattenData])

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return flatData
    
    const query = searchQuery.toLowerCase()
    return Object.entries(flatData).reduce((acc, [key, value]) => {
      if (key.toLowerCase().includes(query) || value.toLowerCase().includes(query)) {
        acc[key] = value
      }
      return acc
    }, {} as Record<string, string>)
  }, [flatData, searchQuery])

  // Build a layer-name → ACI color map for use in fire safety & layers sections
  const layerColorMap = useMemo(() => {
    const map: Record<string, number> = {}
    const layers = metadata?.layers?.layers
    if (Array.isArray(layers)) {
      layers.forEach((l: any) => { if (l?.name) map[l.name] = l.color })
    }
    return map
  }, [metadata])

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No files uploaded yet.<br />
            Upload a CAD file to see extracted metadata.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (filesWithMetadata.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
          <p className="text-muted-foreground text-center">
            No CAD metadata extracted yet.<br />
            {files.length > 0 ? 'Files are being processed or no parseable CAD files were found.' : 'Upload CAD files (DXF, DWG, IFC) to see extracted details.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* File toolbar */}
      <Card>
        <CardContent className="px-5 py-4">
          <div className="flex items-center gap-6">

            {/* Left: prominent file selector + metadata below */}
            <div className="flex flex-col gap-1.5 min-w-0">
              {filesWithMetadata.length > 1 ? (
                <Select value={selectedFileId ?? undefined} onValueChange={setSelectedFileId}>
                  <SelectTrigger className="h-10 w-[510px] bg-muted/60 font-medium text-sm border-border/80 hover:bg-muted transition-colors">
                    <SelectValue placeholder="Choose a file…" />
                  </SelectTrigger>
                  <SelectContent className="w-[510px]">
                    {filesWithMetadata.map((file) => (
                      <SelectItem key={file.id} value={file.id}>
                        <span className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {file.filename}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : selectedFile ? (
                <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-muted/60 border border-border/80 w-fit max-w-[510px]">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{selectedFile.filename}</span>
                </div>
              ) : null}

              {/* Contextual metadata — visually attached below the selector */}
              {selectedFile && (
                <div className="flex items-center gap-2 pl-1 mt-1 text-xs text-muted-foreground">
                  <span>
                    {selectedFile.size_bytes && !isNaN(selectedFile.size_bytes)
                      ? `${(selectedFile.size_bytes / 1024 / 1024).toFixed(2)} MB`
                      : selectedFile.size
                        ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                        : 'Size unknown'}
                  </span>
                  {metadata.source_format && (
                    <>
                      <span className="text-border">·</span>
                      <span className="font-semibold text-foreground/70 uppercase tracking-wide">{metadata.source_format}</span>
                    </>
                  )}
                  {metadata.processing_status && (
                    <>
                      <span className="text-border">·</span>
                      <Badge
                        variant={metadata.processing_status === 'completed' ? 'default' : 'secondary'}
                        className="h-4 px-1.5 text-[10px]"
                      >
                        {metadata.processing_status}
                      </Badge>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Push search to the right */}
            <div className="flex-1" />

            {/* Search */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search metadata…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-sm"
                />
              </div>
              {searchQuery && (
                <p className="text-xs text-muted-foreground">
                  {Object.keys(filteredData).length} field{Object.keys(filteredData).length !== 1 ? 's' : ''} match &ldquo;{searchQuery}&rdquo;
                </p>
              )}
            </div>

          </div>
        </CardContent>
      </Card>

      {searchQuery ? (
        /* Search Results View */
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              Showing all fields matching "{searchQuery}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(filteredData).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(filteredData).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b last:border-0">
                    <span className="text-sm text-muted-foreground font-mono">{key}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No results found for "{searchQuery}"
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Full Details View */
        <Tabs defaultValue="overview" className="w-full">
        <div className="border-b">
          <TabsList className="h-auto w-full rounded-none bg-transparent p-0">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="building"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
            >
              Building
            </TabsTrigger>
            <TabsTrigger
              value="geometry"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
            >
              Geometry
            </TabsTrigger>
            <TabsTrigger
              value="parsing"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
            >
              Parsing Report
            </TabsTrigger>
            <TabsTrigger
              value="raw"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
            >
              Raw Data
            </TabsTrigger>
            <TabsTrigger
              value="aps-raw"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
            >
              APS Raw
            </TabsTrigger>
          </TabsList>
        </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  CAD File Overview
                </CardTitle>
                <CardDescription>
                  Key metrics and metadata from {selectedFile?.filename}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* File Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* File Size */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-blue-800/50 bg-gradient-to-b from-blue-950/50 to-blue-950/80 shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] dark:from-blue-950/50 dark:to-blue-950/80">
                    <div className="p-1.5 rounded-md bg-blue-500/20 shrink-0">
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold leading-none text-blue-100 truncate">
                        {selectedFile?.size_bytes
                          ? (selectedFile.size_bytes / 1024 / 1024).toFixed(2)
                          : selectedFile?.size
                            ? (selectedFile.size / 1024 / 1024).toFixed(2)
                            : '?'} MB
                      </p>
                      <p className="text-[11px] text-blue-400/80 mt-1">File Size</p>
                    </div>
                  </div>

                  {/* Format/Version */}
                  {(metadata.dxf_version || metadata.file_schema || metadata.source_format) && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-purple-800/50 bg-gradient-to-b from-purple-950/50 to-purple-950/80 shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="p-1.5 rounded-md bg-purple-500/20 shrink-0">
                        <Calculator className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold leading-none text-purple-100 truncate">
                          {metadata.dxf_version || metadata.file_schema || metadata.source_format?.toUpperCase()}
                        </p>
                        <p className="text-[11px] text-purple-400/80 mt-1">Format</p>
                      </div>
                    </div>
                  )}

                  {/* Entities/Elements */}
                  {(metadata.entities?.total || metadata.elements?.total_count) && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-800/50 bg-gradient-to-b from-green-950/50 to-green-950/80 shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="p-1.5 rounded-md bg-green-500/20 shrink-0">
                        <Box className="h-4 w-4 text-green-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold leading-none text-green-100 truncate">
                          {(metadata.entities?.total || metadata.elements?.total_count || 0).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-green-400/80 mt-1">Entities</p>
                      </div>
                    </div>
                  )}

                  {/* Rooms */}
                  {metadata.rooms?.count > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-teal-800/50 bg-gradient-to-b from-teal-950/50 to-teal-950/80 shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="p-1.5 rounded-md bg-teal-500/20 shrink-0">
                        <Sofa className="h-4 w-4 text-teal-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold leading-none text-teal-100 truncate">
                          {metadata.rooms.count}
                        </p>
                        <p className="text-[11px] text-teal-400/80 mt-1">Rooms</p>
                      </div>
                    </div>
                  )}

                  {/* Fire Elements */}
                  {metadata.fire_elements?.count > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-800/50 bg-gradient-to-b from-red-950/50 to-red-950/80 shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="p-1.5 rounded-md bg-red-500/20 shrink-0">
                        <Flame className="h-4 w-4 text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold leading-none text-red-100 truncate">
                          {metadata.fire_elements.count}
                        </p>
                        <p className="text-[11px] text-red-400/80 mt-1">Fire Specs</p>
                      </div>
                    </div>
                  )}

                  {/* Layers/Storeys */}
                  {(metadata.layers?.count || metadata.storeys?.count) && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-orange-800/50 bg-gradient-to-b from-orange-950/50 to-orange-950/80 shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="p-1.5 rounded-md bg-orange-500/20 shrink-0">
                        <Layers className="h-4 w-4 text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold leading-none text-orange-100 truncate">
                          {metadata.layers?.count || metadata.storeys?.count || 0}
                        </p>
                        <p className="text-[11px] text-orange-400/80 mt-1">
                          {metadata.layers?.count ? 'Layers' : 'Storeys'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Entity Breakdown - DWG/DXF */}
                {metadata.entities?.by_type && Object.keys(metadata.entities.by_type).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Grid className="h-4 w-4" />
                      Entity Types Breakdown
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(metadata.entities.by_type)
                        .sort(([, a]: any, [, b]: any) => b - a)
                        .slice(0, 9)
                        .map(([type, count]: [string, any]) => (
                          <div key={type} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                            <span className="text-sm font-medium capitalize text-foreground">
                              {type.replace(/_/g, ' ')}
                            </span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Processing Status */}
                <div className="p-4 border-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-full">
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-green-900 dark:text-green-100">
                        Processing Complete
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {metadata.processing_started_at && metadata.processing_completed_at ? (
                          `Completed in ${((new Date(metadata.processing_completed_at).getTime() - new Date(metadata.processing_started_at).getTime()) / 1000).toFixed(1)}s`
                        ) : (
                          'File successfully parsed and ready for analysis'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* DXF/DWG Metadata */}
                {metadata.dxf_version && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Additional DWG/DXF Details</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {metadata.blocks?.count && (
                        <div className="p-3 border rounded-lg bg-card">
                          <p className="text-sm text-muted-foreground">Blocks</p>
                          <p className="text-lg font-bold text-foreground">{metadata.blocks.count}</p>
                        </div>
                      )}
                      {metadata.text?.count && (
                        <div className="p-3 border rounded-lg bg-card">
                          <p className="text-sm text-muted-foreground">Text Objects</p>
                          <p className="text-lg font-bold text-foreground">{metadata.text.count}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* IFC Metadata */}
                {metadata.file_schema && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">IFC Model Details</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {metadata.spaces?.count && (
                        <div className="p-3 border rounded-lg bg-card">
                          <p className="text-sm text-muted-foreground">Spaces</p>
                          <p className="text-lg font-bold text-foreground">{metadata.spaces.count}</p>
                        </div>
                      )}
                      {metadata.building?.name && (
                        <div className="p-3 border rounded-lg bg-card">
                          <p className="text-sm text-muted-foreground">Building Name</p>
                          <p className="text-base font-semibold text-foreground truncate">{metadata.building.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error State */}
                {metadata.error && (
                  <div className="p-4 border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <p className="text-sm font-semibold text-red-900 dark:text-red-100">Processing Error</p>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300">{metadata.error}</p>
                    {metadata.message && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">{metadata.message}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Building Tab */}
          <TabsContent value="building" className="space-y-4">
            {metadata.building && (
              <div className="space-y-4">
                <CollapsibleSection
                  title="Building Information"
                  icon={<Building2 className="h-5 w-5" />}
                  defaultOpen={true}
                >
                  <DataGrid data={metadata.building} />
                </CollapsibleSection>

                {metadata.elements && Object.keys(metadata.elements).length > 0 && (
                  <CollapsibleSection
                    title="Building Elements"
                    icon={<Box className="h-5 w-5" />}
                    badge={Object.keys(metadata.elements).length}
                    defaultOpen={true}
                  >
                    <DataGrid data={metadata.elements} />
                  </CollapsibleSection>
                )}

                {metadata.systems && Object.keys(metadata.systems).length > 0 && (
                  <CollapsibleSection
                    title="Building Systems"
                    icon={<Layers className="h-5 w-5" />}
                    badge={Object.keys(metadata.systems).length}
                  >
                    <DataGrid data={metadata.systems} />
                  </CollapsibleSection>
                )}
              </div>
            )}

            {/* DXF/DWG Layers */}
            {metadata.layers?.layers && metadata.layers.layers.length > 0 && (
              <CollapsibleSection
                title="Drawing Layers"
                icon={<Layers className="h-5 w-5" />}
                badge={metadata.layers.count}
                defaultOpen={true}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {metadata.layers.layers.slice(0, 18).map((layer: any, idx: number) => {
                    const hex = aciToHex(layer.color)
                    const colorName = aciToName(layer.color)
                    const isDark = layer.color === 7 || layer.color == null
                    return (
                      <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                        {/* Color swatch */}
                        <div
                          className="w-8 h-8 rounded-md border border-white/10 shrink-0 shadow-inner"
                          style={{ backgroundColor: hex, boxShadow: isDark ? '0 0 0 1px rgba(255,255,255,0.15) inset' : undefined }}
                          title={`ACI ${layer.color} — ${colorName}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate leading-none">{layer.name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-muted-foreground">{colorName}</span>
                            {layer.linetype && layer.linetype !== 'Continuous' && layer.linetype !== 'CONTINUOUS' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{layer.linetype}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {metadata.layers.layers.length > 18 && (
                  <p className="text-xs text-muted-foreground text-center mt-2 py-2 bg-muted/30 rounded">
                    +{metadata.layers.layers.length - 18} more layers — see Raw Data tab for full list
                  </p>
                )}
              </CollapsibleSection>
            )}

            {/* Rooms Section */}
            {metadata.rooms?.rooms && metadata.rooms.rooms.length > 0 && (
              <CollapsibleSection
                title="Rooms & Spaces"
                icon={<Sofa className="h-5 w-5" />}
                badge={metadata.rooms.count}
                defaultOpen={true}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {metadata.rooms.rooms.map((room: any, idx: number) => {
                    const layerAci = layerColorMap[room.layer]
                    const swatchHex = layerAci != null ? aciToHex(layerAci) : null
                    return (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                        {swatchHex && (
                          <div
                            className="w-2.5 self-stretch rounded-full shrink-0"
                            style={{ backgroundColor: swatchHex }}
                            title={room.layer}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight truncate">{room.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {room.floor_covering && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                {room.floor_covering}
                              </Badge>
                            )}
                            {room.height_m && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                h = {room.height_m} m
                              </Badge>
                            )}
                            {room.floor_code && (
                              <span className="text-[10px] text-muted-foreground font-mono">{room.floor_code}</span>
                            )}
                          </div>
                          {room.layer && !swatchHex && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{room.layer}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CollapsibleSection>
            )}

            {/* Fire Safety Elements */}
            {metadata.fire_elements?.items && metadata.fire_elements.items.length > 0 && (
              <CollapsibleSection
                title="Fire Safety Specifications"
                icon={<Flame className="h-5 w-5 text-red-500" />}
                badge={metadata.fire_elements.count}
                defaultOpen={true}
              >
                <div className="space-y-2">
                  {metadata.fire_elements.items.map((el: any, idx: number) => {
                    const layerAci = layerColorMap[el.layer]
                    const swatchHex = aciToHex(layerAci)
                    const colorName = aciToName(layerAci)
                    return (
                      <div key={idx} className="flex items-stretch gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group">
                        {/* Color swatch from layer ACI */}
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div
                            className="w-8 h-8 rounded-md border border-white/10 shadow-inner"
                            style={{ backgroundColor: swatchHex }}
                            title={`Layer: ${el.layer || '—'} · ACI ${layerAci ?? '?'} (${colorName})`}
                          />
                          <span className="text-[9px] text-muted-foreground leading-none">{colorName}</span>
                        </div>
                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <Badge variant="outline" className="capitalize text-xs">
                              {el.element_type?.replace(/_/g, ' ') || 'general'}
                            </Badge>
                            {el.rating && (
                              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100 font-mono text-xs">
                                {el.rating}
                              </Badge>
                            )}
                            {el.all_ratings && el.all_ratings.length > 1 && el.all_ratings.slice(1).map((r: string, ri: number) => (
                              <Badge key={ri} variant="outline" className="font-mono text-xs text-red-600 dark:text-red-400 border-red-300 dark:border-red-700">
                                {r}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2" title={el.text}>
                            {el.text}
                          </p>
                          {el.layer && (
                            <code className="text-[10px] bg-muted px-1 rounded mt-1 inline-block opacity-70">
                              {el.layer}
                            </code>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Color swatches reflect the AutoCAD layer color (ACI) of each annotation.
                  REI = Resistance / Insulation / Integrity (minutes). EI = Integrity / Insulation.
                </p>
              </CollapsibleSection>
            )}

            {/* Evacuation Data */}
            {metadata.evacuation && metadata.evacuation.length > 0 && (
              <CollapsibleSection
                title="Evacuation Data"
                icon={<Navigation className="h-5 w-5 text-orange-500" />}
                badge={metadata.evacuation.length}
                defaultOpen={true}
              >
                <div className="space-y-2">
                  {metadata.evacuation.map((ev: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 dark:bg-orange-950/30">
                      <div>
                        <p className="text-sm font-medium capitalize">{ev.type?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">{ev.text}</p>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 text-base px-3">
                        {ev.value} {ev.unit}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {!metadata.building && !metadata.layers && !metadata.rooms?.count && !metadata.fire_elements?.count && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No building information available in this file
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Geometry Tab */}
          <TabsContent value="geometry" className="space-y-4">
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Understanding Geometry Data</h3>
                    <p className="text-sm text-muted-foreground">
                      This tab shows the geometric elements in your CAD file. <strong>Entities</strong> are drawing objects like lines, arcs, and text. 
                      <strong>Dimensions</strong> show measurements. <strong>Quantities</strong> provide counts of building elements.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {metadata.entities && (
              <CollapsibleSection
                title="Entity Count"
                icon={<Ruler className="h-5 w-5" />}
                badge={metadata.entities.total}
                defaultOpen={true}
              >
                <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Entities</strong> are the basic geometric objects in the drawing. Common types include:
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4">
                    <li>• <strong>LINE:</strong> Straight segments connecting two points</li>
                    <li>• <strong>TEXT:</strong> Text labels and annotations</li>
                    <li>• <strong>HATCH:</strong> Filled areas with patterns</li>
                    <li>• <strong>INSERT:</strong> Block references (repeated elements)</li>
                    <li>• <strong>LWPOLYLINE:</strong> Connected line segments forming shapes</li>
                  </ul>
                </div>
                <DataGrid data={metadata.entities} />
              </CollapsibleSection>
            )}

            {metadata.dimensions && (
              <CollapsibleSection
                title="Dimensions"
                icon={<Ruler className="h-5 w-5" />}
                badge={metadata.dimensions.count}
              >
                <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Dimensions</strong> indicate measurements in the drawing, showing distances, angles, and sizes of building elements.
                  </p>
                </div>
                <DataGrid data={metadata.dimensions} />
              </CollapsibleSection>
            )}

            {metadata.quantities && (
              <CollapsibleSection
                title="Quantities"
                icon={<Calculator className="h-5 w-5" />}
              >
                <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Quantities</strong> provide counts and measurements of building components (walls, doors, windows, etc.) extracted from the model.
                  </p>
                </div>
                <DataGrid data={metadata.quantities} />
              </CollapsibleSection>
            )}

            {metadata.storeys && (
              <CollapsibleSection
                title="Storeys/Floors"
                icon={<Building2 className="h-5 w-5" />}
                badge={metadata.storeys.count}
              >
                <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Storeys</strong> represent building levels/floors in the model, helping organize elements by vertical location.
                  </p>
                </div>
                <DataGrid data={metadata.storeys} />
              </CollapsibleSection>
            )}

            {metadata.spaces && (
              <CollapsibleSection
                title="Spaces"
                icon={<Box className="h-5 w-5" />}
                badge={metadata.spaces.count}
              >
                <DataGrid data={metadata.spaces} />
              </CollapsibleSection>
            )}

            {/* Structural Elements (from APS data) */}
            {metadata.structural_elements && (
              <CollapsibleSection
                title="Structural Elements"
                icon={<Building2 className="h-5 w-5" />}
                defaultOpen={false}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {metadata.structural_elements.beams > 0 && (
                    <div className="p-4 border rounded-lg bg-card text-center">
                      <p className="text-2xl font-bold">{metadata.structural_elements.beams}</p>
                      <p className="text-xs text-muted-foreground">Beams</p>
                    </div>
                  )}
                  {metadata.structural_elements.slabs > 0 && (
                    <div className="p-4 border rounded-lg bg-card text-center">
                      <p className="text-2xl font-bold">{metadata.structural_elements.slabs}</p>
                      <p className="text-xs text-muted-foreground">Slabs</p>
                    </div>
                  )}
                  {metadata.structural_elements.structural_layers?.length > 0 && (
                    <div className="p-4 border rounded-lg bg-card text-center">
                      <p className="text-2xl font-bold">{metadata.structural_elements.structural_layers.length}</p>
                      <p className="text-xs text-muted-foreground">Structural Layers</p>
                    </div>
                  )}
                </div>
                {metadata.structural_elements.structural_layers?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">STRUCTURAL LAYERS</p>
                    <div className="flex flex-wrap gap-1">
                      {metadata.structural_elements.structural_layers.map((l: string, i: number) => (
                        <code key={i} className="text-xs bg-muted px-2 py-0.5 rounded">{l}</code>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleSection>
            )}

            {/* Text Annotations */}
            {metadata.text_annotations?.items && metadata.text_annotations.items.length > 0 && (
              <CollapsibleSection
                title="Text Annotations"
                icon={<Type className="h-5 w-5" />}
                badge={metadata.text_annotations.count}
                defaultOpen={false}
              >
                <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Decoded MTEXT and TEXT content from the drawing — includes notes, labels, and specifications.
                  </p>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {metadata.text_annotations.items.map((ann: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm flex-1">{ann.text}</p>
                        <code className="text-xs bg-muted px-1 rounded shrink-0">{ann.layer || '—'}</code>
                      </div>
                      {ann.text_height_mm && (
                        <p className="text-xs text-muted-foreground mt-1">h={ann.text_height_mm}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {!metadata.entities && !metadata.quantities && !metadata.storeys && !metadata.structural_elements && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No geometry information available in this file
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Parsing Report Tab */}
          <TabsContent value="parsing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Parsing Report
                </CardTitle>
                <CardDescription>
                  Detailed information about the file parsing process for {selectedFile?.filename}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-4 border rounded-lg ${
                    metadata.processing_status === 'completed' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' :
                    metadata.processing_status === 'partial' ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' :
                    metadata.processing_status === 'failed' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
                    'bg-gray-50 dark:bg-gray-900/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {metadata.processing_status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />}
                      {metadata.processing_status === 'partial' && <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />}
                      {metadata.processing_status === 'failed' && <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                      <span className="font-semibold text-foreground">Status</span>
                    </div>
                    <Badge 
                      variant={metadata.processing_status === 'completed' ? 'default' : 'secondary'}
                      className="text-base px-3 py-1"
                    >
                      {metadata.processing_status || 'Unknown'}
                    </Badge>
                  </div>

                  <div className="p-4 border rounded-lg bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-foreground">Format</span>
                    </div>
                    <p className="text-lg font-bold text-foreground uppercase">
                      {metadata.source_format || metadata.file_type || 'Unknown'}
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Type className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-foreground">Text Extracted</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      {metadata.text_annotations?.count || 
                       metadata.text?.count || 
                       (metadata.raw_text_content ? 'Yes' : 'No')}
                    </p>
                  </div>
                </div>

                {/* Processing Details */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Processing Details</h3>
                  <div className="space-y-2">
                    {metadata.processing_started_at && (
                      <DataRow label="Started At" value={new Date(metadata.processing_started_at).toLocaleString()} />
                    )}
                    {metadata.processing_completed_at && (
                      <DataRow label="Completed At" value={new Date(metadata.processing_completed_at).toLocaleString()} />
                    )}
                    {metadata.text_extraction_method && (
                      <DataRow label="Extraction Method" value={metadata.text_extraction_method} />
                    )}
                    {metadata.dxf_version && (
                      <DataRow label="DXF Version" value={metadata.dxf_version} />
                    )}
                  </div>
                </div>

                {/* Errors and Warnings */}
                {(metadata.error || metadata.recovery_error || metadata.message) && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Messages</h3>
                    
                    {metadata.message && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-blue-900">Information</p>
                            <p className="text-sm text-blue-700 mt-1">{metadata.message}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {metadata.error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-900">Parsing Error</p>
                            <p className="text-sm text-red-700 mt-1 font-mono break-all">{metadata.error}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {metadata.recovery_error && (
                      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-orange-900">Recovery Attempt Failed</p>
                            <p className="text-sm text-orange-700 mt-1 font-mono break-all">{metadata.recovery_error}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Extracted Content Summary */}
                {metadata.raw_text_content && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Extracted Text Content</h3>
                    <div className="p-4 bg-muted rounded-lg">
                      <pre className="text-xs font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">
                        {metadata.raw_text_content}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Parsing Log */}
                {metadata.parsing_log && metadata.parsing_log.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Detailed Parsing Log</h3>
                    <div className="p-4 bg-slate-900 text-slate-100 rounded-lg overflow-auto max-h-[400px]">
                      <div className="space-y-1 font-mono text-xs">
                        {metadata.parsing_log.map((log: string, index: number) => (
                          <div key={index} className={`${
                            log.includes('ERROR') ? 'text-red-400' :
                            log.includes('failed') && !log.includes('Recovery') ? 'text-orange-400' :
                            log.includes('successful') || log.includes('complete') ? 'text-green-400' :
                            log.includes('Attempting') ? 'text-blue-400' :
                            'text-slate-300'
                          }`}>
                            <span className="text-slate-500 mr-2">[{String(index + 1).padStart(2, '0')}]</span>
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This log shows the step-by-step parsing process including conversion, parsing attempts, and recovery operations.
                    </p>
                  </div>
                )}

                {/* Recommendations */}
                {metadata.processing_status !== 'completed' && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">Understanding MTEXT Parsing Errors</p>
                        <div className="text-sm text-blue-700 mt-2 space-y-2">
                          <p>
                            The MTEXT errors you're seeing are a <strong>known limitation of LibreDWG</strong>, the open-source DWG converter we use.
                            While your file is perfectly valid and opens fine in AutoCAD/Autodesk viewers, LibreDWG struggles with complex MTEXT formatting codes.
                          </p>
                          <p className="font-medium mt-3">Solutions:</p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            {metadata.processing_status === 'partial' && (
                              <>
                                <li>The system successfully extracted some content and analysis can proceed</li>
                                <li>For better results, export your DWG as DXF directly from AutoCAD (File → Save As → DXF format)</li>
                                <li>Alternatively, use <a href="https://www.opendesign.com/guestfiles/oda_file_converter" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">ODA File Converter</a> (free) to convert DWG to DXF before uploading</li>
                              </>
                            )}
                            {metadata.processing_status === 'failed' && (
                              <>
                                <li>Convert to DXF format using AutoCAD or <a href="https://www.opendesign.com/guestfiles/oda_file_converter" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">ODA File Converter</a></li>
                                <li>Open the DWG in AutoCAD and use AUDIT command to repair any issues</li>
                                <li>Simplify complex MTEXT formatting before exporting</li>
                                <li>Save as an older DXF version (R2000 or R2004) for better compatibility</li>
                              </>
                            )}
                          </ul>
                          <p className="mt-3 text-xs italic">
                            <strong>Technical note:</strong> LibreDWG generates malformed formatting codes like "|i0|c0|p34;\fArial" that ezdxf cannot parse.
                            This is a LibreDWG bug, not an issue with your file.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Raw Data Tab */}
          <TabsContent value="raw" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Raw CAD Metadata</CardTitle>
                <CardDescription>
                  Complete JSON representation of extracted file metadata from {selectedFile?.filename}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LazyJsonViewer data={metadata} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* APS Raw Response Tab */}
          <TabsContent value="aps-raw" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>APS Raw API Responses</CardTitle>
                <CardDescription>
                  Complete unfiltered responses from Autodesk Platform Services APIs - ALL data preserved without truncation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metadata?.aps_raw_responses?.available ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                          <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            Complete Unfiltered Data Available
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Complete APS API responses with ALL objects and properties (unfiltered and untruncated).
                            Contains {metadata.aps_raw_responses.response_count} complete API response(s).
                          </p>
                          {metadata.aps_raw_responses.responses && (
                            <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
                              <strong>Total objects:</strong> {
                                metadata.aps_raw_responses.responses.reduce((sum: number, resp: any) => {
                                  return sum + (resp.object_count || 0)
                                }, 0)
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <FileText className="h-16 w-16 text-primary" />
                      <div className="text-center space-y-2">
                        <p className="font-semibold text-lg">Download Raw APS Data</p>
                        <p className="text-sm text-muted-foreground max-w-md">
                          The complete unfiltered APS responses are too large to display in the browser.
                          Download the JSON file to view all data.
                        </p>
                      </div>
                      <Button
                        size="lg"
                        onClick={async () => {
                          if (!selectedFile?.id) return
                          try {
                            const filename = `${selectedFile.filename}_aps_raw.json`
                            await api.downloadFile(`/files/${selectedFile.id}/aps-raw-download`, filename)
                          } catch (error) {
                            console.error('Download failed:', error)
                          }
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Download APS Raw Data (JSON)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
                    <p className="text-muted-foreground text-center">
                      APS raw responses not available for this file.<br />
                      Upload a new CAD file to process it with the enhanced APS extraction.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
