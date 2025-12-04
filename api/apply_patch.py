#!/usr/bin/env python3
"""Apply MCP SSE server patch for MCPhub compatibility"""

file_path = "/usr/local/lib/python3.12/site-packages/mcp/server/sse.py"

with open(file_path, "r") as f:
    lines = f.readlines()

# Find the lines to replace (around line 224-228)
patched = False
for i in range(len(lines)):
    if lines[i].strip() == 'writer = self._read_stream_writers.get(session_id)':
        # Check if next lines match
        if (i+1 < len(lines) and lines[i+1].strip() == 'if not writer:' and
            i+2 < len(lines) and 'Could not find session for ID' in lines[i+2]):
            # Replace the error block with auto-create session
            lines[i+1] = '        if not writer:\n'
            lines[i+2] = '            # Auto-create session if it doesn\'t exist (for MCP SDK 1.17.4 SSE clients)\n'
            lines[i+3] = '            logger.info(f"Session not found for ID: {session_id}, creating temporary session")\n'
            lines.insert(i+4, '            read_stream_writer, read_stream = anyio.create_memory_object_stream(0)\n')
            lines.insert(i+5, '            self._read_stream_writers[session_id] = read_stream_writer\n')
            lines.insert(i+6, '            writer = read_stream_writer\n')
            lines.insert(i+7, '            logger.debug(f"Created temporary session with ID: {session_id}")\n')
            # Remove old error response lines
            del lines[i+8:i+10]
            patched = True
            break

if patched:
    with open(file_path, "w") as f:
        f.writelines(lines)
    print("✅ Patch applied successfully!")
else:
    print("❌ Could not find the code to patch")
