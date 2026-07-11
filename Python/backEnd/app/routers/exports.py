from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, Response
import pandas as pd
import json
import io
from app import crud, database
from app.routers.auth import get_current_user
from fpdf import FPDF

router = APIRouter(prefix="/api/jobs", tags=["exports"])

def clean_for_latin1(text: str) -> str:
    """Helper to convert/strip characters not supported by standard PDF Helvetica font"""
    if not text:
        return ""
    # Map common Vietnamese/unicode characters to ascii equivalents or strip them
    # For safety, encode to latin-1 with replace/ignore to prevent FPDF UnicodeEncodeError
    return text.encode("latin-1", errors="replace").decode("latin-1")

@router.get("/{job_id}/export")
async def export_job(
    job_id: str,
    format: str = Query("xlsx", pattern="^(xlsx|csv|json|md|pdf)$"),
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_job = await crud.get_job(db, job_id)
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    if db_job.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to export this job's data")
    
    posts = await crud.get_all_posts_by_job(db, job_id)
    if not posts:
        raise HTTPException(status_code=400, detail="No scraped posts found for this job to export")

    # Format data for exports
    rows = []
    for p in posts:
        reactions = p.reactions_json or {}
        rows.append({
            "Post ID": p.post_id,
            "Author Name": p.author_name or "",
            "Author URL": p.author_url or "",
            "Text Content": p.text or "",
            "Timestamp": p.timestamp.isoformat() if p.timestamp else "",
            "Comments Count": p.comments_count,
            "Reactions Total": reactions.get("total", 0),
            "Likes": reactions.get("like", 0),
            "Love": reactions.get("love", 0),
            "Haha": reactions.get("haha", 0),
            "Wow": reactions.get("wow", 0),
            "Sad": reactions.get("sad", 0),
            "Angry": reactions.get("angry", 0),
            "Attachments": ", ".join(p.attachments_json) if p.attachments_json else ""
        })

    df = pd.DataFrame(rows)

    if format == "csv":
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        response = Response(content=stream.getvalue(), media_type="text/csv")
        response.headers["Content-Disposition"] = f"attachment; filename=job_{job_id}_export.csv"
        return response

    elif format == "xlsx":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Scraped Posts")
        output.seek(0)
        response = Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response.headers["Content-Disposition"] = f"attachment; filename=job_{job_id}_export.xlsx"
        return response

    elif format == "json":
        json_data = json.dumps(rows, indent=2, ensure_ascii=False)
        response = Response(content=json_data, media_type="application/json")
        response.headers["Content-Disposition"] = f"attachment; filename=job_{job_id}_export.json"
        return response

    elif format == "md":
        # Generate elegant markdown report
        md_content = f"# Scrape Report for Group: {db_job.group_url}\n"
        md_content += f"- **Job ID**: {job_id}\n"
        md_content += f"- **Scraped At**: {db_job.completed_at or db_job.created_at}\n"
        md_content += f"- **Total Posts**: {len(posts)}\n\n"
        md_content += "---\n\n"
        
        for idx, r in enumerate(rows, 1):
            md_content += f"### {idx}. Post by **{r['Author Name']}** ({r['Timestamp']})\n"
            md_content += f"- **Post URL**: {r['Author URL']}\n"
            md_content += f"- **Engagement**: {r['Reactions Total']} Reactions, {r['Comments Count']} Comments\n"
            if r['Attachments']:
                md_content += f"- **Attachments**: {r['Attachments']}\n"
            md_content += f"\n**Content**:\n{r['Text Content']}\n\n"
            md_content += "---\n\n"
            
        response = Response(content=md_content, media_type="text/markdown")
        response.headers["Content-Disposition"] = f"attachment; filename=job_{job_id}_export.md"
        return response

    elif format == "pdf":
        # Create FPDF document
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 16)
        
        # Header
        pdf.cell(0, 10, clean_for_latin1(f"FBGroupScraper Pro Report"), ln=True, align="C")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 8, clean_for_latin1(f"Group: {db_job.group_url}"), ln=True)
        pdf.cell(0, 8, clean_for_latin1(f"Job ID: {job_id}"), ln=True)
        pdf.cell(0, 8, clean_for_latin1(f"Total Posts Scraped: {len(posts)}"), ln=True)
        pdf.ln(10)
        
        # Post Details
        for idx, r in enumerate(rows, 1):
            if pdf.get_y() > 250: # Page break if close to bottom
                pdf.add_page()
                
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(0, 7, clean_for_latin1(f"{idx}. Post by {r['Author Name']} - {r['Timestamp']}"), ln=True)
            pdf.set_font("Helvetica", "I", 9)
            pdf.cell(0, 5, clean_for_latin1(f"Reactions: {r['Reactions Total']} | Comments: {r['Comments Count']}"), ln=True)
            pdf.ln(2)
            
            pdf.set_font("Helvetica", "", 10)
            text_content = clean_for_latin1(r['Text Content'])
            # Limit display characters per post to fit neatly
            if len(text_content) > 350:
                text_content = text_content[:350] + "..."
            
            pdf.multi_cell(0, 5, text_content)
            pdf.ln(5)
            pdf.line(pdf.get_x(), pdf.get_y(), pdf.get_x() + 190, pdf.get_y())
            pdf.ln(5)

        pdf_bytes = pdf.output(dest="S")
        response = Response(content=bytes(pdf_bytes), media_type="application/pdf")
        response.headers["Content-Disposition"] = f"attachment; filename=job_{job_id}_export.pdf"
        return response
