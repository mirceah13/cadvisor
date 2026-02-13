// COMPLETE REFACTORED checkFileParsingStatus FUNCTION
// Place this in apps/web/src/app/submissions/[id]/page.tsx

const checkFileParsingStatus = async () => {
  if (!accessToken || uploadedFilesState.length === 0) {
    console.log('[Progress] Skipping check - no token or no files')
    return
  }

  try {
    console.log('[Progress] Polling for', uploadedFilesState.length, 'files')
    
    const response: any = await apiClient.get(`/submissions/${params.id}/processing-status`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const data = response.data || response
    
    console.log('[Progress] Server response:', {
      totalFiles: data.files?.length,
      overall: data.overall_status,
      fileStatuses: data.files?.map((f: any) => ({ id: f.file_id, status: f.processing_status }))
    })
    
    if (!data.files || data.files.length === 0) {
      console.warn('[Progress] No files in server response')
      return
    }

    const updatedFiles = [...uploadedFilesState]
    let allDone = true
    let anyUpdated = false

    for (let i = 0; i < updatedFiles.length; i++) {
      const serverFile = data.files.find((sf: any) => sf.file_id === updatedFiles[i].id)
      
      if (!serverFile) {
        console.warn('[Progress] File not found in server response:', updatedFiles[i].id)
        allDone = false
        continue
      }
      
      const status = serverFile.processing_status
      const oldStatus = updatedFiles[i].status
      console.log('[Progress] File', updatedFiles[i].name, '- DB status:', status, ', UI status:', oldStatus)
      
      // CRITICAL FIX: Use processing_started_at from server, not file creation time!
      if (!updatedFiles[i].startTime && serverFile.processing_started_at) {
        updatedFiles[i].startTime = new Date(serverFile.processing_started_at).getTime()
        console.log('[Progress] Set startTime from server:', updatedFiles[i].startTime)
      }
      
      if (status === 'completed' || status === 'partial') {
        if (oldStatus !== 'completed') {
          updatedFiles[i].status = 'completed'
          updatedFiles[i].parsingStage = 'Completed'
          updatedFiles[i].metadata = serverFile
          anyUpdated = true
          console.log('[Progress] ✓ File completed:', updatedFiles[i].name)
        }
      } else if (status === 'failed') {
        if (oldStatus !== 'failed') {
          updatedFiles[i].status = 'failed'
          updatedFiles[i].parsingStage = 'Failed'
          updatedFiles[i].metadata = serverFile
          anyUpdated = true
          console.log('[Progress] ✗ File failed:', updatedFiles[i].name)
        }
      } else if (status === 'processing') {
        const startTime = updatedFiles[i].startTime || Date.now()
        const elapsed = (Date.now() - startTime) / 1000
        console.log('[Progress] File processing, elapsed:', elapsed.toFixed(1), 's')
        
        if (elapsed > 300) {
          if (oldStatus !== 'stuck') {
            updatedFiles[i].status = 'stuck'
            updatedFiles[i].parsingStage = 'Processing appears stuck (task may have been interrupted)'
            anyUpdated = true
            console.warn('[Progress] ⚠ File appears stuck after', elapsed.toFixed(0), 's')
          }
        } else {
          let newStage = 'Processing file...'
          if (elapsed < 5) {
            newStage = 'Starting translation...'
          } else if (elapsed < 40) {
            newStage = 'Translating CAD file to SVF2...'
          } else {
            newStage = 'Extracting metadata and properties...'
          }
          
          if (updatedFiles[i].parsingStage !== newStage || updatedFiles[i].status !== 'parsing') {
            updatedFiles[i].parsingStage = newStage
            updatedFiles[i].status = 'parsing'
            anyUpdated = true
          }
        }
        
        if (updatedFiles[i].status !== 'stuck') {
          allDone = false
        }
      } else if (status === 'pending') {
        if (oldStatus !== 'parsing' || updatedFiles[i].parsingStage !== 'Queued for processing...') {
          updatedFiles[i].status = 'parsing'
          updatedFiles[i].parsingStage = 'Queued for processing...'
          if (!updatedFiles[i].startTime) {
            updatedFiles[i].startTime = Date.now()
          }
          anyUpdated = true
        }
        allDone = false
      } else {
        console.warn('[Progress] Unknown status:', status)
        updatedFiles[i].status = 'parsing'
        updatedFiles[i].parsingStage = 'Processing file...'
        allDone = false
      }
    }

    if (anyUpdated) {
      console.log('[Progress] Updating state with new file statuses')
      setUploadedFilesState(updatedFiles)
    }

    if (allDone) {
      console.log('[Progress] All files done, stopping polling')
      if (fileParsingInterval) {
        clearInterval(fileParsingInterval)
        setFileParsingInterval(null)
      }
      setIsParsingFiles(false)

      const successCount = updatedFiles.filter(f => f.status === 'completed').length
      const failedCount = updatedFiles.filter(f => f.status === 'failed').length
      
      if (failedCount === 0) {
        toast({
          title: "Files Processed Successfully",
          description: `All ${successCount} file(s) have been processed and are ready for analysis.`,
        })
      } else if (successCount === 0) {
        toast({
          variant: "destructive",
          title: "Processing Failed",
          description: `${failedCount} file(s) failed to process.`,
        })
      } else {
        toast({
          title: "Processing Complete with Errors",
          description: `${successCount} file(s) processed successfully, ${failedCount} failed.`,
        })
      }
      
      console.log('[Progress] Refreshing file list')
      await fetchFiles()
    }
  } catch (error) {
    console.error('[Progress] Failed to check parsing status:', error)
  }
}
