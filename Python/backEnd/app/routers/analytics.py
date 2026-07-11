from fastapi import APIRouter, Depends, HTTPException
from collections import Counter
import re
from app import crud, database, schemas
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/jobs", tags=["analytics"])

STOPWORDS = {
    # English
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "about", 
    "as", "from", "that", "this", "these", "those", "it", "its", "they", "them", "their", "we", "us", 
    "you", "your", "he", "him", "his", "she", "her", "is", "are", "was", "were", "be", "been", "have", 
    "has", "had", "do", "does", "did", "not", "no", "yes", "can", "will", "would", "should", "just", 
    # Vietnamese
    "và", "của", "cho", "để", "có", "trong", "là", "các", "những", "một", "hai", "này", "được", "bị", 
    "ra", "vào", "lên", "xuống", "đi", "đến", "với", "từ", "ở", "tại", "như", "nhiều", "ít", "đang", 
    "đã", "sẽ", "cũng", "đều", "hơn", "khi", "như", "nào", "gì", "ai", "đâu", "nào", "thì", "mà", "nhưng"
}

@router.get("/{job_id}/analytics", response_model=schemas.JobAnalyticsResponse)
async def get_job_analytics(
    job_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_job = await crud.get_job(db, job_id)
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    if db_job.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view analytics for this job")
        
    posts = await crud.get_all_posts_by_job(db, job_id)
    if not posts:
        return {
            "total_posts": 0,
            "total_comments": 0,
            "total_reactions": 0,
            "reactions_breakdown": {"like": 0, "love": 0, "haha": 0, "wow": 0, "sad": 0, "angry": 0},
            "engagement_over_time": [],
            "top_authors": [],
            "word_cloud": []
        }
        
    total_posts = len(posts)
    total_comments = sum(p.comments_count for p in posts)
    
    reactions_breakdown = {"like": 0, "love": 0, "haha": 0, "wow": 0, "sad": 0, "angry": 0}
    total_reactions = 0
    
    # Author aggregation
    author_counts = Counter()
    
    # Over time aggregation
    # Key: "YYYY-MM-DD", Value: {posts_count, reactions_count, comments_count}
    over_time_data = {}
    
    # Word frequency aggregation
    words_list = []
    
    for p in posts:
        # Accumulate reactions
        reacts = p.reactions_json or {}
        p_reactions_total = reacts.get("total", 0)
        total_reactions += p_reactions_total
        
        for k in reactions_breakdown.keys():
            reactions_breakdown[k] += reacts.get(k, 0)
            
        # Author counts
        if p.author_name:
            author_counts[p.author_name] += 1
            
        # Over time group
        if p.timestamp:
            date_str = p.timestamp.strftime("%Y-%m-%d")
            if date_str not in over_time_data:
                over_time_data[date_str] = {"posts_count": 0, "reactions_count": 0, "comments_count": 0}
            over_time_data[date_str]["posts_count"] += 1
            over_time_data[date_str]["reactions_count"] += p_reactions_total
            over_time_data[date_str]["comments_count"] += p.comments_count
            
        # Extract words from text
        if p.text:
            # Simple word cleaning: lowercase and strip punctuation
            clean_text = re.sub(r"[^\w\s]", "", p.text.lower())
            words = [w for w in clean_text.split() if w and len(w) > 1 and w not in STOPWORDS]
            words_list.extend(words)

    # Sort over time engagement by date
    engagement_over_time = []
    for d_str, val in sorted(over_time_data.items()):
        engagement_over_time.append(
            schemas.EngagementOverTime(
                date=d_str,
                posts_count=val["posts_count"],
                reactions_count=val["reactions_count"],
                comments_count=val["comments_count"]
            )
        )
        
    # Top authors
    top_authors = [
        schemas.TopAuthor(author_name=name, posts_count=cnt)
        for name, cnt in author_counts.most_common(10)
    ]
    
    # Word cloud
    word_counts = Counter(words_list)
    word_cloud = [
        schemas.WordFreq(text=word, value=cnt)
        for word, cnt in word_counts.most_common(50)
    ]
    
    return schemas.JobAnalyticsResponse(
        total_posts=total_posts,
        total_comments=total_comments,
        total_reactions=total_reactions,
        reactions_breakdown=reactions_breakdown,
        engagement_over_time=engagement_over_time,
        top_authors=top_authors,
        word_cloud=word_cloud
    )
