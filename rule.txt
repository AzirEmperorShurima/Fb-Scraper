Được. Mình sẽ không tạo một bộ rule kiểu "tổng hợp trên mạng", mà sẽ thiết kế nó như **một Frontend Constitution (Hiến pháp Frontend)**. Mục tiêu là khi sau này bạn đưa cho ChatGPT, Codex, Cursor hay Claude, chúng đều sinh ra UI có cùng chất lượng và phong cách.

Theo mình, đây là phiên bản mà mình sẽ dùng nếu là Tech Lead của một team.

---

# Frontend Design & Development Constitution v3.0

### Human-First • Production-Ready • Maintainable • AI-Assisted

---

# 0. Mission (Bắt buộc)

Mọi màn hình phải đạt đủ 7 tiêu chí:

* UX trước UI
* Đẹp nhưng không phô trương
* Có tính nhất quán
* Có cá tính riêng
* Dễ maintain
* Dễ mở rộng
* Chạy mượt

Nếu phải đánh đổi giữa đẹp và UX

→ luôn chọn UX.

---

# 1. Design Philosophy

## Rule 1

Context > Trend

Không bao giờ thiết kế theo trend.

Thiết kế theo:

* user
* business
* domain

Ví dụ

Finance

≠

Hospital

≠

Game

≠

Landing Page

---

## Rule 2

Information First

User phải nhìn thấy thông tin trước.

Không phải

Animation

Gradient

Glass

Blur

---

## Rule 3

Human Before Perfect

UI không cần "lạ".

UI cần

* đáng tin
* có nhịp điệu
* có điểm nhấn
* có cá tính

Không cố tình làm lỗi hoặc "thiếu hoàn hảo".

---

## Rule 4

Every Pixel Has Purpose

Không có

* màu
* animation
* shadow
* icon
* component

nào tồn tại chỉ vì "đẹp".

---

# 2. Color System

## Rule 5

Dùng Semantic Color.

Không code

```text
blue
red
green
```

Luôn

```text
Primary

Secondary

Success

Warning

Danger

Info

Neutral
```

---

## Rule 6

Quy tắc 60–30–10

60%

Neutral

30%

Primary

10%

Accent

---

## Rule 7

Chỉ có 1 Primary Color.

Không

```text
xanh

tím

cam

đỏ

vàng
```

cùng nổi bật.

---

## Rule 8

Border trước Shadow.

Ưu tiên

```text
border

shadow-sm
```

thay vì

```text
shadow-xl

drop-shadow

glass
```

---

## Rule 9

Glassmorphism chỉ dùng

* Hero
* Landing
* Marketing

Không dùng trong Dashboard hoặc ứng dụng nghiệp vụ.

---

# 3. Typography

## Rule 10

Hierarchy quan trọng hơn Font.

Có thể dùng

Inter

Manrope

General Sans

SF Pro

Roboto

Miễn hierarchy tốt.

---

## Rule 11

Scale Typography cố định.

Ví dụ

```text
12

14

16

20

24

30

36

48
```

Không tự tạo size lẻ.

---

## Rule 12

Chỉ dùng

Regular

Medium

Semibold

Bold khi thật cần thiết.

---

## Rule 13

Body phải đọc dễ.

Line Height

1.4–1.7

---

# 4. Spacing

## Rule 14

Dùng 8pt Grid.

```text
4

8

12

16

24

32

48

64
```

---

## Rule 15

Spacing có nhịp.

Không

```text
24

24

24

24

24
```

Mà

```text
96

40

24

64

32
```

---

## Rule 16

White Space là thành phần thiết kế.

Khoảng trắng cũng là một element.

---

# 5. Component Rules

## Rule 17

Radius thống nhất.

Ví dụ

```text
Input

8

Button

10

Card

12

Modal

16
```

---

## Rule 18

Icon hỗ trợ nội dung.

Không để icon lấn át text.

---

## Rule 19

Một Component phải có đầy đủ state:

* Default
* Hover
* Active
* Focus
* Disabled
* Loading
* Error
* Success
* Empty (nếu phù hợp)

---

## Rule 20

Không tạo Component chỉ dùng một lần.

Nếu dùng từ lần thứ hai

→ reusable.

---

# 6. Motion

## Rule 21

Animation phải có lý do.

Được dùng cho

Loading

Dropdown

Dialog

Toast

Navigation

Transition

---

## Rule 22

Transition

150–250ms

---

## Rule 23

Không animate mọi thứ.

Một màn hình

tối đa

2–3 animation nổi bật.

---

## Rule 24

Performance > Fancy Animation.

60 FPS quan trọng hơn hiệu ứng phức tạp.

---

# 7. Layout

## Rule 25

Grid đều cho App.

Broken Grid chỉ dùng Landing.

---

## Rule 26

Một màn hình

một điểm nhấn.

---

## Rule 27

Dashboard

Ít Card

Nhiều dữ liệu.

---

# 8. UX

## Rule 28

Loading luôn tồn tại.

Ưu tiên

Skeleton

---

## Rule 29

Error phải hữu ích.

Không

```text
500 Error
```

Mà

```text
Không thể tải dữ liệu.

Vui lòng thử lại.
```

---

## Rule 30

Empty State phải hướng dẫn.

---

## Rule 31

CTA luôn rõ.

Một màn hình

chỉ có

1 CTA chính.

---

## Rule 32

Feedback ngay lập tức.

Click

↓

Loading

↓

Success

---

# 9. Accessibility

## Rule 33

Contrast đạt WCAG AA.

---

## Rule 34

Click Area

≥44px

---

## Rule 35

Keyboard Navigation.

---

## Rule 36

Focus Ring luôn rõ.

---

## Rule 37

Không truyền đạt thông tin chỉ bằng màu.

---

# 10. Responsive

## Rule 38

Mobile First.

---

## Rule 39

Không scale Desktop xuống Mobile.

Thiết kế lại khi cần.

---

## Rule 40

Breakpoints chuẩn.

---

# 11. Performance

## Rule 41

Lazy Load.

---

## Rule 42

Image Optimization.

---

## Rule 43

Virtual List nếu dữ liệu lớn.

---

## Rule 44

Không render thừa.

---

# 12. Design Token

## Rule 45

Không Hardcode.

Ví dụ

Không

```css
padding:13px;
```

Luôn

```css
spacing-md
```

---

## Rule 46

Token hóa toàn bộ

Color

Spacing

Radius

Shadow

Animation

Typography

Z-index

Opacity

---

# 13. Coding Rules

## Rule 47

Business Logic không nằm trong UI.

---

## Rule 48

Component nhỏ.

Single Responsibility.

---

## Rule 49

Tên rõ nghĩa.

Không

```text
box1

container2
```

---

## Rule 50

Folder Structure nhất quán.

---

# 14. Brand Identity

## Rule 51

Có Signature.

Ví dụ

Loading

Chart

Illustration

Empty State

Microcopy

---

## Rule 52

Microcopy có personality.

Không quá máy móc.

---

## Rule 53

Có Design Language riêng.

Không giống template AI.

---

# 15. AI Rules

Khi AI sinh code

AI phải:

✅ Production Ready

✅ Responsive

✅ Accessible

✅ Reusable

✅ Clean Code

✅ Type Safe

✅ Maintainable

Không được:

❌ lạm dụng gradient

❌ shadow quá nặng

❌ glass everywhere

❌ animation everywhere

❌ bo góc 9999px

❌ card khắp nơi

❌ icon khắp nơi

❌ dashboard màu mè

---

# 16. Kiến trúc Component (Bổ sung rất quan trọng)

Đây là phần mình thêm vì đa số các bộ rule trên mạng không đề cập, nhưng nó quyết định khả năng mở rộng của dự án.

## Rule 54 — Thiết kế theo Design System

Mọi component phải xuất phát từ Design System, không thiết kế tùy hứng theo từng màn hình.

Ví dụ:

* Button
* TextField
* Card
* Chip
* Badge
* Dialog
* Bottom Sheet
* Snackbar
* Navigation
* Data Table

---

## Rule 55 — Composition hơn là kế thừa

Ưu tiên kết hợp các component nhỏ thay vì tạo nhiều component lớn khó tái sử dụng.

Ví dụ:

```text
Card
 ├── Header
 ├── Content
 └── Footer
```

Thay vì tạo hàng chục biến thể `TransactionCard`, `BudgetCard`, `WalletCard` với cấu trúc lặp lại.

---

## Rule 56 — Thiết kế cho trạng thái tương lai

Component phải dễ mở rộng thêm:

* trạng thái mới
* theme mới
* animation mới
* icon mới

mà không phải sửa code cũ quá nhiều.

---

# 17. Dark Mode

## Rule 57

Dark Mode không phải đảo màu.

Mỗi màu cần có phiên bản dark được thiết kế riêng.

---

## Rule 58

Kiểm tra contrast ở cả Light và Dark.

---

# 18. Chất lượng trước khi Merge

Mọi màn hình phải vượt qua checklist sau:

* Giao diện nhất quán với Design System.
* Đúng Design Token.
* Responsive trên các kích thước phổ biến.
* Có đầy đủ Loading, Empty, Error nếu cần.
* Accessibility đạt chuẩn cơ bản.
* Không có hardcode màu, spacing, radius.
* Animation mượt, không thừa.
* Không có component trùng lặp.
* Có test thủ công trên dữ liệu thực tế (dữ liệu dài, dữ liệu rỗng, dữ liệu lỗi).

---

# Prompt chuẩn mình khuyên dùng với AI

Đây là prompt ngắn gọn nhưng đủ mạnh để dùng với ChatGPT, Codex hoặc Cursor mỗi khi yêu cầu sinh giao diện:

```text
You are a Senior Product Designer, Senior UX Designer, and Senior Frontend Engineer.

Generate production-ready UI that follows a human-first design philosophy.

Requirements:
- Prioritize usability over visual effects.
- Use a consistent design system and design tokens.
- Follow an 8pt spacing system.
- Use semantic colors only.
- Keep typography clean with a clear hierarchy.
- Use subtle shadows and meaningful white space.
- Avoid generic AI-looking designs, excessive gradients, oversized border radii, glassmorphism, and unnecessary animations.
- Every component must support appropriate states (loading, empty, error, disabled, hover, focus).
- Components must be reusable, accessible (WCAG AA), responsive, and maintainable.
- Keep business logic separate from UI.
- Optimize for performance (lazy loading, efficient rendering, smooth 60 FPS interactions).
- Add subtle brand personality through microcopy and interaction, not visual clutter.
- Write clean, modular, production-quality code with clear naming and scalable architecture.
```

---
