import io
import zipfile
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pypdf

app = FastAPI(title="PDF Editor API")

# Configure CORS to allow the frontend to communicate with the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """Health check endpoint to verify the API is running."""
    return {"status": "ok"}

@app.post("/api/split")
async def split_pdf_api(
    file: UploadFile = File(...), 
    pages_for_pdf1: str = Form(...)
):
    """
    Splits the uploaded PDF.
    Pages specified in 'pages_for_pdf1' go into the first PDF,
    and all other pages go into the second PDF.
    Returns a ZIP file containing both PDFs.
    """
    try:
        # Convert comma-separated string to list of 0-based integers
        pages_list = [int(p.strip()) - 1 for p in pages_for_pdf1.split(",") if p.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page numbers format. Must be comma-separated integers.")
        
    pdf_bytes = await file.read()
    input_pdf = io.BytesIO(pdf_bytes)
    
    try:
        reader = pypdf.PdfReader(input_pdf)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PDF file or corrupted data.")
        
    total_pages = len(reader.pages)
    
    writer1 = pypdf.PdfWriter()
    writer2 = pypdf.PdfWriter()
    
    # Add pages to the first PDF
    for page_num in pages_list:
        if 0 <= page_num < total_pages:
            writer1.add_page(reader.pages[page_num])
            
    # Add remaining pages to the second PDF
    for page_num in range(total_pages):
        if page_num not in pages_list:
            writer2.add_page(reader.pages[page_num])
            
    # Write to memory buffers
    pdf1_io = io.BytesIO()
    writer1.write(pdf1_io)
    
    pdf2_io = io.BytesIO()
    writer2.write(pdf2_io)
    
    # Create a ZIP file containing both PDFs
    zip_io = io.BytesIO()
    with zipfile.ZipFile(zip_io, "w") as zf:
        zf.writestr("split_part1.pdf", pdf1_io.getvalue())
        zf.writestr("split_part2.pdf", pdf2_io.getvalue())
        
    zip_io.seek(0)
    
    return StreamingResponse(zip_io, media_type="application/zip", headers={
        "Content-Disposition": "attachment; filename=split_pdfs.zip"
    })

@app.post("/api/keep")
async def keep_pages_api(
    file: UploadFile = File(...), 
    pages_to_keep: str = Form(...)
):
    """
    Keeps only the specified pages from the uploaded PDF.
    Returns the modified PDF.
    """
    try:
        # Convert comma-separated string to list of 0-based integers
        pages_list = [int(p.strip()) - 1 for p in pages_to_keep.split(",") if p.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page numbers format. Must be comma-separated integers.")
        
    pdf_bytes = await file.read()
    input_pdf = io.BytesIO(pdf_bytes)
    
    try:
        reader = pypdf.PdfReader(input_pdf)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PDF file or corrupted data.")
        
    total_pages = len(reader.pages)
    writer = pypdf.PdfWriter()
    
    for page_num in pages_list:
        if 0 <= page_num < total_pages:
            writer.add_page(reader.pages[page_num])
            
    output_io = io.BytesIO()
    writer.write(output_io)
    output_io.seek(0)
    
    return StreamingResponse(output_io, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=kept_pages.pdf"
    })
