'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Calculator
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
                  {(selectedFile.size_bytes / 1024 / 1024).toFixed(2)} MB • {selectedFile.mime_type}
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="building">Building</TabsTrigger>
            <TabsTrigger value="geometry">Geometry</TabsTrigger>
            <TabsTrigger value="raw">Raw Data</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  CAD File Metadata
                </CardTitle>
                <CardDescription>
                  Automatically extracted information from {selectedFile?.filename}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* DXF/DWG Metadata */}
                {metadata.dxf_version && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-lg font-bold">{metadata.dxf_version}</p>
                        <p className="text-sm text-muted-foreground">DXF Version</p>
                      </div>
                      {metadata.layers?.count && (
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-lg font-bold">{metadata.layers.count}</p>
                          <p className="text-sm text-muted-foreground">Layers</p>
                        </div>
                      )}
                      {metadata.blocks?.count && (
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-lg font-bold">{metadata.blocks.count}</p>
                          <p className="text-sm text-muted-foreground">Blocks</p>
                        </div>
                      )}
                      {metadata.entities?.total && (
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-lg font-bold">{metadata.entities.total}</p>
                          <p className="text-sm text-muted-foreground">Total Entities</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* IFC Metadata */}
                {metadata.file_schema && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-lg font-bold">{metadata.file_schema}</p>
                        <p className="text-sm text-muted-foreground">IFC Schema</p>
                      </div>
                      {metadata.storeys?.count && (
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-lg font-bold">{metadata.storeys.count}</p>
                          <p className="text-sm text-muted-foreground">Storeys</p>
                        </div>
                      )}
                      {metadata.spaces?.count && (
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-lg font-bold">{metadata.spaces.count}</p>
                          <p className="text-sm text-muted-foreground">Spaces</p>
                        </div>
                      )}
                      {metadata.elements?.total_count && (
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-lg font-bold">{metadata.elements.total_count}</p>
                          <p className="text-sm text-muted-foreground">Elements</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error State */}
                {metadata.error && (
                  <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-600 font-medium mb-1">Processing Error</p>
                    <p className="text-xs text-red-500">{metadata.error}</p>
                    {metadata.message && (
                      <p className="text-xs text-muted-foreground mt-2">{metadata.message}</p>
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
                <div className="space-y-2">
                  {metadata.layers.layers.slice(0, 10).map((layer: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm font-medium">{layer.name}</span>
                      <div className="flex items-center gap-2">
                        {layer.color && (
                          <Badge variant="outline" className="text-xs">Color: {layer.color}</Badge>
                        )}
                        {layer.linetype && (
                          <Badge variant="outline" className="text-xs">{layer.linetype}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {metadata.layers.layers.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      +{metadata.layers.layers.length - 10} more layers (see Raw Data tab)
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
            {metadata.entities && (
              <CollapsibleSection
                title="Entity Count"
                icon={<Ruler className="h-5 w-5" />}
                badge={metadata.entities.total}
                defaultOpen={true}
              >
                <DataGrid data={metadata.entities} />
              </CollapsibleSection>
            )}

            {metadata.dimensions && (
              <CollapsibleSection
                title="Dimensions"
                icon={<Ruler className="h-5 w-5" />}
                badge={metadata.dimensions.count}
              >
                <DataGrid data={metadata.dimensions} />
              </CollapsibleSection>
            )}

            {metadata.quantities && (
              <CollapsibleSection
                title="Quantities"
                icon={<Calculator className="h-5 w-5" />}
              >
                <DataGrid data={metadata.quantities} />
              </CollapsibleSection>
            )}

            {metadata.storeys && (
              <CollapsibleSection
                title="Storeys/Floors"
                icon={<Building2 className="h-5 w-5" />}
                badge={metadata.storeys.count}
              >
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
        </Tabs>
      )}
    </div>
  )
}
