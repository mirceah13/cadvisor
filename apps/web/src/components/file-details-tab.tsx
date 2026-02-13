'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  CheckCircle2
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'

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
    <div className="space-y-6">
      {/* File Selector */}
      {filesWithMetadata.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Select File to View</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filesWithMetadata.map((file) => (
                <Button
                  key={file.id}
                  variant={selectedFileId === file.id ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setSelectedFileId(file.id)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="truncate">{file.filename}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current File Info */}
      {selectedFile && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedFile.filename}
                </CardTitle>
                <CardDescription>
                  {selectedFile.size_bytes && !isNaN(selectedFile.size_bytes) 
                    ? `${(selectedFile.size_bytes / 1024 / 1024).toFixed(2)} MB` 
                    : selectedFile.size 
                      ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                      : 'Size unknown'
                  } • {selectedFile.mime_type || 'Unknown type'}
                  {metadata.source_format && ` • Source: ${metadata.source_format.toUpperCase()}`}
                </CardDescription>
              </div>
              {metadata.processing_status && (
                <Badge variant={metadata.processing_status === 'completed' ? 'default' : 'secondary'}>
                  {metadata.processing_status}
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search fields, values, metadata..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              Found {Object.keys(filteredData).length} matching field(s)
            </p>
          )}
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
          <TabsList className="grid w-full grid-cols-6 bg-muted/50 p-1">
            <TabsTrigger 
              value="overview"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="building"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
              Building
            </TabsTrigger>
            <TabsTrigger 
              value="geometry"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
              Geometry
            </TabsTrigger>
            <TabsTrigger 
              value="parsing"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
              Parsing Report
            </TabsTrigger>
            <TabsTrigger 
              value="raw"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
              Raw Data
            </TabsTrigger>
            <TabsTrigger 
              value="aps-raw"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground transition-colors"
            >
              APS Raw
            </TabsTrigger>
          </TabsList>

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* File Size */}
                  <div className="p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {selectedFile?.size_bytes 
                        ? (selectedFile.size_bytes / 1024 / 1024).toFixed(2) 
                        : selectedFile?.size 
                          ? (selectedFile.size / 1024 / 1024).toFixed(2)
                          : '?'} MB
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">File Size</p>
                  </div>

                  {/* Format/Version */}
                  {(metadata.dxf_version || metadata.file_schema || metadata.source_format) && (
                    <div className="p-4 border rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {metadata.dxf_version || metadata.file_schema || metadata.source_format?.toUpperCase()}
                      </p>
                      <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">Format/Version</p>
                    </div>
                  )}

                  {/* Entities/Elements */}
                  {(metadata.entities?.total || metadata.elements?.total_count) && (
                    <div className="p-4 border rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Box className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {metadata.entities?.total || metadata.elements?.total_count || 0}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">Total Entities</p>
                    </div>
                  )}

                  {/* Layers/Storeys */}
                  {(metadata.layers?.count || metadata.storeys?.count) && (
                    <div className="p-4 border rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {metadata.layers?.count || metadata.storeys?.count || 0}
                      </p>
                      <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                        {metadata.layers?.count ? 'Layers' : 'Storeys'}
                      </p>
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
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>What are layers?</strong> Layers organize drawing elements (walls, doors, etc.) into separate groups. Each layer has properties like color and line type.
                  </p>
                </div>
                <div className="space-y-2">
                  {metadata.layers.layers.slice(0, 10).map((layer: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 bg-primary/10 rounded">
                          <Layers className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{layer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Layer for {layer.name.toLowerCase().includes('wall') ? 'walls' :
                                       layer.name.toLowerCase().includes('door') ? 'doors' :
                                       layer.name.toLowerCase().includes('window') ? 'windows' :
                                       layer.name.toLowerCase().includes('floor') ? 'floors' :
                                       'drawing elements'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {layer.color !== undefined && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded">
                            <div 
                              className="w-3 h-3 rounded-full border"
                              style={{ 
                                backgroundColor: layer.color === 7 ? '#fff' : 
                                                layer.color === 1 ? '#ff0000' :
                                                layer.color === 2 ? '#ffff00' :
                                                layer.color === 3 ? '#00ff00' :
                                                layer.color === 4 ? '#00ffff' :
                                                layer.color === 5 ? '#0000ff' :
                                                layer.color === 6 ? '#ff00ff' :
                                                '#888'
                              }}
                              title={`AutoCAD Color Index: ${layer.color}`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {layer.color === 7 ? 'White' :
                               layer.color === 1 ? 'Red' :
                               layer.color === 2 ? 'Yellow' :
                               layer.color === 3 ? 'Green' :
                               layer.color === 4 ? 'Cyan' :
                               layer.color === 5 ? 'Blue' :
                               layer.color === 6 ? 'Magenta' :
                               `Color ${layer.color}`}
                            </span>
                          </div>
                        )}
                        {layer.linetype && (
                          <Badge variant="outline" className="text-xs" title="Line pattern for this layer">
                            {layer.linetype === 'CONTINUOUS' ? '━━━ Solid' :
                             layer.linetype === 'DASHED' ? '- - - Dashed' :
                             layer.linetype === 'DOTTED' ? '··· Dotted' :
                             layer.linetype}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {metadata.layers.layers.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2 bg-muted/50 rounded">
                      +{metadata.layers.layers.length - 10} more layers (see Raw Data tab for complete list)
                    </p>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {!metadata.building && !metadata.layers && (
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

            {!metadata.entities && !metadata.quantities && !metadata.storeys && (
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
                <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[600px] text-xs font-mono">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
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
