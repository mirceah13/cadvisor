'use client'

import { useState, useMemo } from 'react'
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
  ChevronRight
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

  // Flatten profile data for search
  const flattenData = (obj: any, prefix = ''): Record<string, string> => {
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
  }

  const flatData = useMemo(() => {
    if (!profile) return {}
    return flattenData(profile)
  }, [profile])

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

  if (!profile && (!files || files.length === 0)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No file details available yet.<br />
            Upload a CAD file to see extracted information.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
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
                  File Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{files.length}</p>
                    <p className="text-sm text-muted-foreground">Files</p>
                  </div>
                  {profile?.building?.floors && (
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{profile.building.floors}</p>
                      <p className="text-sm text-muted-foreground">Floors</p>
                    </div>
                  )}
                  {profile?.building?.total_area_sqm && (
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{profile.building.total_area_sqm}</p>
                      <p className="text-sm text-muted-foreground">Area (m²)</p>
                    </div>
                  )}
                  {profile?.elements && (
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">
                        {Object.values(profile.elements).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Elements</p>
                    </div>
                  )}
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Uploaded Files</h4>
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{file.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size_bytes / 1024 / 1024).toFixed(2)} MB • {file.mime_type}
                            </p>
                          </div>
                        </div>
                        {file.scan_status && (
                          <Badge variant={file.scan_status === 'clean' ? 'default' : 'destructive'}>
                            {file.scan_status}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Building Tab */}
          <TabsContent value="building" className="space-y-4">
            {profile?.building && (
              <div className="space-y-4">
                <CollapsibleSection
                  title="Building Information"
                  icon={<Building2 className="h-5 w-5" />}
                  defaultOpen={true}
                >
                  <DataGrid data={profile.building} />
                </CollapsibleSection>

                {profile.elements && Object.keys(profile.elements).length > 0 && (
                  <CollapsibleSection
                    title="Building Elements"
                    icon={<Box className="h-5 w-5" />}
                    badge={Object.keys(profile.elements).length}
                    defaultOpen={true}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(profile.elements).map(([key, value]) => (
                        <div key={key} className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                          <p className="text-2xl font-bold">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {profile.systems && Object.keys(profile.systems).length > 0 && (
                  <CollapsibleSection
                    title="Building Systems"
                    icon={<Grid className="h-5 w-5" />}
                    badge={Object.values(profile.systems).filter(v => v === true).length}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(profile.systems).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                          <span className="text-sm">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                          <Badge variant={value ? 'default' : 'secondary'}>
                            {value ? 'Present' : 'Absent'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {profile.spaces && (
                  <CollapsibleSection
                    title="Spaces & Rooms"
                    icon={<Home className="h-5 w-5" />}
                    badge={profile.spaces.count || 0}
                  >
                    {profile.spaces.spaces && profile.spaces.spaces.length > 0 ? (
                      <div className="space-y-2">
                        {profile.spaces.spaces.map((space: any, idx: number) => (
                          <div key={idx} className="p-3 border rounded-lg">
                            <p className="font-medium">{space.name}</p>
                            {space.description && (
                              <p className="text-sm text-muted-foreground">{space.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No space information available</p>
                    )}
                  </CollapsibleSection>
                )}
              </div>
            )}

            {!profile?.building && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No building information extracted</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Geometry Tab */}
          <TabsContent value="geometry" className="space-y-4">
            {(profile?.layers || profile?.blocks || profile?.dimensions) ? (
              <div className="space-y-4">
                {profile.layers && (
                  <CollapsibleSection
                    title="Layers"
                    icon={<Layers className="h-5 w-5" />}
                    badge={profile.layers.count || profile.layers.length || 0}
                    defaultOpen={true}
                  >
                    {profile.layers.layers || profile.layers.length > 0 ? (
                      <div className="space-y-2">
                        {(profile.layers.layers || profile.layers).slice(0, 50).map((layer: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{layer.name || layer}</p>
                              {layer.linetype && (
                                <p className="text-xs text-muted-foreground">Type: {layer.linetype}</p>
                              )}
                            </div>
                            {layer.color !== undefined && (
                              <Badge variant="outline">Color: {layer.color}</Badge>
                            )}
                          </div>
                        ))}
                        {(profile.layers.layers || profile.layers).length > 50 && (
                          <p className="text-sm text-muted-foreground text-center pt-2">
                            ... and {(profile.layers.layers || profile.layers).length - 50} more layers
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No layer information available</p>
                    )}
                  </CollapsibleSection>
                )}

                {profile.blocks && (
                  <CollapsibleSection
                    title="Blocks & Components"
                    icon={<Box className="h-5 w-5" />}
                    badge={profile.blocks.count || 0}
                  >
                    {profile.blocks.blocks && profile.blocks.blocks.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {profile.blocks.blocks.slice(0, 30).map((block: any, idx: number) => (
                          <div key={idx} className="p-3 border rounded-lg">
                            <p className="text-sm font-medium truncate">{block.name || block}</p>
                            {block.entity_count && (
                              <p className="text-xs text-muted-foreground">{block.entity_count} entities</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No block information available</p>
                    )}
                  </CollapsibleSection>
                )}

                {profile.entities && (
                  <CollapsibleSection
                    title="Entities"
                    icon={<Grid className="h-5 w-5" />}
                    badge={Object.keys(profile.entities).length}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(profile.entities).map(([type, count]) => (
                        <div key={type} className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">{type}</p>
                          <p className="text-xl font-bold">{String(count)}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {profile.text_annotations && (
                  <CollapsibleSection
                    title="Text Annotations"
                    icon={<Type className="h-5 w-5" />}
                    badge={profile.text_annotations.count || 0}
                  >
                    {profile.text_annotations.sample_texts && profile.text_annotations.sample_texts.length > 0 ? (
                      <div className="space-y-2">
                        {profile.text_annotations.sample_texts.map((text: string, idx: number) => (
                          <div key={idx} className="p-2 border rounded text-sm font-mono bg-muted/30">
                            {text}
                          </div>
                        ))}
                        {profile.text_annotations.count > profile.text_annotations.sample_texts.length && (
                          <p className="text-sm text-muted-foreground text-center pt-2">
                            ... and {profile.text_annotations.count - profile.text_annotations.sample_texts.length} more annotations
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No text annotations available</p>
                    )}
                  </CollapsibleSection>
                )}

                {profile.dimensions && (
                  <CollapsibleSection
                    title="Dimensions"
                    icon={<Ruler className="h-5 w-5" />}
                    badge={profile.dimensions.count || 0}
                  >
                    <div className="p-4 border rounded-lg text-center">
                      <p className="text-3xl font-bold">{profile.dimensions.count}</p>
                      <p className="text-sm text-muted-foreground">Dimension entities</p>
                      {profile.dimensions.has_dimensions && (
                        <Badge className="mt-2">Contains dimensions</Badge>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Grid className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No geometry information extracted</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Raw Data Tab */}
          <TabsContent value="raw" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Raw Profile Data</CardTitle>
                <CardDescription>
                  Complete JSON representation of extracted file information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-96 text-xs font-mono">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
