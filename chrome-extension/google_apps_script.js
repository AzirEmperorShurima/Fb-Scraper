function doPost(e) {
  // Lấy sheet đầu tiên trong file
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  
  try {
    // Parse dữ liệu JSON gửi từ Extension
    var data = JSON.parse(e.postData.contents);
    var posts = data.posts;
    var groupUrl = data.group_url;
    
    // Nếu sheet đang trống, thêm tiêu đề cột
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Source URL",
        "Post ID", 
        "Post URL", 
        "Author Name", 
        "Author URL", 
        "Content", 
        "Image Count", 
        "Reactions", 
        "Comments", 
        "Scraped At"
      ]);
      // Làm in đậm tiêu đề
      sheet.getRange(1, 1, 1, 10).setFontWeight("bold");
    }
    
    // Thêm từng bài viết vào hàng mới
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      sheet.appendRow([
        groupUrl,
        p.post_id,
        p.post_url,
        p.author_name,
        p.author_url,
        p.content,
        p.image_count,
        p.reactions,
        p.comments,
        p.scraped_at
      ]);
    }
    
    // Trả về JSON báo thành công cho Extension
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "count": posts.length}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    // Trả về JSON báo lỗi nếu có
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
