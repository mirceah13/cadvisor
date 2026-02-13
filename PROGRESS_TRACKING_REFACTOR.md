# Progress Tracking Issues Found

## Critical Bugs:

1. **startTime calculation is WRONG**
   - Current: `startTime: new Date(f.created_at).getTime()` 
   - Problem: Uses file creation time, not processing start time
   - Should use: `processing_started_at` from metadata

2. **File matching may fail**
   - Polling tries to match files by ID
   - If server returns different files or none, UI gets stuck

3. **No error handling for API failures**
   - If polling endpoint fails, UI stays stuck forever

4. **Elapsed time calculation for stuck detection doesn't work**
   - Uses wrong startTime (creation instead of processing start)
   - 5-minute threshold never triggers correctly

5. **Status not refreshing**
   - Poller updates state but React may not re-render
  
## Complete refactor needed with:
- Fetch ACTUAL processing_started_at from server
- Use that for elapsed time
- Better error handling
- Console logging for debugging
- Refresh file list after completion
