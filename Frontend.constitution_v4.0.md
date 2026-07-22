# Frontend Design & Development Constitution v4.0

### Human-First • Production-Ready • Maintainable • AI-Assisted

> **Cách đọc tài liệu này:** Các con số (px, ms, radius...) trong tài liệu là **ví dụ minh hoạ cho một hệ thống nhất quán**, không phải giá trị bắt buộc tuyệt đối. Mỗi dự án tự định nghĩa bộ token riêng, nhưng phải tuân thủ **cách tổ chức** và **nguyên tắc** bên dưới.

---

## 0. Mission (Bắt buộc)

Mọi màn hình phải đạt đủ 7 tiêu chí:

* UX trước UI
* Đẹp nhưng không phô trương
* Có tính nhất quán
* Có cá tính riêng
* Dễ maintain
* Dễ mở rộng
* Chạy mượt

---

## 0.1 Thứ tự ưu tiên khi các nguyên tắc xung đột (Mới)

Khi hai rule mâu thuẫn nhau, xử lý theo thứ tự sau, từ cao xuống thấp:

1. **Accessibility & An toàn dữ liệu người dùng** — không bao giờ đánh đổi
2. **Usability / UX** — người dùng hoàn thành tác vụ được không
3. **Consistency** — có đúng Design System không
4. **Performance**
5. **Aesthetics / Brand personality**

Ví dụ: nếu một animation đẹp làm giảm FPS trên máy yếu → bỏ animation. Nếu một màu brand không đạt contrast AA → điều chỉnh sắc độ, không giữ nguyên vì "đúng brand".

---

## 1. Design Philosophy

**Rule 1 — Context > Trend.** Thiết kế theo user, business, domain — không theo trend. Finance ≠ Hospital ≠ Game ≠ Landing Page.

**Rule 2 — Information First.** User phải thấy thông tin trước animation, gradient, glass, blur.

**Rule 3 — Human Before Perfect.** UI cần đáng tin, có nhịp điệu, có điểm nhấn, có cá tính. Không cố tình làm "lỗi" hay thiếu hoàn thiện để trông tự nhiên.

**Rule 4 — Every Pixel Has Purpose.** Không có màu, animation, shadow, icon, component nào tồn tại chỉ vì "đẹp".

---

## 2. Color System

**Rule 5 — Semantic Color.** Không code cứng `blue`, `red`, `green`. Luôn dùng `primary`, `secondary`, `success`, `warning`, `danger`, `info`, `neutral`.

**Rule 6 — Tỉ lệ 60–30–10.** 60% neutral, 30% primary, 10% accent.

**Rule 7 — Một Primary Color duy nhất.** Không để nhiều màu cùng nổi bật.

**Rule 8 — Border trước Shadow.** Ưu tiên `border`, `shadow-sm` thay vì `shadow-xl`, `drop-shadow`, `glass`.

**Rule 9 — Glassmorphism chỉ dùng cho Hero/Landing/Marketing**, không dùng trong Dashboard hay ứng dụng nghiệp vụ.

---

## 3. Typography

**Rule 10 — Hierarchy quan trọng hơn Font.** Font nào cũng được (Inter, Manrope, SF Pro...) miễn hierarchy tốt.

**Rule 11 — Scale Typography cố định.** Ví dụ: 12/14/16/20/24/30/36/48. Không tạo size lẻ tuỳ hứng.

**Rule 12 — Font weight giới hạn.** Regular, Medium, Semibold; Bold chỉ khi thật cần.

**Rule 13 — Line height dễ đọc.** Body: 1.4–1.7.

---

## 4. Spacing

**Rule 14 — 8pt Grid.** 4/8/12/16/24/32/48/64.

**Rule 15 — Spacing có nhịp**, không lặp đều một giá trị cho mọi khoảng cách.

**Rule 16 — White Space là một thành phần thiết kế**, không phải "khoảng trống thừa".

---

## 5. Component Rules

**Rule 17 — Radius thống nhất theo scale token của dự án** (ví dụ: input 8, button 10, card 12, modal 16 — đây là ví dụ, mỗi dự án tự chọn scale và áp dụng nhất quán).

**Rule 18 — Icon hỗ trợ nội dung**, không lấn át text.

**Rule 19 — Một component phải có đủ state phù hợp với vai trò của nó:**
Default, Hover, Active, Focus, Disabled, Loading (Skeleton), Error, Success, Empty, Partial-data (khi tải dở dang).

**Rule 20 — Không tạo component chỉ dùng một lần.** Dùng từ lần thứ 2 → tách thành reusable.

**Rule 20b — Mọi component reusable phải có documentation tối thiểu** (Mới): mô tả props, ví dụ dùng, các state hỗ trợ — dùng Storybook hoặc file `.md` cạnh component.

---

## 6. Motion

**Rule 21 — Animation phải có lý do**: Loading, Dropdown, Dialog, Toast, Navigation, Transition.

**Rule 22 — Transition 150–250ms.**

**Rule 23 — Tối đa 2–3 animation nổi bật/màn hình.**

**Rule 24 — Performance > Fancy Animation.** Ưu tiên 60 FPS.

**Rule 24b — Tôn trọng `prefers-reduced-motion`** (Mới). Khi hệ điều hành/browser bật chế độ giảm chuyển động, tắt hoặc rút gọn animation không thiết yếu (giữ lại animation truyền tải trạng thái, ví dụ loading spinner).

---

## 7. Layout

**Rule 25 — Grid đều cho App.** Broken Grid chỉ dùng cho Landing.

**Rule 26 — Một màn hình, một điểm nhấn.**

**Rule 27 — Dashboard: ít Card, nhiều dữ liệu.**

---

## 8. UX

**Rule 28 — Loading luôn tồn tại**, ưu tiên Skeleton hơn spinner toàn màn hình.

**Rule 29 — Error phải hữu ích.** Không "500 Error" mà "Không thể tải dữ liệu. Vui lòng thử lại." — kèm hành động khắc phục nếu có thể (nút Retry).

**Rule 30 — Empty State phải hướng dẫn hành động tiếp theo**, không chỉ nói "Không có dữ liệu".

**Rule 31 — Một màn hình chỉ có 1 CTA chính.**

**Rule 32 — Feedback ngay lập tức.** Click → Loading → Success/Error, không để user đoán trạng thái hệ thống.

---

## 9. Accessibility

**Rule 33 — Contrast đạt WCAG AA** (tối thiểu 4.5:1 cho text thường, 3:1 cho text lớn/icon).

**Rule 34 — Click Area ≥44×44px.**

**Rule 35 — Keyboard Navigation đầy đủ**: Tab order hợp lý, không có bẫy focus (focus trap ngoài ý muốn).

**Rule 36 — Focus Ring luôn rõ ràng**, không tắt outline mặc định mà không thay bằng style khác.

**Rule 37 — Không truyền đạt thông tin chỉ bằng màu sắc** (kèm icon/text/pattern).

**Rule 37b — Form & Screen Reader** (Mới): mọi input phải có `label` liên kết đúng (không chỉ placeholder), lỗi validate phải được announce qua `aria-live` hoặc tương đương, ảnh có nội dung phải có `alt` mô tả đúng ngữ cảnh.

---

## 10. Responsive & Quốc tế hoá

**Rule 38 — Mobile First.**

**Rule 39 — Không scale Desktop xuống Mobile.** Thiết kế lại layout khi cần, không chỉ co giãn.

**Rule 40 — Breakpoints chuẩn**, định nghĩa rõ trong design token của dự án.

**Rule 40b — Chuẩn bị cho i18n** (Mới): text container không cố định chiều rộng cứng nhắc (ngôn ngữ khác có thể dài hơn 30–40%); số, ngày, tiền tệ format theo locale; nếu có khả năng hỗ trợ RTL, layout không được hardcode `left/right` mà dùng logical properties (`start/end`).

---

## 11. Performance

**Rule 41 — Lazy Load** cho ảnh, route, component nặng.

**Rule 42 — Image Optimization**: đúng định dạng (WebP/AVIF), đúng kích thước hiển thị, có `srcset` khi cần.

**Rule 43 — Virtual List** cho danh sách dữ liệu lớn (>100 item render cùng lúc).

**Rule 44 — Không render thừa** (memoization hợp lý, tránh re-render không cần thiết).

**Rule 44b — Performance budget cụ thể** (Mới, ví dụ tham khảo — mỗi dự án tự set số phù hợp): LCP < 2.5s, CLS < 0.1, bundle JS ban đầu < 200KB gzip/route. Đây là ngưỡng cần đưa vào CI, không chỉ là khẩu hiệu.

---

## 12. Design Token

**Rule 45 — Không hardcode giá trị.** Không `padding: 13px`, luôn `spacing-md`.

**Rule 46 — Token hoá toàn bộ**: Color, Spacing, Radius, Shadow, Animation, Typography, Z-index, Opacity.

**Rule 46b — Token có version & changelog** (Mới): khi đổi giá trị token nền tảng (vd đổi primary color), phải ghi lại lý do và phạm vi ảnh hưởng, tránh phá vỡ UI cũ một cách âm thầm.

---

## 13. Coding Rules

**Rule 47 — Business Logic không nằm trong UI component.**

**Rule 48 — Component nhỏ, Single Responsibility.**

**Rule 49 — Tên rõ nghĩa.** Không `box1`, `container2`.

**Rule 50 — Folder Structure nhất quán** trong toàn dự án.

---

## 14. Brand Identity

**Rule 51 — Có Signature riêng**: Loading, Chart, Illustration, Empty State, Microcopy.

**Rule 52 — Microcopy có personality**, không quá máy móc.

**Rule 53 — Có Design Language riêng**, không giống template AI mặc định.

---

## 15. AI Generation Rules

Khi AI sinh code, AI phải:

✅ Production Ready — Responsive — Accessible — Reusable — Clean Code — Type Safe — Maintainable

Không được:

❌ Lạm dụng gradient ❌ Shadow quá nặng ❌ Glass everywhere ❌ Animation everywhere
❌ Bo góc 9999px tuỳ tiện ❌ Card khắp nơi ❌ Icon khắp nơi ❌ Dashboard màu mè

**Rule 15b — Khi thiếu context, AI phải hỏi lại thay vì tự suy đoán** (Mới): nếu không rõ brand color, tone giọng, đối tượng người dùng, hoặc ngành nghiệp vụ — AI nên đặt câu hỏi làm rõ hoặc nêu rõ giả định đang dùng, thay vì áp mặc định một cách im lặng.

---

## 16. Kiến trúc Component

**Rule 54 — Thiết kế theo Design System**, không tuỳ hứng theo từng màn hình.

**Rule 55 — Composition hơn kế thừa.** Ví dụ: `Card` gồm `Header/Content/Footer` thay vì tạo `TransactionCard`, `BudgetCard`, `WalletCard` riêng lẻ trùng cấu trúc.

**Rule 56 — Thiết kế cho trạng thái tương lai**: dễ thêm state mới, theme mới, animation mới mà không phải sửa lại code cũ nhiều.

---

## 17. Dark Mode

**Rule 57 — Dark Mode không phải đảo màu.** Mỗi màu cần bản dark riêng, được thiết kế có chủ đích.

**Rule 58 — Kiểm tra contrast ở cả Light và Dark.**

---

## 18. Definition of Done — Checklist trước khi Merge

**Định tính:**
- [ ] Giao diện nhất quán với Design System
- [ ] Đúng Design Token, không hardcode màu/spacing/radius
- [ ] Có đủ Loading, Empty, Error state nếu cần
- [ ] Animation mượt, không thừa, tôn trọng reduced-motion
- [ ] Không có component trùng lặp
- [ ] Đã test thủ công với dữ liệu thực tế (dữ liệu dài, dữ liệu rỗng, dữ liệu lỗi, dữ liệu dịch ngôn ngữ khác nếu có i18n)

**Định lượng (đo được):**
- [ ] Contrast đạt WCAG AA (đo bằng công cụ, không đoán bằng mắt)
- [ ] Keyboard navigation test pass (Tab/Enter/Esc hoạt động đúng)
- [ ] Đạt performance budget đã định nghĩa (LCP, CLS, bundle size)
- [ ] Responsive test qua ít nhất 3 breakpoint chuẩn (mobile/tablet/desktop)

---

## 19. Versioning của chính tài liệu này (Mới)

- Mỗi thay đổi rule nền tảng (color system, spacing scale, token structure) phải được ghi vào changelog kèm lý do.
- Không sửa số thứ tự Rule cũ khi thêm rule mới — dùng hậu tố (vd `24b`) để giữ khả năng tham chiếu ngược trong toàn team/dự án.
- Version hiện tại: **v4.0** — cập nhật từ v3.0: bổ sung mục 0.1 (ưu tiên xung đột), Reduced Motion, A11y form chi tiết, i18n, Performance budget, AI clarification protocol, Documentation rule, Token versioning, Definition of Done định lượng.

---

## Prompt chuẩn dùng với AI (ChatGPT / Claude / Cursor / Codex)

```text
You are a Senior Product Designer, Senior UX Designer, and Senior Frontend Engineer.

Generate production-ready UI that follows a human-first design philosophy,
based on the "Frontend Design & Development Constitution v4.0".

Requirements:
- Prioritize usability and accessibility over visual effects.
- If you lack context (brand color, tone, target user, domain), ask a clarifying
  question or explicitly state your assumption before proceeding.
- Use a consistent design system and design tokens (no hardcoded values).
- Follow an 8pt spacing system with intentional rhythm (not uniform spacing).
- Use semantic colors only (primary/secondary/success/warning/danger/info/neutral).
- Keep typography on a fixed scale with clear hierarchy.
- Use subtle shadows, prefer borders, and meaningful white space.
- Avoid generic AI-looking design: no excessive gradients, oversized radii,
  glassmorphism outside marketing/hero contexts, or animation without purpose.
- Respect prefers-reduced-motion.
- Every component must support relevant states: default, hover, active, focus,
  disabled, loading (skeleton), error, success, empty.
- Components must be reusable, documented, accessible (WCAG AA), responsive,
  and prepared for i18n (no hardcoded left/right, no fixed-width text containers).
- Keep business logic separate from UI.
- Optimize for performance: lazy loading, efficient rendering, smooth 60 FPS,
  and stay within a reasonable bundle/LCP budget.
- Add subtle brand personality through microcopy and interaction, not visual clutter.
- Write clean, modular, type-safe, production-quality code with clear naming
  and a scalable folder/component architecture.
```