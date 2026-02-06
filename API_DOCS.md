# Document Upload & Extraction System

## Overview
This system allows authenticated users to:
1. Create classes
2. Upload documents (PDF/DOCX) to classes
3. Automatically extract text from documents
4. Store extracted text for AI queries

## API Endpoints

### Classes

#### GET /api/classes
Fetch all classes for the authenticated user.

**Response:**
```json
{
  "classes": [
    {
      "id": "abc123",
      "title": "Computer Science 101",
      "description": "Introduction to CS",
      "createdAt": "2026-02-05T...",
      "updatedAt": "2026-02-05T...",
      "_count": {
        "documents": 3
      }
    }
  ]
}
```

#### POST /api/classes
Create a new class.

**Body:**
```json
{
  "title": "Machine Learning",
  "description": "Advanced ML course"
}
```

**Response:**
```json
{
  "success": true,
  "class": {
    "id": "xyz789",
    "title": "Machine Learning",
    "description": "Advanced ML course",
    "userId": "user123",
    "createdAt": "2026-02-05T...",
    "updatedAt": "2026-02-05T..."
  }
}
```

### Documents

#### GET /api/documents
Fetch all documents for the authenticated user.

**Query Parameters:**
- `classId` (optional): Filter by class ID

**Response:**
```json
{
  "documents": [
    {
      "id": "doc123",
      "filename": "syllabus.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 524288,
      "status": "done",
      "createdAt": "2026-02-05T...",
      "processedAt": "2026-02-05T...",
      "classId": "class123",
      "class": {
        "title": "Computer Science 101"
      }
    }
  ]
}
```

#### POST /api/documents
Upload a document to a class.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: File to upload (PDF or DOCX, max 10MB)
- `classId`: ID of the class to associate the document with

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "newdoc456",
    "filename": "lecture-notes.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1048576,
    "status": "done",
    "createdAt": "2026-02-05T...",
    "processedAt": "2026-02-05T..."
  }
}
```

#### GET /api/documents/[id]
Fetch a specific document by ID.

**Response:**
```json
{
  "document": {
    "id": "doc123",
    "filename": "syllabus.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 524288,
    "status": "done",
    "textExtracted": "Full text content here...",
    "createdAt": "2026-02-05T...",
    "processedAt": "2026-02-05T...",
    "class": {
      "id": "class123",
      "title": "Computer Science 101"
    }
  }
}
```

## Document Processing Flow

1. **Upload**: User uploads document via `POST /api/documents`
2. **Storage**: File saved to `uploads/` directory
3. **Database**: Document record created with `status: pending`
4. **Extraction**: Worker extracts text using pdfjs-dist (PDF) and mammoth (DOCX)
5. **Console Output**: Extracted text logged to console
6. **Text File**: Extracted text saved as `.txt` file
7. **Database Update**: 
   - `textExtracted` field populated
   - `status` updated to `done`
   - `processedAt` timestamp set

## File Structure

```
uploads/
  ├── 1738745600000_syllabus.pdf        # Original file
  ├── 1738745600000_syllabus.txt        # Extracted text
  ├── 1738745700000_lecture-notes.docx
  └── 1738745700000_lecture-notes.txt
```

## Supported File Types

- **PDF**: `application/pdf` (parsed with pdfjs-dist)
- **DOCX**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **DOC**: `application/msword` (legacy)

## Security

- All endpoints require authentication
- Users can only access their own classes and documents
- File type and size validation
- User ID checked on all operations

## Testing

### 1. Create a class
```bash
curl -X POST http://localhost:3000/api/classes \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"title": "Test Class", "description": "A test class"}'
```

### 2. Upload a document
```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Cookie: your-session-cookie" \
  -F "file=@/path/to/document.pdf" \
  -F "classId=your-class-id"
```

### 3. Check document status
```bash
curl http://localhost:3000/api/documents/document-id \
  -H "Cookie: your-session-cookie"
```

## Next Steps

After documents are extracted, you can:
1. Build the AI query endpoint (`POST /api/ai/query`)
2. Fetch user's documents and concatenate text
3. Send to Groq API with user's query
4. Return AI-generated insights
